import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get events for date range
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({ error: 'Требуются параметры from и to' });
      return;
    }

    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    // Get regular events
    const events = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: fromDate,
          lte: toDate
        }
      },
      include: {
        creator: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      },
      orderBy: [{ eventDate: 'asc' }, { eventTime: 'asc' }]
    });

    // For yearly events, also get events from previous years that will recur
    const yearlyEvents = await prisma.event.findMany({
      where: {
        recurrenceType: 'yearly'
      },
      include: {
        creator: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    // Expand yearly events to the requested range
    const expandedYearlyEvents = yearlyEvents.map(event => {
      const baseMonth = event.eventDate.getMonth();
      const baseDay = event.eventDate.getDate();
      const eventsInRange: typeof events = [];
      
      const currentYear = fromDate.getFullYear();
      const endYear = toDate.getFullYear();

      for (let year = currentYear; year <= endYear; year++) {
        const newDate = new Date(year, baseMonth, baseDay);
        if (newDate >= fromDate && newDate <= toDate) {
          eventsInRange.push({
            ...event,
            id: event.id * 10000 + year, // Unique ID for display
            eventDate: newDate,
            isYearlyInstance: true,
            originalEventId: event.id
          } as any);
        }
      }
      
      return eventsInRange;
    }).flat();

    res.json({
      events: [...events, ...expandedYearlyEvents]
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create event
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, eventDate, eventTime, recurrenceType, reminderMinutes } = req.body;
    const userId = req.userId!;

    if (!title || !eventDate) {
      res.status(400).json({ error: 'Требуются название и дата события' });
      return;
    }

    const event = await prisma.event.create({
      data: {
        creatorId: userId,
        title,
        description,
        eventDate: new Date(eventDate),
        eventTime: eventTime ? new Date(eventTime) : null,
        recurrenceType: recurrenceType || 'once',
        reminderMinutes: reminderMinutes ? parseInt(reminderMinutes) : null
      },
      include: {
        creator: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    res.json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update event (only by creator)
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, eventDate, eventTime, recurrenceType, reminderMinutes } = req.body;
    const userId = req.userId!;

    const event = await prisma.event.findUnique({
      where: { id: parseInt(id) }
    });

    if (!event) {
      res.status(404).json({ error: 'Событие не найдено' });
      return;
    }

    if (event.creatorId !== userId) {
      res.status(403).json({ error: 'Вы можете редактировать только свои события' });
      return;
    }

    const updated = await prisma.event.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        eventTime: eventTime ? new Date(eventTime) : undefined,
        recurrenceType,
        reminderMinutes: reminderMinutes !== undefined ? parseInt(reminderMinutes) : undefined
      },
      include: {
        creator: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete event (only by creator)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const event = await prisma.event.findUnique({
      where: { id: parseInt(id) }
    });

    if (!event) {
      res.status(404).json({ error: 'Событие не найдено' });
      return;
    }

    if (event.creatorId !== userId) {
      res.status(403).json({ error: 'Вы можете удалять только свои события' });
      return;
    }

    await prisma.event.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
