import { ApiError } from '@/api/client';
import * as carsApi from '@/api/cars';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import type { CarInfo } from '@/types/car';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AddCar() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [regNumber, setRegNumber] = useState('');
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'generic' | 'already_registered' | 'retired'>('generic');
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    if (!regNumber.trim()) return;
    setError(null);
    setErrorType('generic');
    setCarInfo(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await carsApi.lookupVehicle(regNumber.trim().toUpperCase());
      if (!result) {
        setError('No vehicle found for this registration number.');
        return;
      }
      setCarInfo(result);
    } catch {
      setError('Failed to look up vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!carInfo) return;
    setSaving(true);
    setError(null);
    setErrorType('generic');
    setSuccess(null);

    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }
      await carsApi.saveCar(carInfo, token);
      setSuccess('Car saved successfully!');
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save car';
      setError(msg);
      if (err instanceof ApiError && err.detail) {
        if (err.detail.includes('retired')) {
          setErrorType('retired');
        } else if (err.detail.includes('already registered')) {
          setErrorType('already_registered');
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page--app-theme">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
        <h1>Add Car</h1>
      </div>

      <Card className="lookup-card">
        <form onSubmit={handleLookup} className="lookup-form">
          <Input
            label="Registration Number"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
            placeholder="e.g. AB12345"
            maxLength={7}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !regNumber.trim()}>
            {loading ? 'Searching...' : 'Look Up Vehicle'}
          </Button>
        </form>
      </Card>

      {error && (
        <div className={`save-error-banner save-error-banner--${errorType}`}>
          <div className="save-error-banner__icon">
            {errorType === 'retired' ? '⛔' : errorType === 'already_registered' ? '🔗' : '⚠️'}
          </div>
          <div className="save-error-banner__content">
            <p className="save-error-banner__message">{error}</p>
            {errorType === 'already_registered' && (
              <button
                className="button button--outline button--sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => navigate('/', { state: { openClaim: true } })}
              >
                Claim a Car with Transfer Code
              </button>
            )}
          </div>
        </div>
      )}
      {success && <div className="success-banner">{success}</div>}

      {carInfo && (
        <Card className="car-info-card">
          <h2>
            {carInfo.merke} {carInfo.modell} ({carInfo.arsmodell})
          </h2>

          <div className="car-info-sections">
            <InfoSection title="Basic Information">
              <InfoRow label="Registration" value={carInfo.registreringsnummer} />
              <InfoRow label="Brand" value={carInfo.merke} />
              <InfoRow label="Model" value={carInfo.modell} />
              <InfoRow label="Year" value={carInfo.arsmodell} />
              <InfoRow label="Color" value={carInfo.farge} />
              <InfoRow label="First Registered" value={carInfo.forstegangregistrert} />
              <InfoRow label="Body Type" value={carInfo.karosseri} />
              <InfoRow label="Doors" value={String(carInfo.antalldorer)} />
              <InfoRow label="Seats" value={String(carInfo.antallseter)} />
            </InfoSection>

            <InfoSection title="Engine & Performance">
              <InfoRow label="Fuel" value={carInfo.drivstoff} />
              <InfoRow label="Transmission" value={carInfo.girkasse} />
              <InfoRow label="Power" value={`${carInfo.motoreffekt} kW`} />
              <InfoRow label="Engine Size" value={`${carInfo.slagvolum} cc`} />
              <InfoRow label="Max Speed" value={`${carInfo.makshastighet} km/h`} />
            </InfoSection>

            <InfoSection title="Environment">
              <InfoRow label="CO2 Emissions" value={`${carInfo.co2utslipp} g/km`} />
              <InfoRow label="Fuel Consumption" value={`${carInfo.forbruk} l/100km`} />
            </InfoSection>

            <InfoSection title="Weight">
              <InfoRow label="Curb Weight" value={`${carInfo.egenvekt} kg`} />
              <InfoRow label="Max Weight" value={`${carInfo.totalvekt} kg`} />
            </InfoSection>

            <InfoSection title="Other">
              <InfoRow label="Chassis" value={carInfo.chassisnummer} />
              <InfoRow label="EU Control Due" value={carInfo.eukontrollfrist} />
            </InfoSection>
          </div>

          <Button onClick={handleSave} disabled={saving} className="save-car-btn">
            {saving ? 'Saving...' : 'Save Car to Your Profile'}
          </Button>
        </Card>
      )}
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="info-section">
      <h3>{title}</h3>
      <div className="info-rows">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '0' || value === 'undefined') return null;
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}
