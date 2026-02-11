import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type { AllCarsServiceStatus, CarServiceStatus, ServiceDueStatus } from '@/types/car';
import { eventTypeLabel, urgencyColor, urgencyLabel } from '@/utils/format';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const { getToken, signOut } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AllCarsServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await carsApi.getAllServiceStatus(token);
      setData(result);
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
        signOut();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, signOut]);

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

  if (error) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
        <button className="link-button" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.cars.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Welcome to CarMinder</h2>
          <p>You haven't added any cars yet. Add your first car to start tracking maintenance.</p>
          <button className="button button--primary" onClick={() => navigate('/add-car')}>
            Add Your First Car
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1>Service Overview</h1>
        <button className="button button--primary" onClick={() => navigate('/add-car')}>
          + Add Car
        </button>
      </div>

      <SummaryBanner data={data} />

      <div className="car-grid">
        {data.cars.map((car) => (
          <CarServiceCard key={car.car_id} car={car} />
        ))}
      </div>
    </div>
  );
}

function SummaryBanner({ data }: { data: AllCarsServiceStatus }) {
  return (
    <div className="summary-banner">
      <div className="summary-stat summary-stat--error">
        <span className="summary-stat__number">{data.overdue_count}</span>
        <span className="summary-stat__label">Overdue</span>
      </div>
      <div className="summary-stat summary-stat--warning">
        <span className="summary-stat__number">{data.soon_count}</span>
        <span className="summary-stat__label">Due Soon</span>
      </div>
      <div className="summary-stat summary-stat--neutral">
        <span className="summary-stat__number">{data.cars.length}</span>
        <span className="summary-stat__label">Vehicles</span>
      </div>
    </div>
  );
}

function CarServiceCard({ car }: { car: CarServiceStatus }) {
  const navigate = useNavigate();

  return (
    <Card
      className="car-service-card"
      onClick={() => navigate(`/car/${car.car_id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="car-service-card__header">
        <div>
          <h3 className="car-service-card__name">{car.car_name}</h3>
          <span className="car-service-card__reg">{car.registration}</span>
        </div>
        <span className="car-service-card__km">{car.current_mileage.toLocaleString()} km</span>
      </div>

      {car.next_service && car.next_service.urgency !== 'ok' && (
        <NextServiceAlert service={car.next_service} />
      )}

      <div className="service-badges">
        {car.services.map((s) => (
          <ServiceBadge key={s.event_type} service={s} />
        ))}
      </div>
    </Card>
  );
}

function NextServiceAlert({ service }: { service: ServiceDueStatus }) {
  const isOverdue = service.urgency === 'overdue';
  return (
    <div
      className={`next-service-alert ${isOverdue ? 'next-service-alert--overdue' : 'next-service-alert--soon'}`}
    >
      <strong>{isOverdue ? 'Overdue' : 'Due Soon'}:</strong> {eventTypeLabel(service.event_type)}
      {service.days_until_due != null && (
        <span>
          {' '}
          ({isOverdue
            ? `${Math.abs(service.days_until_due)} days overdue`
            : `${service.days_until_due} days left`})
        </span>
      )}
    </div>
  );
}

function ServiceBadge({ service }: { service: ServiceDueStatus }) {
  return (
    <span
      className={`service-badge service-badge--${service.urgency}`}
      style={{ borderColor: urgencyColor(service.urgency) }}
    >
      <span
        className="service-badge__dot"
        style={{ backgroundColor: urgencyColor(service.urgency) }}
      />
      <span className="service-badge__label">{eventTypeLabel(service.event_type)}</span>
      <span className="service-badge__urgency">{urgencyLabel(service.urgency)}</span>
    </span>
  );
}
