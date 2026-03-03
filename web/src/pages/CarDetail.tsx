import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CarCareScoreResponse,
  CarInfo,
  CarServiceStatus,
  MaintenanceEvent,
  OwnershipTwinResponse,
  ServiceDueStatus,
} from '@/types/car';
import {
  eventTypeLabel,
  formatCurrency,
  formatDate,
  urgencyColor,
  urgencyLabel,
} from '@/utils/format';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759',
  B: '#30D158',
  C: '#FF9500',
  D: '#FF6B00',
  F: '#FF3B30',
};

export default function CarDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken, signOut } = useAuth();
  const navigate = useNavigate();

  const [car, setCar] = useState<CarInfo | null>(null);
  const [serviceStatus, setServiceStatus] = useState<CarServiceStatus | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [careScore, setCareScore] = useState<CarCareScoreResponse | null>(null);
  const [twinAction, setTwinAction] = useState<'delay' | 'do_now'>('delay');
  const [twinEventType, setTwinEventType] = useState('oil_change');
  const [twinDelayDays, setTwinDelayDays] = useState(60);
  const [twinMonthlyKm, setTwinMonthlyKm] = useState(1200);
  const [twinLoading, setTwinLoading] = useState(false);
  const [twinError, setTwinError] = useState<string | null>(null);
  const [twinResult, setTwinResult] = useState<OwnershipTwinResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [carData, statusData, eventsData, scoreData] = await Promise.all([
        carsApi.getCar(id, token),
        carsApi.getCarServiceStatus(id, token).catch(() => null),
        carsApi.getMaintenanceEvents(id, token).catch(() => [] as MaintenanceEvent[]),
        carsApi.getCarCareScore(id, token).catch(() => null),
      ]);
      setCar(carData);
      setServiceStatus(statusData);
      setEvents(eventsData.sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setCareScore(scoreData);
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

  async function runOwnershipTwin() {
    if (!id) return;
    setTwinLoading(true);
    setTwinError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await carsApi.getOwnershipTwin(id, token, {
        action: twinAction,
        event_type: twinEventType,
        delay_days: twinDelayDays,
        monthly_km: twinMonthlyKm,
      });
      setTwinResult(result);
    } catch (err) {
      setTwinError(err instanceof Error ? err.message : 'Failed to run simulation');
      setTwinResult(null);
    } finally {
      setTwinLoading(false);
    }
  }

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

      {/* Car Care Score Card */}
      {careScore && <CarCareScoreCard data={careScore} />}

      <section className="section section--card ownership-twin-card">
        <div className="ownership-twin-card__header">
          <h2>Ownership Twin</h2>
          <p>Simulate maintenance choices before committing.</p>
        </div>

        <div className="ownership-twin-form">
          <div className="input-wrap">
            <label className="input-label">Service Type</label>
            <select
              className="input"
              value={twinEventType}
              onChange={(e) => setTwinEventType(e.target.value)}
            >
              <option value="oil_change">Oil change</option>
              <option value="brake_service">Brake service</option>
              <option value="tire_change">Tire change</option>
              <option value="inspection">Inspection</option>
              <option value="repair">Repair</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="ownership-twin-form__actions">
            <button
              className={`button ${twinAction === 'delay' ? 'button--primary' : 'button--secondary'}`}
              onClick={() => setTwinAction('delay')}
            >
              Delay service
            </button>
            <button
              className={`button ${twinAction === 'do_now' ? 'button--primary' : 'button--secondary'}`}
              onClick={() => setTwinAction('do_now')}
            >
              Do it now
            </button>
          </div>

          {twinAction === 'delay' && (
            <div className="ownership-twin-form__grid">
              <div className="input-wrap">
                <label className="input-label">Delay (days)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={365}
                  value={twinDelayDays}
                  onChange={(e) => setTwinDelayDays(Number(e.target.value) || 60)}
                />
              </div>
              <div className="input-wrap">
                <label className="input-label">Monthly km</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={10000}
                  value={twinMonthlyKm}
                  onChange={(e) => setTwinMonthlyKm(Number(e.target.value) || 1200)}
                />
              </div>
            </div>
          )}

          <button className="button button--accent ownership-twin-form__run" onClick={runOwnershipTwin}>
            {twinLoading ? 'Running simulation...' : 'Run simulation'}
          </button>
        </div>

        {twinError && <div className="error-banner">{twinError}</div>}

        {twinResult && (
          <div className="ownership-twin-result">
            <p className="ownership-twin-result__narrative">{twinResult.narrative}</p>
            <div className="ownership-twin-result__scores">
              <div>
                <span className="ownership-twin-result__label">Baseline</span>
                <strong>{twinResult.baseline.overall_score} ({twinResult.baseline.grade})</strong>
              </div>
              <div>
                <span className="ownership-twin-result__label">Projected</span>
                <strong>{twinResult.projected.overall_score} ({twinResult.projected.grade})</strong>
              </div>
              <div>
                <span className="ownership-twin-result__label">Delta</span>
                <strong>{twinResult.score_delta > 0 ? `+${twinResult.score_delta}` : twinResult.score_delta}</strong>
              </div>
            </div>

            <div className="ownership-twin-result__urgency">
              Urgency: {twinResult.baseline_urgency ?? 'unknown'} → {twinResult.projected_urgency ?? 'unknown'}
              <span className="ownership-twin-result__source">{twinResult.explanation_source === 'llm' ? 'LLM explanation' : 'Rule-based explanation'}</span>
            </div>

            {twinResult.projected_recommendations.length > 0 && (
              <ul className="ownership-twin-result__recs">
                {twinResult.projected_recommendations.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

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
          <div className="empty-state empty-state--compact">
            <p>No maintenance events recorded yet.</p>
            <button
              className="button button--primary"
              onClick={() => navigate(`/car/${id}/add-event`)}
            >
              + Add Your First Event
            </button>
          </div>
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

/* ── Car Care Score Card ─────────────────────────────────── */

function CarCareScoreCard({ data }: { data: CarCareScoreResponse }) {
  const [expanded, setExpanded] = useState(false);
  const color = GRADE_COLORS[data.grade] ?? '#64748b';
  const cats = data.categories;
  const categoryList = [
    cats.maintenance_regularity,
    cats.eu_inspection,
    cats.incident_history,
    cats.mileage_tracking,
    cats.documentation_quality,
  ];

  return (
    <Card
      className="score-card"
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: 'pointer' }}
    >
      <div className="score-card__top">
        <div className="score-ring" style={{ borderColor: color }}>
          <span className="score-ring__grade" style={{ color }}>
            {data.grade}
          </span>
          <span className="score-ring__number" style={{ color }}>
            {data.overall_score}
          </span>
        </div>
        <div className="score-card__summary">
          <h3 className="score-card__title">Car Care Score</h3>
          <p className="score-card__text">{data.summary}</p>
          <span className="score-card__confidence">
            Confidence: {data.confidence_label.replace(/_/g, ' ')}
          </span>
        </div>
        <span className={`score-card__chevron${expanded ? ' score-card__chevron--open' : ''}`}>
          &#9662;
        </span>
      </div>

      {expanded && (
        <div className="score-card__details">
          <div className="score-card__divider" />
          {categoryList.map((cat) => (
            <div key={cat.label} className="score-category">
              <div className="score-category__header">
                <span className="score-category__label">{cat.label}</span>
                <span className="score-category__value">{cat.score}/100</span>
              </div>
              <div className="score-category__bar-bg">
                <div
                  className="score-category__bar-fill"
                  style={{
                    width: `${cat.score}%`,
                    backgroundColor:
                      cat.score >= 75 ? '#34C759' : cat.score >= 50 ? '#FF9500' : '#FF3B30',
                  }}
                />
              </div>
            </div>
          ))}

          {data.recommendations.length > 0 && (
            <>
              <div className="score-card__divider" />
              <h4 className="score-card__recs-title">Recommendations</h4>
              <ul className="score-card__recs">
                {data.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Service Status Card ─────────────────────────────────── */

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

/* ── Event Card ──────────────────────────────────────────── */

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
