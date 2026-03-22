import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get cycle entries
router.get('/entries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const entries = await prisma.menstrualCycle.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' }
    });

    res.json(entries);
  } catch (error) {
    console.error('Get cycle entries error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Add cycle entry
router.post('/entries', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, notes } = req.body;
    const userId = req.userId!;

    if (!startDate) {
      res.status(400).json({ error: 'Требуется дата начала' });
      return;
    }

    const entry = await prisma.menstrualCycle.create({
      data: {
        userId,
        startDate: new Date(startDate),
        notes
      }
    });

    res.json(entry);
  } catch (error) {
    console.error('Add cycle entry error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update cycle entry
router.put('/entries/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { startDate, notes } = req.body;
    const userId = req.userId!;

    const entry = await prisma.menstrualCycle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!entry) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }

    if (entry.userId !== userId) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const updated = await prisma.menstrualCycle.update({
      where: { id: parseInt(id) },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        notes
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update cycle entry error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete cycle entry
router.delete('/entries/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const entry = await prisma.menstrualCycle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!entry) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }

    if (entry.userId !== userId) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    await prisma.menstrualCycle.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete cycle entry error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get prediction
router.get('/predict', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const entries = await prisma.menstrualCycle.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      take: 6
    });

    if (entries.length < 2) {
      res.json({
        hasEnoughData: false,
        message: 'Нужно минимум 2 записи для расчёта'
      });
      return;
    }

    // Calculate average cycle length
    const cycles: number[] = [];
    const sortedEntries = entries.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    for (let i = 1; i < sortedEntries.length; i++) {
      const days = Math.floor(
        (new Date(sortedEntries[i].startDate).getTime() - 
         new Date(sortedEntries[i - 1].startDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      if (days > 15 && days < 60) { // Reasonable cycle length
        cycles.push(days);
      }
    }

    if (cycles.length === 0) {
      res.json({
        hasEnoughData: false,
        message: 'Недостаточно данных для расчёта'
      });
      return;
    }

    const avgCycleLength = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
    const lastPeriodStart = new Date(entries[0].startDate);
    
    // Predict next period
    const nextPeriodStart = new Date(lastPeriodStart);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + avgCycleLength);

    // Ovulation is typically 14 days before next period
    const ovulationDate = new Date(nextPeriodStart);
    ovulationDate.setDate(ovulationDate.getDate() - 14);

    // Fertile window: 5 days before ovulation + ovulation day
    const fertileWindowStart = new Date(ovulationDate);
    fertileWindowStart.setDate(fertileWindowStart.getDate() - 5);

    res.json({
      hasEnoughData: true,
      averageCycleLength: avgCycleLength,
      nextPeriodStart: nextPeriodStart.toISOString().split('T')[0],
      ovulationDate: ovulationDate.toISOString().split('T')[0],
      fertileWindowStart: fertileWindowStart.toISOString().split('T')[0],
      fertileWindowEnd: ovulationDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Get prediction error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
