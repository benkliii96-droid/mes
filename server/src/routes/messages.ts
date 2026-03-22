import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get messages with pagination
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await prisma.message.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.message.count();

    res.json({
      messages: messages.reverse(), // Return in chronological order
      total,
      hasMore: offset + messages.length < total
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Mark messages as read
router.post('/read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageIds } = req.body;
    const userId = req.userId!;

    if (!messageIds || !Array.isArray(messageIds)) {
      res.status(400).json({ error: 'Требуется массив ID сообщений' });
      return;
    }

    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });

    // Notify sender about read status
    const io = req.app.get('io');
    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { senderId: true }
    });

    const senderIds = [...new Set(messages.map(m => m.senderId))];
    for (const senderId of senderIds) {
      io.to(`user_${senderId}`).emit('message_read', { messageIds, readerId: userId });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
