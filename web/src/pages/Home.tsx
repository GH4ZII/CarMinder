import * as carsApi from '@/api/cars';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import type {
  AllCarsServiceStatus,
  CarCareScoreResponse,
  CarServiceStatus,
  ServiceDueStatus,
} from '@/types/car';
import { eventTypeLabel, urgencyColor, urgencyLabel } from '@/utils/format';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759',
  B: '#30D158',
  C: '#FF9500',
  D: '#FF6B00',
  F: '#FF3B30',
};

export default function Home() {
  const { getToken, signOut } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AllCarsServiceStatus | null>(null);
  const [scores, setScores] = useState<Record<string, CarCareScoreResponse>>({});
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

      // Fetch scores for all cars in parallel (fault-tolerant)
      const scoreEntries = await Promise.allSettled(
        result.cars.map(async (car) => {
          const s = await carsApi.getCarCareScore(car.car_id, token);
          return [car.car_id, s] as const;
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
          <div className="empty-state__icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </div>
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
          <CarServiceCard key={car.car_id} car={car} score={scores[car.car_id] ?? null} />
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

function CarServiceCard({
  car,
  score,
}: {
  car: CarServiceStatus;
  score: CarCareScoreResponse | null;
}) {
  const navigate = useNavigate();

  return (
    <Card
      className="car-service-card"
      onClick={() => navigate(`/car/${car.car_id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="car-service-card__header">
        <div>
          <div className="car-service-card__name-row">
            <h3 className="car-service-card__name">{car.car_name}</h3>
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
