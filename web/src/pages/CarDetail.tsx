import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type { CarInfo, CarServiceStatus, MaintenanceEvent, ServiceDueStatus } from '@/types/car';
import {
  eventTypeLabel,
  formatCurrency,
  formatDate,
  urgencyColor,
  urgencyLabel,
} from '@/utils/format';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function CarDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken, signOut } = useAuth();
  const navigate = useNavigate();

  const [car, setCar] = useState<CarInfo | null>(null);
  const [serviceStatus, setServiceStatus] = useState<CarServiceStatus | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [carData, statusData, eventsData] = await Promise.all([
        carsApi.getCar(id, token),
        carsApi.getCarServiceStatus(id, token),
        carsApi.getMaintenanceEvents(id, token),
      ]);
      setCar(carData);
      setServiceStatus(statusData);
      setEvents(eventsData.sort((a, b) => b.event_date.localeCompare(a.event_date)));
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
        signOut();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, getToken, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="page">
        <div className="error-banner">{error ?? 'Car not found'}</div>
        <button className="link-button" onClick={() => navigate('/')}>
          Go home
        </button>
      </div>
    );
  }

  const nextService = serviceStatus?.next_service;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Back
        </button>
        <div>
          <h1>
            {car.merke} {car.modell}
          </h1>
          <div className="car-detail-meta">
            <span className="car-detail-meta__reg">{car.registreringsnummer}</span>
            <span className="car-detail-meta__km">{car.kilometer.toLocaleString()} km</span>
          </div>
        </div>
      </div>

      {nextService && nextService.urgency !== 'ok' && nextService.urgency !== 'unknown' && (
        <div
          className={`next-service-alert ${nextService.urgency === 'overdue' ? 'next-service-alert--overdue' : 'next-service-alert--soon'}`}
        >
          <strong>{nextService.urgency === 'overdue' ? 'Overdue' : 'Due Soon'}:</strong>{' '}
          {eventTypeLabel(nextService.event_type)}
          {nextService.days_until_due != null && (
            <span>
              {' '}
              ({nextService.urgency === 'overdue'
                ? `${Math.abs(nextService.days_until_due)} days overdue`
                : `${nextService.days_until_due} days left`})
            </span>
          )}
        </div>
      )}

      {serviceStatus && serviceStatus.services.length > 0 && (
        <section className="section">
          <h2>Service Status</h2>
          <div className="service-status-grid">
            {serviceStatus.services.map((s) => (
              <ServiceStatusCard key={s.event_type} service={s} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>Maintenance History</h2>
          <button
            className="button button--primary"
            onClick={() => navigate(`/car/${id}/add-event`)}
          >
            + Add Event
          </button>
        </div>

        {events.length === 0 ? (
          <p className="text-muted">No maintenance events recorded yet.</p>
        ) : (
          <div className="timeline">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ServiceStatusCard({ service }: { service: ServiceDueStatus }) {
  return (
    <Card className="service-status-card">
      <div className="service-status-card__header">
        <span className="service-status-card__type">{eventTypeLabel(service.event_type)}</span>
        <span
          className={`urgency-badge urgency-badge--${service.urgency}`}
          style={{ color: urgencyColor(service.urgency) }}
        >
          {urgencyLabel(service.urgency)}
        </span>
      </div>
      <div className="service-status-card__details">
        {service.due_date && (
          <div className="service-status-card__row">
            <span>Due:</span>
            <span>{formatDate(service.due_date)}</span>
            {service.days_until_due != null && (
              <span className="text-muted">
                ({service.days_until_due > 0
                  ? `${service.days_until_due} days`
                  : `${Math.abs(service.days_until_due)} days ago`})
              </span>
            )}
          </div>
        )}
        {service.due_mileage != null && (
          <div className="service-status-card__row">
            <span>Due at:</span>
            <span>{service.due_mileage.toLocaleString()} km</span>
            {service.km_until_due != null && (
              <span className="text-muted">
                ({service.km_until_due > 0
                  ? `${service.km_until_due.toLocaleString()} km left`
                  : `${Math.abs(service.km_until_due).toLocaleString()} km overdue`})
              </span>
            )}
          </div>
        )}
        {service.last_date && (
          <div className="service-status-card__row">
            <span>Last:</span>
            <span>{formatDate(service.last_date)}</span>
            {service.last_mileage != null && (
              <span className="text-muted">at {service.last_mileage.toLocaleString()} km</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function EventCard({ event }: { event: MaintenanceEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="event-card"
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: 'pointer' }}
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
