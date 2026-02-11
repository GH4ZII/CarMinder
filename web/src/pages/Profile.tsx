import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as carApi from '@/api/cars';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ApiError } from '@/api/client';

export default function Profile() {
  const { user, getToken, signOut } = useAuth();
  const navigate = useNavigate();

  const [cars, setCars] = useState<carApi.CarInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regNumber, setRegNumber] = useState('');
  const [carInfo, setCarInfo] = useState<carApi.CarInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    async function fetchCars() {
      if (!user) return;
      const token = await getToken();
      if (!token) return;

      setLoading(true);
      setError(null);
      try {
        const data = await carApi.getUserCars(token);
        setCars(data);
      } catch (e: any) {
        setError(e?.message ?? 'Kunne ikke hente biler');
      } finally {
        setLoading(false);
      }
    }

    fetchCars();
  }, [user, getToken]);

async function handleLookup() {
  if (!regNumber.trim()) {
    setError('Skriv inn registreringsnummer');
    return;
  }
  setError(null);
  setLookupLoading(true);
  try {
    const car = await carApi.lookupVehicle(regNumber.trim());
    if (!car) {
      setError('Fant ingen bil med dette registreringsnummeret');
      setCarInfo(null);
      return;
    }
    setCarInfo(car);
  } catch (e: any) {
    setError(e?.message ?? 'Kunne ikke hente bilinfo');
  } finally {
    setLookupLoading(false);
  }
}

async function handleSaveCar() {
  if (!carInfo) return;
  const token = await getToken();
  if (!token) {
    setError('Fikk ikke tak i innloggingstoken. Logg inn på nytt.');
    return;
  }

  setSaving(true);
  setError(null);
  try {
    const saved = await carApi.saveCar(carInfo, token);
    setCars((prev) => [...prev, saved]);
    setCarInfo(null);
    setRegNumber('');
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 401) {
      await signOut();
      navigate('/login', { replace: true });
      return;
    }
    setError(e?.message ?? 'Kunne ikke lagre bil');
  } finally {
    setSaving(false);
  }
}

  

  return (
<main className="page profile-page">
  <header className="page-header">
    <h1>Profil</h1>
    <p>Innlogget som {user?.email}</p>
  </header>

  <section className="card">
    <h2>Legg til bil</h2>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleLookup();
      }}
      className="form"
    >
      <Input
        label="Registreringsnummer"
        value={regNumber}
        onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
        maxLength={7}
        disabled={lookupLoading || saving}
      />
      <Button type="submit" disabled={lookupLoading || saving}>
        {lookupLoading ? 'Søker…' : 'Hent bilinfo'}
      </Button>
    </form>

    {carInfo && (
      <div className="profile-car-preview">
        <h3>
          {carInfo.merke} {carInfo.modell} ({carInfo.registreringsnummer})
        </h3>
        {/* vis et lite sammendrag, ikke alt om du vil */}
        <Button onClick={handleSaveCar} disabled={saving}>
          {saving ? 'Lagrer…' : 'Lagre bil på profil'}
        </Button>
      </div>
    )}

    {error && <p className="form-error">{error}</p>}
  </section>

  <section className="card">
    <h2>Dine biler</h2>
    {loading ? (
      <p>Laster biler…</p>
    ) : cars.length === 0 ? (
      <p>Du har ikke lagt til noen biler enda.</p>
    ) : (
      <ul className="profile-car-list">
        {cars.map((car) => (
          <li key={car.id}>
            {car.merke} {car.modell} ({car.registreringsnummer})
          </li>
        ))}
      </ul>
    )}
  </section>
</main>
  );
}

