import cron from 'node-cron';
import { Server } from 'socket.io';
import { prisma } from '../index.js';
import { sendPushNotification } from '../routes/push.js';

export const setupCronJobs = (io: Server): void => {
  // Check for event reminders every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find events with upcoming reminders
      const events = await prisma.event.findMany({
        where: {
          reminderMinutes: { not: null }
        },
        include: {
          creator: {
            select: {
              id: true,
              nickname: true,
              calendarNotificationsEnabled: true
            }
          }
        }
      });

      for (const event of events) {
        if (!event.creator.calendarNotificationsEnabled || !event.reminderMinutes) continue;

        const eventDateTime = new Date(event.eventDate);
        if (event.eventTime) {
          const [hours, minutes] = event.eventTime.toTimeString().split(':');
          eventDateTime.setHours(parseInt(hours), parseInt(minutes));
        }

        const reminderTime = new Date(eventDateTime);
        reminderTime.setMinutes(reminderTime.getMinutes() - event.reminderMinutes);

        // Check if we should send reminder now
        const diffMinutes = Math.floor((reminderTime.getTime() - now.getTime()) / (1000 * 60));
        
        if (diffMinutes >= 0 && diffMinutes < 1) {
          const timeStr = event.eventTime 
            ? event.eventTime.toTimeString().slice(0, 5)
            : 'весь день';

          await sendPushNotification(
            event.creatorId,
            `Напоминание: ${event.title}`,
            `${event.eventDate.toLocaleDateString('ru')} в ${timeStr}`
          );

          // Also send via socket if online
          io.to(`user_${event.creatorId}`).emit('event_reminder', {
            eventId: event.id,
            title: event.title,
            eventDate: event.eventDate,
            eventTime: event.eventTime
          });
        }

        // For yearly events, also check next year's occurrence
        if (event.recurrenceType === 'yearly') {
          const nextYearEvent = new Date(event.eventDate);
          nextYearEvent.setFullYear(now.getFullYear());
          
          if (event.eventTime) {
            const [hours, minutes] = event.eventTime.toTimeString().split(':');
            nextYearEvent.setHours(parseInt(hours), parseInt(minutes));
          }

          const nextReminderTime = new Date(nextYearEvent);
          nextReminderTime.setMinutes(nextReminderTime.getMinutes() - (event.reminderMinutes || 0));

          const diffMinutesNext = Math.floor((nextReminderTime.getTime() - now.getTime()) / (1000 * 60));
          
          if (diffMinutesNext >= 0 && diffMinutesNext < 1) {
            const timeStr = event.eventTime 
              ? event.eventTime.toTimeString().slice(0, 5)
              : 'весь день';

            await sendPushNotification(
              event.creatorId,
              `Напоминание: ${event.title}`,
              `${nextYearEvent.toLocaleDateString('ru')} в ${timeStr} (ежегодное)`
            );
          }
        }
      }
    } catch (error) {
      console.error('Event reminder cron error:', error);
    }
  });

  // Check for menstrual cycle reminders daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      // Get prediction for user who tracks cycle (user ID 2 by default - "she")
      const cycleUserId = 2; // "Она"

      const entries = await prisma.menstrualCycle.findMany({
        where: { userId: cycleUserId },
        orderBy: { startDate: 'desc' },
        take: 6
      });

      if (entries.length < 2) return;

      // Calculate average cycle
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
        if (days > 15 && days < 60) {
          cycles.push(days);
        }
      }

      if (cycles.length === 0) return;

      const avgCycleLength = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
      const lastPeriodStart = new Date(entries[0].startDate);
      
      const nextPeriodStart = new Date(lastPeriodStart);
      nextPeriodStart.setDate(nextPeriodStart.getDate() + avgCycleLength);

      // Check if period is tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextPeriodDay = new Date(nextPeriodStart);
      nextPeriodDay.setHours(0, 0, 0, 0);

      if (nextPeriodDay.getTime() === tomorrow.getTime()) {
        // Get both users and send notifications if they have calendar notifications enabled
        const users = await prisma.user.findMany({
          where: { calendarNotificationsEnabled: true }
        });

        for (const user of users) {
          await sendPushNotification(
            user.id,
            'Скоро начало цикла',
            'Предполагаемое начало через 1 день'
          );
        }
      }
    } catch (error) {
      console.error('Cycle reminder cron error:', error);
    }
  });
};
