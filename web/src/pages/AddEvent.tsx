import * as carsApi from '@/api/cars';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { eventTypeLabel } from '@/utils/format';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function AddEvent() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadEventTypes = useCallback(async () => {
    try {
      const types = await carsApi.getEventTypes();
      setEventTypes(types);
      if (types.length > 0 && !eventType) {
        setEventType(types[0]);
      }
    } catch {
      setEventTypes([
        'oil_change',
        'brake_service',
        'tire_change',
        'inspection',
        'repair',
        'other',
      ]);
      if (!eventType) setEventType('oil_change');
    }
  }, [eventType]);

  useEffect(() => {
    loadEventTypes();
  }, [loadEventTypes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !eventType || !eventDate) return;

    setError(null);
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }
      await carsApi.createMaintenanceEvent(id, token, {
        event_type: eventType,
        event_date: eventDate,
        mileage: mileage ? parseInt(mileage, 10) : null,
        cost: cost ? parseFloat(cost) : null,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
      });
      navigate(`/car/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(`/car/${id}`)}>
          &larr; Back
        </button>
        <h1>Add Maintenance Event</h1>
      </div>

      <Card className="add-event-card">
        <form onSubmit={handleSubmit} className="form">
          <div className="input-wrap">
            <label className="input-label">Event Type</label>
            <div className="chip-group">
              {eventTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${eventType === t ? 'chip--active' : ''}`}
                  onClick={() => setEventType(t)}
                >
                  {eventTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
            disabled={submitting}
          />

          <Input
            label="Mileage (km)"
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="Optional"
            min={0}
            disabled={submitting}
          />

          <Input
            label="Cost (kr)"
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Optional"
            min={0}
            disabled={submitting}
          />

          <Input
            label="Vendor / Workshop"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Optional"
            disabled={submitting}
          />

          <div className="input-wrap">
            <label htmlFor="notes" className="input-label">
              Notes
            </label>
            <textarea
              id="notes"
              className="input textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting || !eventType || !eventDate}>
            {submitting ? 'Saving...' : 'Save Event'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
