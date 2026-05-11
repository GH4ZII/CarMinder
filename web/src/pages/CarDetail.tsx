import * as carsApi from '@/api/cars';
import { ApiError } from '@/api/client';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CarCareScoreResponse,
  CarInfo,
  CarServiceStatus,
  IncidentReport,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759',
  B: '#30D158',
  C: '#FF9500',
  D: '#FF6B00',
  F: '#FF3B30',
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: '#64748b',
  moderate: '#FF9500',
  severe: '#FF3B30',
};

const REPAIR_STATUS_LABELS: Record<string, string> = {
  not_repaired: 'Not repaired',
  partially_repaired: 'Partially repaired',
  fully_repaired: 'Fully repaired',
};

type CarDetailLocationState = {
  incidentImageUploadError?: string;
};

export default function CarDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [car, setCar] = useState<CarInfo | null>(null);
  const [serviceStatus, setServiceStatus] = useState<CarServiceStatus | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [careScore, setCareScore] = useState<CarCareScoreResponse | null>(null);
  const [obdReading, setObdReading] = useState<ObdReadingResponse | null>(null);
  const [obdReadings, setObdReadings] = useState<ObdReadingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [incidentImageUploadWarning, setIncidentImageUploadWarning] = useState<string | null>(null);

  useEffect(() => {
    const msg = (location.state as CarDetailLocationState | null)?.incidentImageUploadError;
    if (!msg) return;
    setIncidentImageUploadWarning(msg);
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [carData, statusData, eventsData, incidentsData, scoreData, obdData, obdHistory] = await Promise.all([
        carsApi.getCar(id, token),
        carsApi.getCarServiceStatus(id, token).catch(() => null),
        carsApi.getMaintenanceEvents(id, token).catch(() => [] as MaintenanceEvent[]),
        carsApi.getIncidents(id, token).catch(() => [] as IncidentReport[]),
        carsApi.getCarCareScore(id, token).catch(() => null),
        carsApi.getLatestObdReading(id, token).catch(() => null),
        carsApi.getObdReadings(id, token, 80).catch(() => [] as ObdReadingResponse[]),
      ]);
      setCar(carData);
      setServiceStatus(statusData);
      setEvents(eventsData.sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setIncidents(incidentsData.sort((a, b) => b.incident_date.localeCompare(a.incident_date)));
      setCareScore(scoreData);
      setObdReading(obdData);
      setObdReadings(obdHistory);
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
    setExportError(null);
    setExporting(true);
    try {
      const token = await getToken();
      if (!token) {
        setExportError('Please sign in to export PDF.');
        return;
      }
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
      const rawMessage =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to export PDF';
      const isNetworkError =
        rawMessage === 'Failed to fetch' ||
        rawMessage === 'NetworkError when attempting to fetch resource.' ||
        (err instanceof TypeError && rawMessage.includes('fetch'));
      const message = isNetworkError
        ? 'Could not reach the server. If using a remote API (e.g. Railway), set VITE_API_URL in web/.env and restart. Otherwise ensure the backend is running (e.g. http://localhost:8000).'
        : rawMessage;
      setExportError(message);
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
  const effectiveObdReadings = obdReadings.length > 0 ? obdReadings : obdReading ? [obdReading] : [];

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

      {exportError && (
        <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ flex: 1 }}>{exportError}</span>
          <button
            type="button"
            className="link-button"
            style={{ flexShrink: 0 }}
            onClick={() => setExportError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {incidentImageUploadWarning && (
        <div
          className="error-banner"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff8e6', borderColor: '#f5d90a' }}
        >
          <span style={{ flex: 1 }}>
            <strong>Incident saved</strong>, but photos did not upload: {incidentImageUploadWarning}
          </span>
          <button
            type="button"
            className="link-button"
            style={{ flexShrink: 0 }}
            onClick={() => setIncidentImageUploadWarning(null)}
          >
            Dismiss
          </button>
        </div>
      )}

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

      {effectiveObdReadings.length > 0 && (
        <ObdDiagnosticsCard reading={obdReading ?? effectiveObdReadings[0]} readings={effectiveObdReadings} />
      )}

      <section className="section">
        <div className="section-header">
          <h2>Incidents</h2>
          <button
            className="button button--primary"
            onClick={() => navigate(`/car/${id}/add-incident`)}
          >
            + Report Incident
          </button>
        </div>

        {incidents.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <p>No incidents reported.</p>
          </div>
        ) : (
          <div className="incident-list">
            {incidents.map((incident) => (
              <IncidentCard key={incident.id} carId={id!} incident={incident} />
            ))}
          </div>
        )}
      </section>

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

type ObdMetricChartProps = {
  readings: ObdReadingResponse[];
  field:
    | 'rpm'
    | 'coolant_temp_c'
    | 'speed_kph'
    | 'engine_load_pct'
    | 'fuel_consumption_l_100km'
    | 'fuel_rate_lph'
    | 'mass_air_flow_gps';
  label: string;
  unit: string;
  color: string;
};

function ObdMetricChart({ readings, field, label, unit, color }: ObdMetricChartProps) {
  const data = useMemo(
    () =>
      [...readings]
        .reverse()
        .filter((item) => item[field] != null)
        .map((item) => ({
          date: item.captured_at,
          value: item[field] as number,
        })),
    [field, readings]
  );

  if (data.length < 2) {
    return (
      <div className="obd-chart">
        <div className="obd-chart__header">
          <span className="obd-chart__label">{label}</span>
          <span className="obd-chart__unit">{unit}</span>
        </div>
        <div className="obd-chart__empty">Not enough readings yet</div>
      </div>
    );
  }

  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 420;
  const height = 150;
  const left = 42;
  const right = 14;
  const top = 18;
  const bottom = 28;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const points = data.map((item, index) => ({
    x: left + (index / (data.length - 1)) * plotW,
    y: top + plotH - ((item.value - min) / range) * plotH,
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${points[points.length - 1].x} ${top + plotH} L ${points[0].x} ${top + plotH} Z`;
  const ticks = [min, (min + max) / 2, max];
  const firstDate = formatShortDate(data[0].date);
  const lastDate = formatShortDate(data[data.length - 1].date);

  return (
    <div className="obd-chart">
      <div className="obd-chart__header">
        <span className="obd-chart__label">{label}</span>
        <span className="obd-chart__unit">{unit}</span>
      </div>
      <svg className="obd-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} trend`}>
        {ticks.map((tick, index) => {
          const y = top + plotH - ((tick - min) / range) * plotH;
          return (
            <g key={`${label}-tick-${index}`}>
              <line x1={left} y1={y} x2={left + plotW} y2={y} className="obd-chart__grid" />
              <text x={left - 8} y={y + 4} textAnchor="end" className="obd-chart__tick">
                {formatCompact(tick)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={color} opacity="0.10" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[0].x} cy={points[0].y} r="3" fill={color} />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
        <text x={points[0].x} y={height - 8} textAnchor="middle" className="obd-chart__tick">
          {firstDate}
        </text>
        <text x={points[points.length - 1].x} y={height - 8} textAnchor="middle" className="obd-chart__tick">
          {lastDate}
        </text>
      </svg>
    </div>
  );
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatShortDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function ObdDiagnosticsCard({ reading, readings }: { reading: ObdReadingResponse; readings: ObdReadingResponse[] }) {
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
            <span className="obd-metric__value">{fmtVal(reading.coolant_temp_c, '°C')}</span>
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
          <div className="obd-metric">
            <span className="obd-metric__label">Fuel Use</span>
            <span className="obd-metric__value">{fmtVal(reading.fuel_consumption_l_100km, 'L/100km')}</span>
          </div>
          <div className="obd-metric">
            <span className="obd-metric__label">Fuel Rate</span>
            <span className="obd-metric__value">{fmtVal(reading.fuel_rate_lph, 'L/h')}</span>
          </div>
          <div className="obd-metric">
            <span className="obd-metric__label">MAF</span>
            <span className="obd-metric__value">{fmtVal(reading.mass_air_flow_gps, 'g/s')}</span>
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
        <div className="obd-card__trends">
          <div className="obd-card__trends-header">
            <h4>Trends ({readings.length} readings)</h4>
            <span className="text-muted">Time-series from saved OBD polls</span>
          </div>
          <div className="obd-chart-grid">
            <ObdMetricChart readings={readings} field="rpm" label="RPM" unit="rev/min" color="#2DD4BF" />
            <ObdMetricChart readings={readings} field="coolant_temp_c" label="Coolant Temperature" unit="°C" color="#34C759" />
            <ObdMetricChart readings={readings} field="speed_kph" label="Speed" unit="km/h" color="#2DD4BF" />
            <ObdMetricChart readings={readings} field="engine_load_pct" label="Engine Load" unit="%" color="#FF9500" />
            <ObdMetricChart readings={readings} field="fuel_consumption_l_100km" label="Fuel Consumption" unit="L/100km" color="#5856D6" />
            <ObdMetricChart readings={readings} field="fuel_rate_lph" label="Fuel Rate" unit="L/h" color="#0A84FF" />
            <ObdMetricChart readings={readings} field="mass_air_flow_gps" label="Mass Air Flow" unit="g/s" color="#FF2D55" />
          </div>
        </div>
      </Card>
    </section>
  );
}

/* ── Event Card ──────────────────────────────────────────── */

function EventCard({ event }: { event: MaintenanceEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="timeline-item">
      <div className="timeline-item__dot" />
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
    </div>
  );
}

function IncidentCard({ carId, incident }: { carId: string; incident: IncidentReport }) {
  const { getToken } = useAuth();
  const severityColor = SEVERITY_COLORS[incident.severity] ?? '#64748b';
  const photoCount = incident.images?.length ?? 0;

  const [viewerOpen, setViewerOpen] = useState(false);
  const [images, setImages] = useState<{ id: string; url?: string | null }[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const openViewer = useCallback(async () => {
    setViewerOpen(true);
    setPhotoError(null);
    setLoadingPhotos(true);
    setImages([]);
    try {
      const token = await getToken();
      if (!token) {
        setPhotoError('Not signed in');
        return;
      }
      const imgs = await carsApi.listIncidentImages(carId, incident.id, token);
      setImages(imgs.filter((i) => Boolean(i.url)));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not load photos');
    } finally {
      setLoadingPhotos(false);
    }
  }, [carId, getToken, incident.id]);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen]);

  return (
    <>
      <Card
        className="incident-card incident-card--interactive"
        onClick={openViewer}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void openViewer();
          }
        }}
        aria-label="View incident details and photos"
      >
        <div className="incident-card__header">
          <span className="incident-card__severity" style={{ backgroundColor: severityColor }}>
            {incident.severity.toUpperCase()}
          </span>
          <span className="incident-card__date">{formatDate(incident.incident_date)}</span>
        </div>
        <p className="incident-card__description">{incident.description}</p>

        <div className="incident-card__meta">
          <span>Repair: {REPAIR_STATUS_LABELS[incident.repair_status] ?? incident.repair_status}</span>
          {incident.mileage != null && <span>{incident.mileage.toLocaleString()} km</span>}
          {incident.repair_cost_cents != null && <span>{formatCurrency(incident.repair_cost_cents)}</span>}
          {incident.repair_vendor && <span>{incident.repair_vendor}</span>}
          {incident.insurance_claim && <span>Insurance claim filed</span>}
          {photoCount > 0 ? (
            <span className="incident-card__photo-badge">{photoCount} photo{photoCount === 1 ? '' : 's'}</span>
          ) : (
            <span className="incident-card__tap-hint">Tap for details</span>
          )}
        </div>

        {incident.damage_description && (
          <p className="incident-card__damage">
            Damage: {incident.damage_description}
          </p>
        )}
      </Card>

      {viewerOpen && (
        <div
          className="incident-photo-modal-backdrop"
          onClick={() => setViewerOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setViewerOpen(false)}
          role="presentation"
        >
          <div
            className="incident-photo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-photo-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="incident-photo-modal__top">
              <h3 id="incident-photo-modal-title" className="incident-photo-modal__title">
                {formatDate(incident.incident_date)} — {incident.description.slice(0, 80)}
                {incident.description.length > 80 ? '…' : ''}
              </h3>
              <button
                type="button"
                className="incident-photo-modal__close"
                onClick={() => setViewerOpen(false)}
              >
                Close
              </button>
            </div>
            {loadingPhotos && <p className="incident-photo-modal__status">Loading photos…</p>}
            {photoError && <p className="incident-photo-modal__error">{photoError}</p>}
            {!loadingPhotos && !photoError && images.length === 0 && (
              <p className="incident-photo-modal__status">No photos for this incident.</p>
            )}
            {images.length > 0 && (
              <div className="incident-photo-modal__grid">
                {images.map((img) =>
                  img.url ? (
                    <a
                      key={img.id}
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="incident-photo-modal__link"
                    >
                      <img src={img.url} alt="" className="incident-photo-modal__thumb" />
                    </a>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
