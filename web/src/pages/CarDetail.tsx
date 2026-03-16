import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CarCareScoreResponse,
  CarInfo,
  CarServiceStatus,
  MaintenanceEvent,
  ObdReadingResponse,
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
  const [obdReading, setObdReading] = useState<ObdReadingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [carData, statusData, eventsData, scoreData, obdData] = await Promise.all([
        carsApi.getCar(id, token),
        carsApi.getCarServiceStatus(id, token).catch(() => null),
        carsApi.getMaintenanceEvents(id, token).catch(() => [] as MaintenanceEvent[]),
        carsApi.getCarCareScore(id, token).catch(() => null),
        carsApi.getLatestObdReading(id, token).catch(() => null),
      ]);
      setCar(carData);
      setServiceStatus(statusData);
      setEvents(eventsData.sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setCareScore(scoreData);
      setObdReading(obdData);
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

  const handleExportPdf = useCallback(async () => {
    if (!id) return;
    setExporting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const blob = await carsApi.getCarReportPdf(id, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `car-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF', err);
      setError('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }, [id, getToken]);

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
        <button
          className="button button--primary"
          onClick={handleExportPdf}
          disabled={exporting}
        >
          {exporting ? 'Generating…' : 'Export PDF'}
        </button>
      </div>

      {/* Car Care Score Card */}
      {careScore && <CarCareScoreCard data={careScore} />}

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

      {obdReading && <ObdDiagnosticsCard reading={obdReading} />}

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

/* ── OBD Diagnostics Card ────────────────────────────────── */

function ObdDiagnosticsCard({ reading }: { reading: ObdReadingResponse }) {
  const fmtVal = (v: number | null, unit: string) =>
    v == null ? '\u2014' : `${v.toLocaleString()} ${unit}`.trim();

  return (
    <section className="section">
      <h2>OBD-II Diagnostics</h2>
      <Card className="obd-card">
        <div className="obd-card__header">
          <span className="obd-card__title">
            Latest Reading {reading.source === 'simulated' ? '(Demo)' : '(Device)'}
          </span>
          <span className="obd-card__date">{formatDate(reading.captured_at)}</span>
        </div>
        <div className="obd-card__metrics">
          <div className="obd-metric">
            <span className="obd-metric__label">RPM</span>
            <span className="obd-metric__value">{fmtVal(reading.rpm, '')}</span>
          </div>
          <div className="obd-metric">
            <span className="obd-metric__label">Coolant</span>
            <span className="obd-metric__value">{fmtVal(reading.coolant_temp_c, '\u00B0C')}</span>
          </div>
          <div className="obd-metric">
            <span className="obd-metric__label">Speed</span>
            <span className="obd-metric__value">{fmtVal(reading.speed_kph, 'km/h')}</span>
          </div>
          <div className="obd-metric">
            <span className="obd-metric__label">Engine Load</span>
            <span className="obd-metric__value">{fmtVal(reading.engine_load_pct, '%')}</span>
          </div>
          <div className="obd-metric">
            <span className="obd-metric__label">Battery</span>
            <span className="obd-metric__value">{fmtVal(reading.battery_voltage, 'V')}</span>
          </div>
        </div>
        <div className="obd-card__dtcs">
          <h4>Error Codes ({reading.dtcs.length})</h4>
          {reading.dtcs.length === 0 ? (
            <p className="text-muted">No stored trouble codes.</p>
          ) : (
            reading.dtcs.map((dtc) => (
              <div key={dtc.code} className="obd-dtc">
                <span className="obd-dtc__code">{dtc.code}</span>
                <span className="obd-dtc__desc">{dtc.description}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </section>
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
