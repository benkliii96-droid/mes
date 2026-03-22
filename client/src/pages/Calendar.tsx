import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext.tsx';
import Navigation from '../components/Navigation.tsx';
import './Calendar.css';

interface Event {
  id: number;
  title: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  recurrenceType: string;
  reminderMinutes: number | null;
  creator: {
    id: number;
    nickname: string;
    avatarUrl: string | null;
  };
}

interface CyclePrediction {
  hasEnoughData: boolean;
  nextPeriodStart?: string;
  fertileWindowStart?: string;
  fertileWindowEnd?: string;
  message?: string;
}

export default function Calendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showCycleForm, setShowCycleForm] = useState(false);

  // Form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('once');
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');

  useEffect(() => {
    loadEvents();
    loadPrediction();
  }, [currentDate]);

  const loadEvents = async () => {
    const from = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const to = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    
    try {
      const res = await fetch(`/api/events?from=${from}&to=${to}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Load events error:', error);
    }
  };

  const loadPrediction = async () => {
    try {
      const res = await fetch('/api/cycle/predict', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPrediction(data);
      }
    } catch (error) {
      console.error('Load prediction error:', error);
    }
  };

  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.eventDate), day)
    );
  };

  const isFertileDay = (day: Date) => {
    if (!prediction?.hasEnoughData || !prediction.fertileWindowStart || !prediction.fertileWindowEnd) {
      return false;
    }
    const dayStr = format(day, 'yyyy-MM-dd');
    return dayStr >= prediction.fertileWindowStart && dayStr <= prediction.fertileWindowEnd;
  };

  const isPeriodDay = (day: Date) => {
    if (!prediction?.hasEnoughData || !prediction.nextPeriodStart) return false;
    
    // Check if day is within predicted period (approximate: 5 days from start)
    const periodStart = new Date(prediction.nextPeriodStart);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 5);
    
    return day >= periodStart && day <= periodEnd;
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: eventTitle,
          description: eventDescription || null,
          eventDate,
          eventTime: eventTime || null,
          recurrenceType,
          reminderMinutes: reminderMinutes ? parseInt(reminderMinutes) : null
        })
      });

      if (res.ok) {
        setShowEventForm(false);
        resetEventForm();
        loadEvents();
      }
    } catch (error) {
      console.error('Create event error:', error);
    }
  };

  const handleAddCycleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/cycle/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startDate: cycleStartDate })
      });

      if (res.ok) {
        setShowCycleForm(false);
        setCycleStartDate('');
        loadPrediction();
      }
    } catch (error) {
      console.error('Add cycle entry error:', error);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Удалить событие?')) return;
    
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        loadEvents();
      }
    } catch (error) {
      console.error('Delete event error:', error);
    }
  };

  const resetEventForm = () => {
    setEventTitle('');
    setEventDescription('');
    setEventDate('');
    setEventTime('');
    setRecurrenceType('once');
    setReminderMinutes('');
  };

  const days = getDaysInMonth();

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <h1>Календарь</h1>
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            ←
          </button>
          <span>{format(currentDate, 'MMMM yyyy', { locale: ru })}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            →
          </button>
        </div>
      </header>

      {prediction?.hasEnoughData && (
        <div className="cycle-info">
          <div className="cycle-legend">
            <span className="legend-item period">● Месячные</span>
            <span className="legend-item fertile">● Фертильное окно</span>
          </div>
          {prediction.nextPeriodStart && (
            <p className="next-period">
              Следующие месячные: {format(new Date(prediction.nextPeriodStart), 'd MMMM', { locale: ru })}
            </p>
          )}
        </div>
      )}

      <div className="calendar-grid">
        <div className="weekdays">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="days">
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const isFertile = isFertileDay(day);
            const isPeriod = isPeriodDay(day);
            
            return (
              <div
                key={day.toISOString()}
                className={`day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isFertile ? 'fertile' : ''} ${isPeriod ? 'period' : ''}`}
                onClick={() => {
                  setEventDate(format(day, 'yyyy-MM-dd'));
                  setShowEventForm(true);
                }}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-events">
                  {dayEvents.slice(0, 2).map(event => (
                    <div key={event.id} className="event-chip" onClick={(e) => e.stopPropagation()}>
                      <span className="event-title">{event.title}</span>
                      {event.creator.id === user?.id && (
                        <button 
                          className="event-delete"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="more-events">+{dayEvents.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="calendar-actions">
        <button 
          className="btn btn-primary"
          onClick={() => setShowCycleForm(true)}
        >
          Добавить день цикла
        </button>
      </div>

      {showEventForm && (
        <div className="modal-overlay" onClick={() => setShowEventForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Новое событие</h2>
            <form onSubmit={handleCreateEvent}>
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Дата</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Время</label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Повторение</label>
                <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
                  <option value="once">Однократно</option>
                  <option value="yearly">Ежегодно</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Напоминание (минут до)</label>
                <select 
                  value={reminderMinutes} 
                  onChange={(e) => setReminderMinutes(e.target.value)}
                >
                  <option value="">Без напоминания</option>
                  <option value="15">За 15 минут</option>
                  <option value="30">За 30 минут</option>
                  <option value="60">За 1 час</option>
                  <option value="1440">За 1 день</option>
                </select>
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEventForm(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCycleForm && (
        <div className="modal-overlay" onClick={() => setShowCycleForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Добавить начало месячных</h2>
            <form onSubmit={handleAddCycleEntry}>
              <div className="form-group">
                <label>Дата начала</label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCycleForm(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
