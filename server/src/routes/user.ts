import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get user settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        themeMode: true,
        themeColor: true,
        calendarNotificationsEnabled: true,
        lastSeenAt: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update user settings
router.put('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { nickname, themeMode, themeColor, calendarNotificationsEnabled } = req.body;

    const updateData: any = {};
    
    if (nickname !== undefined) updateData.nickname = nickname;
    if (themeMode !== undefined) updateData.themeMode = themeMode;
    if (themeColor !== undefined) updateData.themeColor = themeColor;
    if (calendarNotificationsEnabled !== undefined) {
      updateData.calendarNotificationsEnabled = calendarNotificationsEnabled;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        themeMode: true,
        themeColor: true,
        calendarNotificationsEnabled: true
      }
    });

    // Notify other user about nickname change
    const io = req.app.get('io');
    const otherUserId = userId === 1 ? 2 : 1;
    io.to(`user_${otherUserId}`).emit('user_updated', user);

    res.json(user);
  } catch (error) {
    console.error('Update user settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get last seen status of another user
router.get('/last-seen/:userId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        nickname: true,
        lastSeenAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get last seen error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
