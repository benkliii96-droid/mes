import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

const router = Router();

// Default users to create on first run
const DEFAULT_USERS = [
  { username: 'he', defaultNickname: 'Он' },
  { username: 'she', defaultNickname: 'Она' }
];

// Initialize default users
export const initializeDefaultUsers = async (password: string): Promise<void> => {
  const passwordHash = await bcrypt.hash(password, 10);
  
  for (const userData of DEFAULT_USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: userData.username }
    });
    
    if (!existing) {
      await prisma.user.create({
        data: {
          username: userData.username,
          passwordHash,
          nickname: userData.defaultNickname
        }
      });
      console.log(`Created default user: ${userData.username}`);
    }
  }
};

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, userId } = req.body;

    if (!password || !userId) {
      res.status(400).json({ error: 'Требуются пароль и ID пользователя' });
      return;
    }

    // Get default password from env or use env variable
    const defaultPassword = process.env.DEFAULT_PASSWORD || 'ourlove';
    
    // Find user by ID
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    // Check password against stored hash or default password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash) || 
                           password === defaultPassword;

    if (!isValidPassword) {
      res.status(401).json({ error: 'Неверный пароль' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() }
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        themeMode: user.themeMode,
        themeColor: user.themeColor,
        calendarNotificationsEnabled: user.calendarNotificationsEnabled
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.cookies?.token;

    if (!token || !currentPassword || !newPassword) {
      res.status(400).json({ error: 'Требуются все поля' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { userId: number };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Неверный текущий пароль' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.token;
    
    if (!token) {
      res.status(401).json({ error: 'Требуется авторизация' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { userId: number };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        themeMode: user.themeMode,
        themeColor: user.themeColor,
        calendarNotificationsEnabled: user.calendarNotificationsEnabled
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Недействительный токен' });
  }
});

router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
