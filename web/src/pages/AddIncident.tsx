import * as carsApi from '@/api/cars';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const SEVERITY_FALLBACK = ['minor', 'moderate', 'severe'];
const REPAIR_STATUS_FALLBACK = ['not_repaired', 'partially_repaired', 'fully_repaired'];

const SEVERITY_LABELS: Record<string, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  severe: 'Severe',
};

const REPAIR_STATUS_LABELS: Record<string, string> = {
  not_repaired: 'Not repaired',
  partially_repaired: 'Partially repaired',
  fully_repaired: 'Fully repaired',
};

export default function AddIncident() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [severityLevels, setSeverityLevels] = useState<string[]>(SEVERITY_FALLBACK);
  const [repairStatuses, setRepairStatuses] = useState<string[]>(REPAIR_STATUS_FALLBACK);

  const [severity, setSeverity] = useState('minor');
  const [repairStatus, setRepairStatus] = useState('not_repaired');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairVendor, setRepairVendor] = useState('');
  const [mileage, setMileage] = useState('');
  const [insuranceClaim, setInsuranceClaim] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadIncidentTypes = useCallback(async () => {
    try {
      const types = await carsApi.getIncidentTypes();
      const loadedSeverity = types.severity_levels?.length ? types.severity_levels : SEVERITY_FALLBACK;
      const loadedRepairStatus = types.repair_statuses?.length
        ? types.repair_statuses
        : REPAIR_STATUS_FALLBACK;

      setSeverityLevels(loadedSeverity);
      setRepairStatuses(loadedRepairStatus);
      if (!loadedSeverity.includes(severity)) {
        setSeverity(loadedSeverity[0]);
      }
      if (!loadedRepairStatus.includes(repairStatus)) {
        setRepairStatus(loadedRepairStatus[0]);
      }
    } catch {
      setSeverityLevels(SEVERITY_FALLBACK);
      setRepairStatuses(REPAIR_STATUS_FALLBACK);
    }
  }, [repairStatus, severity]);

  useEffect(() => {
    loadIncidentTypes();
  }, [loadIncidentTypes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !incidentDate || !description.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const created = await carsApi.createIncident(id, token, {
        incident_date: incidentDate,
        severity,
        description: description.trim(),
        damage_description: damageDescription.trim() || null,
        repair_status: repairStatus,
        repair_cost: repairCost ? parseFloat(repairCost) : null,
        repair_vendor: repairVendor.trim() || null,
        insurance_claim: insuranceClaim,
        mileage: mileage ? parseInt(mileage, 10) : null,
      });

      if (files.length) {
        try {
          await carsApi.uploadIncidentImages(id, created.id, token, files);
        } catch (uploadErr) {
          const msg =
            uploadErr instanceof Error ? uploadErr.message : 'Photo upload failed';
          navigate(`/car/${id}`, {
            replace: true,
            state: {
              incidentImageUploadError: msg,
            },
          });
          return;
        }
      }

      navigate(`/car/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save incident');
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
        <h1>Report Incident</h1>
      </div>

      <Card className="add-event-card">
        <form onSubmit={handleSubmit} className="form">
          <div className="input-wrap">
            <label className="input-label">Severity</label>
            <div className="chip-group">
              {severityLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`chip ${severity === level ? 'chip--active' : ''}`}
                  onClick={() => setSeverity(level)}
                >
                  {SEVERITY_LABELS[level] ?? level}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Date"
            type="date"
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
            disabled={submitting}
          />

          <div className="input-wrap">
            <label htmlFor="description" className="input-label">
              What happened?
            </label>
            <textarea
              id="description"
              className="input textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the incident"
              rows={3}
              required
              disabled={submitting}
            />
          </div>

          <div className="input-wrap">
            <label htmlFor="damage-description" className="input-label">
              Damage Details
            </label>
            <textarea
              id="damage-description"
              className="input textarea"
              value={damageDescription}
              onChange={(e) => setDamageDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
              disabled={submitting}
            />
          </div>

          <div className="input-wrap">
            <label className="input-label">Repair Status</label>
            <div className="chip-group">
              {repairStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`chip ${repairStatus === status ? 'chip--active' : ''}`}
                  onClick={() => setRepairStatus(status)}
                >
                  {REPAIR_STATUS_LABELS[status] ?? status}
                </button>
              ))}
            </div>
          </div>

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
            label="Repair Cost (kr)"
            type="number"
            step="0.01"
            value={repairCost}
            onChange={(e) => setRepairCost(e.target.value)}
            placeholder="Optional"
            min={0}
            disabled={submitting}
          />

          <Input
            label="Repair Vendor"
            value={repairVendor}
            onChange={(e) => setRepairVendor(e.target.value)}
            placeholder="Optional"
            disabled={submitting}
          />

          <div className="input-wrap">
            <label className="input-label">Photos (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={submitting}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {files.map((f) => (
                  <img
                    key={`${f.name}-${f.size}-${f.lastModified}`}
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10 }}
                  />
                ))}
              </div>
            )}
          </div>

          <label className="incident-checkbox">
            <input
              type="checkbox"
              checked={insuranceClaim}
              onChange={(e) => setInsuranceClaim(e.target.checked)}
              disabled={submitting}
            />
            <span>Insurance claim filed</span>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting || !incidentDate || !description.trim()}>
            {submitting ? 'Saving...' : 'Save Incident'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
