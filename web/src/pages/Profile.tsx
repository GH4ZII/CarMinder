import * as carsApi from '@/api/cars';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type { CarInfo } from '@/types/car';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, signOut, getToken } = useAuth();
  const navigate = useNavigate();

  const [cars, setCars] = useState<CarInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const userCars = await carsApi.getUserCars(token);
      setCars(userCars);
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
        signOut();
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(carId: string) {
    if (!window.confirm('Are you sure you want to delete this car?')) return;
    try {
      const token = await getToken();
      if (!token) return;
      await carsApi.deleteCar(carId, token);
      setCars((prev) => prev.filter((c) => c.id !== carId));
    } catch {
      alert('Failed to delete car');
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
      <h1>Profile</h1>

      <Card className="profile-info-card">
        <div className="profile-info">
          <div className="profile-avatar">
            {(user?.displayName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div>
            {user?.displayName && <h3>{user.displayName}</h3>}
            {user?.email && <p className="text-muted">{user.email}</p>}
          </div>
        </div>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign Out
        </Button>
      </Card>

      <section className="section">
        <div className="section-header">
          <h2>Your Cars</h2>
          <button className="button button--primary" onClick={() => navigate('/add-car')}>
            + Add Car
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner" />
        ) : cars.length === 0 ? (
          <p className="text-muted">No cars added yet.</p>
        ) : (
          <div className="car-list">
            {cars.map((car) => (
              <Card key={car.id} className="profile-car-card">
                <div className="profile-car-card__info">
                  <h3>
                    {car.merke} {car.modell}
                  </h3>
                  <p className="text-muted">
                    {car.registreringsnummer} &middot; {car.arsmodell} &middot;{' '}
                    {car.kilometer.toLocaleString()} km
                  </p>
                </div>
                <div className="profile-car-card__actions">
                  <button
                    className="button button--secondary button--sm"
                    onClick={() => navigate(`/car/${car.id}`)}
                  >
                    View Timeline
                  </button>
                  <button
                    className="button button--danger button--sm"
                    onClick={() => car.id && handleDelete(car.id)}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
