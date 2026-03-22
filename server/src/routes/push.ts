import { Router, Response, Request } from 'express';
import webPush from 'web-push';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Get VAPID public key for client
router.get('/vapid-key', (req: AuthRequest, res: Response): void => {
  res.json({ 
    publicKey: process.env.VAPID_PUBLIC_KEY || '' 
  });
});

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { endpoint, p256dh, auth } = req.body;

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: 'Требуются endpoint, p256dh и auth' });
      return;
    }

    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: { userId, endpoint }
    });

    if (existing) {
      res.json({ success: true, message: 'Подписка уже существует' });
      return;
    }

    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint,
        p256dh,
        auth
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Unsubscribe from push notifications
router.delete('/subscribe', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Требуется endpoint' });
      return;
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Send push notification (internal use)
export const sendPushNotification = async (
  userId: number,
  title: string,
  body: string,
  icon?: string
): Promise<void> => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      await webPush.sendNotification(
        pushSubscription,
        JSON.stringify({ title, body, icon })
      ).catch(async (err) => {
        if (err.statusCode === 410) {
          // Subscription expired, remove it
          await prisma.pushSubscription.delete({
            where: { id: sub.id }
          });
        }
      });
    }
  } catch (error) {
    console.error('Send push notification error:', error);
  }
};

export default router;
