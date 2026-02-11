import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type { CarInfo, MaintenanceEvent } from '@/types/car';
import { eventTypeLabel, formatCurrency, formatDate } from '@/utils/format';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function Calendar() {
  const { getToken, signOut } = useAuth();

  const [cars, setCars] = useState<CarInfo[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const userCars = await carsApi.getUserCars(token);
      setCars(userCars);
      if (userCars.length > 0 && !selectedCarId) {
        setSelectedCarId(userCars[0].id ?? null);
      }
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
        signOut();
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, signOut, selectedCarId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadEvents = useCallback(async () => {
    if (!selectedCarId) {
      setEvents([]);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const evts = await carsApi.getMaintenanceEvents(selectedCarId, token);
      setEvents(evts.sort((a, b) => b.event_date.localeCompare(a.event_date)));
    } catch {
      setEvents([]);
    }
  }, [selectedCarId, getToken]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      set.add(e.event_date);
    }
    return set;
  }, [events]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];

    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [currentMonth]);

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Calendar</h1>

      {cars.length > 0 && (
        <div className="car-selector">
          {cars.map((car) => (
            <button
              key={car.id}
              className={`chip ${selectedCarId === car.id ? 'chip--active' : ''}`}
              onClick={() => setSelectedCarId(car.id ?? null)}
            >
              {car.merke} {car.modell}
            </button>
          ))}
        </div>
      )}

      <Card className="calendar-card">
        <div className="calendar-nav">
          <button className="calendar-nav__btn" onClick={prevMonth}>
            &lsaquo;
          </button>
          <span className="calendar-nav__title">
            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
          <button className="calendar-nav__btn" onClick={nextMonth}>
            &rsaquo;
          </button>
        </div>

        <div className="calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="calendar-grid__header">
              {d}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="calendar-grid__cell" />;
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEvent = markedDates.has(dateStr);
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            return (
              <div
                key={dateStr}
                className={`calendar-grid__cell ${hasEvent ? 'calendar-grid__cell--event' : ''} ${isToday ? 'calendar-grid__cell--today' : ''}`}
              >
                {day}
                {hasEvent && <span className="calendar-dot" />}
              </div>
            );
          })}
        </div>
      </Card>

      <section className="section">
        <h2>Event Timeline</h2>
        {events.length === 0 ? (
          <p className="text-muted">No events for this vehicle.</p>
        ) : (
          <div className="timeline">
            {events.map((event) => (
              <TimelineEvent key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TimelineEvent({ event }: { event: MaintenanceEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="event-card"
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: event.notes ? 'pointer' : 'default' }}
    >
      <div className="event-card__header">
        <div className="event-card__type-date">
          <span className="event-card__type">{eventTypeLabel(event.event_type)}</span>
          <span className="event-card__date">{formatDate(event.event_date)}</span>
        </div>
      </div>
      <div className="event-card__tags">
        {event.mileage != null && (
          <span className="tag">{event.mileage.toLocaleString()} km</span>
        )}
        {event.cost_cents != null && (
          <span className="tag">{formatCurrency(event.cost_cents)}</span>
        )}
        {event.vendor && <span className="tag">{event.vendor}</span>}
      </div>
      {expanded && event.notes && (
        <div className="event-card__notes">
          <p>{event.notes}</p>
        </div>
      )}
    </Card>
  );
}
