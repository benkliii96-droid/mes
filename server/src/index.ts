import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import cron from 'node-cron';

import authRoutes from './routes/auth.js';
import messagesRoutes from './routes/messages.js';
import eventsRoutes from './routes/events.js';
import cycleRoutes from './routes/cycle.js';
import userRoutes from './routes/user.js';
import pushRoutes from './routes/push.js';
import uploadRoutes from './routes/upload.js';
import { setupSocketHandlers } from './services/socketService.js';
import { setupCronJobs } from './services/cronService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Global prisma instance
export const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/avatars', express.static(path.join(process.cwd(), 'avatars')));

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/auth', authRoutes);
app.use('/messages', messagesRoutes);
app.use('/events', eventsRoutes);
app.use('/cycle', cycleRoutes);
app.use('/user', userRoutes);
app.use('/push', pushRoutes);
app.use('/upload', uploadRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO handlers
setupSocketHandlers(io);

// Cron jobs for notifications
setupCronJobs(io);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
