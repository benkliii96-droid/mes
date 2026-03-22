import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

interface AuthenticatedSocket extends Socket {
  userId?: number;
}

export const setupSocketHandlers = (io: Server): void => {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
    
    if (!token) {
      return next(new Error('Требуется авторизация'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { userId: number };
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`User ${userId} connected`);

    // Join user-specific room
    socket.join(`user_${userId}`);

    // Update last seen
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() }
    });

    // Notify about online status
    socket.broadcast.emit('user_status', {
      userId,
      status: 'online',
      lastSeen: new Date().toISOString()
    });

    // Ping for last seen updates
    const pingInterval = setInterval(async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() }
      });
    }, 30000);

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { content, fileUrl, fileType, duration } = data;

        const message = await prisma.message.create({
          data: {
            senderId: userId,
            content,
            fileUrl,
            fileType: fileType || 'text',
            duration
          },
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

        // Broadcast to all clients (including sender for confirmation)
        io.emit('new_message', message);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // Handle message read
    socket.on('mark_read', async (data) => {
      try {
        const { messageIds } = data;
        
        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            senderId: { not: userId }
          },
          data: { isRead: true }
        });

        // Notify sender
        const messages = await prisma.message.findMany({
          where: { id: { in: messageIds } },
          select: { senderId: true }
        });

        const senderIds = [...new Set(messages.map(m => m.senderId))];
        for (const senderId of senderIds) {
          io.to(`user_${senderId}`).emit('message_read', { 
            messageIds, 
            readerId: userId 
          });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // WebRTC signaling for screen sharing
    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      socket.to(roomId).emit('user_joined', { userId });
    });

    socket.on('webrtc_offer', (data) => {
      const { roomId, offer } = data;
      socket.to(roomId).emit('webrtc_offer', { offer, from: userId });
    });

    socket.on('webrtc_answer', (data) => {
      const { roomId, answer } = data;
      socket.to(roomId).emit('webrtc_answer', { answer, from: userId });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { roomId, candidate } = data;
      socket.to(roomId).emit('webrtc_ice_candidate', { candidate, from: userId });
    });

    socket.on('stop_screen_share', (roomId: string) => {
      socket.to(roomId).emit('screen_share_stopped', { userId });
      socket.leave(roomId);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${userId} disconnected`);
      clearInterval(pingInterval);

      // Get last seen before disconnect
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastSeenAt: true }
      });

      // Notify about offline status
      socket.broadcast.emit('user_status', {
        userId,
        status: 'offline',
        lastSeen: user?.lastSeenAt?.toISOString()
      });
    });
  });
};
