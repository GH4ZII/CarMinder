import * as carsApi from '@/api/cars';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type { CarCareScoreResponse, CarInfo } from '@/types/car';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759',
  B: '#30D158',
  C: '#FF9500',
  D: '#FF6B00',
  F: '#FF3B30',
};

export default function Profile() {
  const { user, signOut, getToken, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [cars, setCars] = useState<CarInfo[]>([]);
  const [scores, setScores] = useState<Record<string, CarCareScoreResponse>>({});
  const [loading, setLoading] = useState(true);
  const [editingMileage, setEditingMileage] = useState<string | null>(null);
  const [mileageValue, setMileageValue] = useState('');
  const [savingMileage, setSavingMileage] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const userCars = await carsApi.getUserCars(token);
      setCars(userCars);

      // Fetch scores for all cars in parallel (fault-tolerant)
      const scoreEntries = await Promise.allSettled(
        userCars
          .filter((c) => c.id)
          .map(async (c) => {
            const s = await carsApi.getCarCareScore(c.id!, token);
            return [c.id!, s] as const;
          })
      );
      const scoreMap: Record<string, CarCareScoreResponse> = {};
      for (const entry of scoreEntries) {
        if (entry.status === 'fulfilled') {
          scoreMap[entry.value[0]] = entry.value[1];
        }
      }
      setScores(scoreMap);
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

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  async function handleDelete(carId: string) {
    if (!window.confirm('Are you sure you want to delete this car? This cannot be undone.')) return;
    try {
      const token = await getToken();
      if (!token) return;
      await carsApi.deleteCar(carId, token);
      setCars((prev) => prev.filter((c) => c.id !== carId));
    } catch {
      alert('Failed to delete car');
    }
  }

  async function handleTogglePublic(carId: string, currentValue: boolean) {
    setTogglingPublic(carId);
    try {
      const token = await getToken();
      if (!token) return;
      const updated = await carsApi.updateCar(carId, token, { public_history: !currentValue });
      setCars((prev) => prev.map((c) => (c.id === carId ? updated : c)));
    } catch {
      alert('Failed to update visibility setting');
    } finally {
      setTogglingPublic(null);
    }
  }

  async function handleSaveMileage(carId: string) {
    const km = parseInt(mileageValue, 10);
    if (isNaN(km) || km < 0) {
      alert('Please enter a valid mileage');
      return;
    }
    setSavingMileage(true);
    try {
      const token = await getToken();
      if (!token) return;
      const updated = await carsApi.updateKilometer(carId, token, { kilometer: km });
      setCars((prev) => prev.map((c) => (c.id === carId ? updated : c)));
      setEditingMileage(null);
      setMileageValue('');
    } catch {
      alert('Failed to update mileage');
    } finally {
      setSavingMileage(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  async function handleSaveProfile() {
    const nextName = displayName.trim();
    if (!nextName) {
      setProfileMessage('Display name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      await updateProfile({ displayName: nextName });
      setProfileMessage('Profile updated.');
    } catch {
      setProfileMessage('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteProfile() {
    const ok = window.confirm(
      'Delete your profile from this app? This will remove all your cars and sign you out.'
    );
    if (!ok) return;

    setDeletingProfile(true);
    try {
      const token = await getToken();
      if (!token) return;
      const userCars = await carsApi.getUserCars(token);
      await Promise.all(
        userCars.filter((c) => c.id).map((c) => carsApi.deleteCar(c.id!, token))
      );
      await signOut();
      navigate('/signup', { replace: true });
    } catch {
      alert('Failed to delete profile.');
    } finally {
      setDeletingProfile(false);
    }
  }

  const totalKm = cars.reduce((sum, c) => sum + c.kilometer, 0);
  const avgScore =
    Object.values(scores).length > 0
      ? Math.round(Object.values(scores).reduce((sum, s) => sum + s.overall_score, 0) / Object.values(scores).length)
      : null;

  return (
    <div className="page">
      <h1>Profile</h1>

      {/* Profile Header */}
      <Card className="profile-header-card">
        <div className="profile-avatar--lg">
          {(user?.displayName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
        </div>
        <div className="profile-header__details">
          {user?.displayName && <h2 className="profile-header__name">{user.displayName}</h2>}
          {user?.email && <p className="profile-header__email">{user.email}</p>}
        </div>
        <div className="profile-header__actions">
          <Button variant="secondary" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Quick Stats */}
      {!loading && cars.length > 0 && (
        <div className="profile-stats" style={{ marginTop: '1.5rem' }}>
          <div className="profile-stat">
            <div className="profile-stat__number">{cars.length}</div>
            <div className="profile-stat__label">Vehicles</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__number">{totalKm.toLocaleString()}</div>
            <div className="profile-stat__label">Total km</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__number">{avgScore ?? '—'}</div>
            <div className="profile-stat__label">Avg Score</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__number">
              {Object.values(scores).filter((s) => s.grade === 'A' || s.grade === 'B').length}
            </div>
            <div className="profile-stat__label">Top Rated</div>
          </div>
        </div>
      )}

      {/* Your Cars */}
      <section className="profile-section">
        <div className="section-header">
          <h2 className="profile-section__title">Your Cars</h2>
          <button className="button button--primary" onClick={() => navigate('/add-car')}>
            + Add Car
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner" />
        ) : cars.length === 0 ? (
          <div className="empty-state">
            <h2>No cars yet</h2>
            <p>Add your first car to start tracking maintenance and service history.</p>
            <button className="button button--primary" onClick={() => navigate('/add-car')}>
              Add Your First Car
            </button>
          </div>
        ) : (
          <div className="car-list">
            {cars.map((car) => {
              const score = car.id ? scores[car.id] : null;
              return (
                <Card key={car.id} className="profile-car-card--enhanced">
                  <div className="profile-car-card__top">
                    <div>
                      <div className="profile-car-card__name-row">
                        <h3>
                          {car.merke} {car.modell}
                        </h3>
                        {score && (
                          <span
                            className="score-badge"
                            style={{ backgroundColor: GRADE_COLORS[score.grade] ?? '#64748b' }}
                            title={`Care Score: ${score.overall_score}/100`}
                          >
                            {score.grade}
                          </span>
                        )}
                      </div>
                      <div className="profile-car-card__meta">
                        <span className="profile-car-card__meta-tag">{car.registreringsnummer}</span>
                        <span className="profile-car-card__meta-tag">{car.arsmodell}</span>
                        <span className="profile-car-card__meta-tag">{car.drivstoff}</span>
                        <span className="profile-car-card__meta-tag">{car.karosseri}</span>
                      </div>
                    </div>

                    {/* Mileage display/edit */}
                    <div>
                      {editingMileage === car.id ? (
                        <div className="mileage-edit">
                          <input
                            type="number"
                            className="mileage-edit__input"
                            value={mileageValue}
                            onChange={(e) => setMileageValue(e.target.value)}
                            placeholder="km"
                            min="0"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveMileage(car.id!);
                              if (e.key === 'Escape') {
                                setEditingMileage(null);
                                setMileageValue('');
                              }
                            }}
                          />
                          <button
                            className="button button--primary button--sm"
                            onClick={() => handleSaveMileage(car.id!)}
                            disabled={savingMileage}
                          >
                            {savingMileage ? '...' : 'Save'}
                          </button>
                          <button
                            className="button button--secondary button--sm"
                            onClick={() => {
                              setEditingMileage(null);
                              setMileageValue('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button button--secondary button--sm"
                          onClick={() => {
                            setEditingMileage(car.id!);
                            setMileageValue(String(car.kilometer));
                          }}
                          title="Update mileage"
                        >
                          {car.kilometer.toLocaleString()} km
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Public history toggle */}
                  <div className="profile-car-card__toggle-row">
                    <span className="profile-car-card__toggle-label">Public service history</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={car.public_history ?? false}
                        onChange={() => car.id && handleTogglePublic(car.id, car.public_history ?? false)}
                        disabled={togglingPublic === car.id}
                      />
                      <span className="toggle-switch__slider" />
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="profile-car-card__bottom">
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
              );
            })}
          </div>
        )}
      </section>

      {/* Account Settings */}
      <section className="profile-section">
        <h2 className="profile-section__title">Account</h2>
        <Card className="profile-settings">
          <div className="profile-settings__item">
            <span className="profile-settings__label">Email</span>
            <span className="profile-settings__value">{user?.email ?? '—'}</span>
          </div>
          <div className="profile-settings__item">
            <span className="profile-settings__label">Display Name</span>
            <span className="profile-settings__value">{user?.displayName ?? '—'}</span>
          </div>
          <div className="profile-settings__item">
            <span className="profile-settings__label">Vehicles Registered</span>
            <span className="profile-settings__value">{cars.length}</span>
          </div>
        </Card>

        <Card className="profile-settings-card">
          <h3 className="profile-settings-card__title">Edit profile</h3>
          <div className="input-wrap">
            <label className="input-label" htmlFor="display-name">
              Display Name
            </label>
            <input
              id="display-name"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={64}
            />
          </div>
          {profileMessage && <p className="text-muted">{profileMessage}</p>}
          <div className="profile-settings-card__actions">
            <Button variant="secondary" onClick={() => setDisplayName(user?.displayName ?? '')}>
              Reset
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </Card>

        <div className="profile-danger-zone">
          <h3 className="profile-danger-zone__title">Delete profile</h3>
          <p>
            This removes your cars and maintenance data from this app and signs you out.
          </p>
          <button className="button button--danger" onClick={handleDeleteProfile} disabled={deletingProfile}>
            {deletingProfile ? 'Deleting...' : 'Delete Profile'}
          </button>
        </div>
      </section>
    </div>
  );
}
