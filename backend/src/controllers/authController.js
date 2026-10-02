import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import { 
  findUserByEmail, 
  findUserById, 
  saveUser, 
  recordSession, 
  unlockAchievement,
  getUsers
} from '../services/storageService.js';
import { 
  hashPassword, 
  generateTwoFactorSecret, 
  verifyTwoFactorToken 
} from '../services/cryptoService.js';

export async function register(req, res) {
  try {
    const { username, email, password, passwordHash } = req.body;
    if (!username || !email || (!password && !passwordHash)) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }

    const allUsers = await getUsers();
    const isFirstUser = allUsers.length === 0;

    const newUser = {
      id: req.body.id || Math.random().toString(36).substring(2, 11),
      username,
      email: email.toLowerCase().trim(),
      passwordHash: passwordHash || hashPassword(password),
      role: isFirstUser ? 'admin' : (req.body.role || 'user'),
      avatarUrl: req.body.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      createdAt: req.body.createdAt || new Date().toISOString(),
      is2FAEnabled: false,
      storageQuota: 10 * 1024 * 1024 * 1024,
      storageUsed: 0,
      settings: req.body.settings || {
        accentColor: '#7373F0',
        isDarkMode: true,
        interfaceDensity: 'default',
        glassIntensity: 10,
        backgroundTheme: 'classic',
        borderRadius: 12,
        reducedMotion: false,
        videoAutoplay: true,
        lowResPreviews: false,
        gpuAcceleration: true,
        aiBackgroundAnalysis: true,
        vaultAutoLockEnabled: true,
        vaultAutoLockTime: 60
      }
    };

    const saved = await saveUser(newUser);
    await unlockAchievement(saved.id, 'first_signup');

    return res.status(201).json({ success: true, user: saved });
  } catch (error) {
    console.error('[AuthController] Error en registro:', error);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
}

export async function login(req, res) {
  try {
    const { email, password, passwordHash, twoFactorCode } = req.body;
    if (!email || (!password && !passwordHash)) {
      return res.status(400).json({ error: 'Email y contraseña requeridos.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const targetHash = passwordHash || (password ? hashPassword(password) : null);
    const isMatch = (user.passwordHash === targetHash) || (password && user.passwordHash === password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Validación 2FA si está activo
    if (user.is2FAEnabled && user.twoFASecret) {
      if (!twoFactorCode) {
        return res.status(200).json({ requires2FA: true, userId: user.id });
      }
      const isValid2FA = verifyTwoFactorToken(twoFactorCode, user.twoFASecret);
      if (!isValid2FA) {
        return res.status(401).json({ error: 'Código 2FA incorrecto o expirado.' });
      }
    }

    const userAgent = req.headers['user-agent'] || '';
    const updatedUser = await recordSession(user.id, userAgent);

    return res.status(200).json({ success: true, user: updatedUser || user });
  } catch (error) {
    console.error('[AuthController] Error en login:', error);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
}

export async function findUser(req, res) {
  try {
    const { email, username } = req.query;
    let user = null;
    if (email) {
      user = await findUserByEmail(email);
    }
    if (!user && username) {
      const all = await getUsers();
      user = all.find(u => u.username.toLowerCase() === username.toLowerCase());
    }
    if (!user) {
      return res.json({ found: false, user: null });
    }
    return res.json({ found: true, user });
  } catch (error) {
    console.error('[AuthController] Error en findUser:', error);
    return res.status(500).json({ error: 'Error en búsqueda de usuario.' });
  }
}

export async function handleSaveUser(req, res) {
  try {
    const userData = req.body;
    if (!userData || !userData.email) {
      return res.status(400).json({ error: 'Datos de usuario requeridos.' });
    }
    const saved = await saveUser(userData);
    return res.json({ success: true, user: saved });
  } catch (error) {
    console.error('[AuthController] Error en handleSaveUser:', error);
    return res.status(500).json({ error: 'Error al guardar usuario.' });
  }
}

export async function setup2FA(req, res) {
  try {
    const { userId } = req.body;
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const secret = generateTwoFactorSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'PixelSphere', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    user.tempTwoFASecret = secret;
    await saveUser(user);

    return res.json({ secret, qrCode: qrCodeDataUrl });
  } catch (error) {
    console.error('[AuthController] Error en setup2FA:', error);
    return res.status(500).json({ error: 'Error al generar 2FA.' });
  }
}

export async function confirm2FA(req, res) {
  try {
    const { userId, code } = req.body;
    const user = await findUserById(userId);
    if (!user || !user.tempTwoFASecret) {
      return res.status(400).json({ error: 'No se ha iniciado la configuración de 2FA.' });
    }

    const isValid = verifyTwoFactorToken(code, user.tempTwoFASecret);
    if (!isValid) {
      return res.status(400).json({ error: 'Código 2FA inválido.' });
    }

    user.twoFASecret = user.tempTwoFASecret;
    user.is2FAEnabled = true;
    delete user.tempTwoFASecret;
    await saveUser(user);

    return res.json({ success: true, message: '2FA activado con éxito.' });
  } catch (error) {
    console.error('[AuthController] Error en confirm2FA:', error);
    return res.status(500).json({ error: 'Error al confirmar 2FA.' });
  }
}

export async function disable2FA(req, res) {
  try {
    const { userId } = req.body;
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    user.is2FAEnabled = false;
    delete user.twoFASecret;
    await saveUser(user);

    return res.json({ success: true, message: '2FA desactivado con éxito.' });
  } catch (error) {
    console.error('[AuthController] Error en disable2FA:', error);
    return res.status(500).json({ error: 'Error al desactivar 2FA.' });
  }
}

export async function getProfile(req, res) {
  try {
    const { id } = req.params;
    let user = await findUserById(id);
    if (!user) {
      user = await findUserByEmail(id);
    }
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json(user);
  } catch (error) {
    console.error('[AuthController] Error en getProfile:', error);
    return res.status(500).json({ error: 'Error al obtener perfil.' });
  }
}

export async function updateProfile(req, res) {
  try {
    const { id } = req.params;
    let user = await findUserById(id);
    if (!user) {
      user = await findUserByEmail(id);
    }
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const updates = req.body;
    const merged = { ...user, ...updates };

    const saved = await saveUser(merged);
    return res.json({ success: true, user: saved });
  } catch (error) {
    console.error('[AuthController] Error en updateProfile:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil.' });
  }
}
