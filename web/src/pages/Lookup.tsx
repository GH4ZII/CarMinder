import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import type { PublicCarHistory } from '@/types/car';
import { eventTypeLabel, formatDate } from '@/utils/format';
import { useState } from 'react';

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

export default function Lookup() {
  const [regNumber, setRegNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<PublicCarHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const reg = regNumber.trim().toUpperCase();
    if (!reg) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    setError(null);
    try {
      const data = await carsApi.getPublicHistory(reg);
      setResult(data);
    } catch {
      setError('Failed to look up car history.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page page--app-theme">
      <h1>Car History Lookup</h1>
      <p className="lookup-subtitle">
        Search by registration number. Results appear only when the owner has enabled public history.
      </p>

      <div className="lookup-search-row">
        <input
          className="input lookup-search-input"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
          placeholder="e.g. AB12345"
          maxLength={8}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSearch();
            }
          }}
        />
        <button
          className="button button--primary"
          type="button"
          onClick={() => void handleSearch()}
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {searched && !loading && !error && !result && (
        <div className="empty-state empty-state--compact">
          <p>
            No public history found. The car may not exist or the owner has chosen to keep
            history private.
          </p>
        </div>
      )}

      {result && (
        <div className="lookup-results">
          <Card>
            <h2 className="lookup-car-title">
              {result.car.merke} {result.car.modell}
            </h2>
            <p className="lookup-car-meta">
              {result.car.registreringsnummer} · {result.car.arsmodell} · {result.car.farge}
            </p>
            <p className="lookup-car-meta">{result.car.kilometer.toLocaleString()} km</p>
          </Card>

          <section className="section">
            <h2>Incident Reports ({result.incident_reports.length})</h2>
            {result.incident_reports.length === 0 ? (
              <p className="text-muted">No incidents reported.</p>
            ) : (
              <div className="incident-list">
                {result.incident_reports.map((incident, index) => (
                  <Card key={`${incident.incident_date}-${index}`} className="incident-card">
                    <div className="incident-card__header">
                      <span
                        className="incident-card__severity"
                        style={{
                          backgroundColor: SEVERITY_COLORS[incident.severity] ?? '#64748b',
                        }}
                      >
                        {incident.severity.toUpperCase()}
                      </span>
                      <span className="incident-card__date">{formatDate(incident.incident_date)}</span>
                    </div>
                    <p className="incident-card__description">{incident.description}</p>
                    {incident.damage_description && (
                      <p className="incident-card__damage">Damage: {incident.damage_description}</p>
                    )}
                    <div className="incident-card__meta">
                      <span>
                        Repair:{' '}
                        {REPAIR_STATUS_LABELS[incident.repair_status] ?? incident.repair_status}
                      </span>
                      {incident.mileage != null && (
                        <span>{incident.mileage.toLocaleString()} km</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Maintenance History ({result.maintenance_events.length})</h2>
            {result.maintenance_events.length === 0 ? (
              <p className="text-muted">No maintenance events recorded.</p>
            ) : (
              <div className="timeline">
                {result.maintenance_events.map((evt, index) => (
                  <Card key={`${evt.event_date}-${evt.event_type}-${index}`} className="event-card">
                    <div className="event-card__header">
                      <div className="event-card__type-date">
                        <span className="event-card__type">{eventTypeLabel(evt.event_type)}</span>
                        <span className="event-card__date">{formatDate(evt.event_date)}</span>
                      </div>
                    </div>
                    <div className="event-card__tags">
                      {evt.mileage != null && <span className="tag">{evt.mileage.toLocaleString()} km</span>}
                      {evt.vendor && <span className="tag">{evt.vendor}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
