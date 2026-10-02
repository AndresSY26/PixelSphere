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
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }

    const allUsers = await getUsers();
    const isFirstUser = allUsers.length === 0;

    const newUser = {
      id: Math.random().toString(36).substring(2, 11),
      username,
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      role: isFirstUser ? 'admin' : 'user',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      createdAt: new Date().toISOString(),
      is2FAEnabled: false,
      storageQuota: 10 * 1024 * 1024 * 1024, // 10 GB
      storageUsed: 0,
      settings: {
        theme: 'dark',
        autoTagging: true,
        highQualityStreaming: true,
        allowPublicSharing: true
      }
    };

    const saved = await saveUser(newUser);
    await unlockAchievement(saved.id, 'first_signup');

    // Sanitizar respuesta (no enviar passwordHash)
    const { passwordHash, twoFASecret, ...safeUser } = saved;
    return res.status(201).json({ success: true, user: safeUser });
  } catch (error) {
    console.error('[AuthController] Error en registro:', error);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
}

export async function login(req, res) {
  try {
    const { email, password, twoFactorCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const hashedPassword = hashPassword(password);
    if (user.passwordHash !== hashedPassword) {
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

    const { passwordHash, twoFASecret, ...safeUser } = updatedUser || user;
    return res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    console.error('[AuthController] Error en login:', error);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
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

    // Guardar temporalmente el secret en el usuario
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
    const user = await findUserById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const { passwordHash, twoFASecret, ...safeUser } = user;
    return res.json(safeUser);
  } catch (error) {
    console.error('[AuthController] Error en getProfile:', error);
    return res.status(500).json({ error: 'Error al obtener perfil.' });
  }
}

export async function updateProfile(req, res) {
  try {
    const { id } = req.params;
    const user = await findUserById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const { username, avatarUrl, settings, bio } = req.body;
    if (username) user.username = username;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    if (settings) user.settings = { ...user.settings, ...settings };
    if (bio !== undefined) user.bio = bio;

    const saved = await saveUser(user);
    const { passwordHash, twoFASecret, ...safeUser } = saved;
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('[AuthController] Error en updateProfile:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil.' });
  }
}
