import { 
  getAdminMetrics, 
  getAchievementsByUser, 
  findUserById 
} from '../services/storageService.js';

export async function getAdminStats(req, res) {
  try {
    const metrics = await getAdminMetrics();
    return res.json(metrics);
  } catch (error) {
    console.error('[StatsController] Error al obtener métricas:', error);
    return res.status(500).json({ error: 'Error al obtener métricas del sistema.' });
  }
}

export async function getAchievements(req, res) {
  try {
    const { userId } = req.params;
    const achievements = await getAchievementsByUser(userId);
    return res.json(achievements);
  } catch (error) {
    console.error('[StatsController] Error al obtener logros:', error);
    return res.status(500).json({ error: 'Error al obtener logros.' });
  }
}

export async function getHistory(req, res) {
  try {
    const { userId } = req.params;
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json(user.viewHistory || []);
  } catch (error) {
    console.error('[StatsController] Error al obtener historial:', error);
    return res.status(500).json({ error: 'Error al obtener historial.' });
  }
}
