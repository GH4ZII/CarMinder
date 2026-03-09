import {
  CarInfo,
  CarServiceStatus,
  MaintenanceEvent,
  IncidentReport,
  CarCareScoreResponse,
  ObdReadingResponse,
  api,
} from './apiCall';
import { ObdSnapshot, obdService } from './obdService';

export interface CarReportObdSection {
  latestBackend: ObdReadingResponse | null;
  latestSnapshot: ObdSnapshot | null;
  effectiveSnapshot: ObdSnapshot | null;
}

export interface CarReportData {
  car: CarInfo;
  careScore: CarCareScoreResponse | null;
  serviceStatus: CarServiceStatus | null;
  maintenanceEvents: MaintenanceEvent[];
  incidents: IncidentReport[];
  obd: CarReportObdSection;
  generatedAt: string;
}

export async function fetchCarReportData(carId: string, token: string): Promise<CarReportData> {
  if (!carId) {
    throw new Error('fetchCarReportData called without carId');
  }
  if (!token) {
    throw new Error('fetchCarReportData called without auth token');
  }

  const [carData, eventsData, incidentsData, statusData, scoreData, lastObdSnapshot, backendReading] =
    await Promise.all([
      api.getCar(carId, token),
      api
        .getMaintenanceEvents(carId, token)
        .catch((e) => {
          console.warn('Report: events fetch failed:', e?.message ?? e);
          return [] as MaintenanceEvent[];
        }),
      api
        .getIncidents(carId, token)
        .catch((e) => {
          console.warn('Report: incidents fetch failed:', e?.message ?? e);
          return [] as IncidentReport[];
        }),
      api
        .getCarServiceStatus(carId, token)
        .catch((e) => {
          console.warn('Report: service status fetch failed:', e?.message ?? e);
          return null as CarServiceStatus | null;
        }),
      api
        .getCarCareScore(carId, token)
        .catch((e) => {
          console.warn('Report: score fetch failed:', e?.message ?? e);
          return null as CarCareScoreResponse | null;
        }),
      obdService
        .getLastSnapshot(carId)
        .catch(() => null as ObdSnapshot | null),
      api
        .getLatestObdReading(carId, token)
        .catch(() => null as ObdReadingResponse | null),
    ]);

  let effectiveSnapshot: ObdSnapshot | null = lastObdSnapshot;
  if (backendReading) {
    const backendAsSnapshot: ObdSnapshot = {
      capturedAt: backendReading.captured_at,
      source: backendReading.source,
      metrics: {
        rpm: backendReading.rpm,
        coolantTempC: backendReading.coolant_temp_c,
        speedKph: backendReading.speed_kph,
        engineLoadPct: backendReading.engine_load_pct,
        batteryVoltage: backendReading.battery_voltage,
      },
      dtcs: backendReading.dtcs,
    };
    if (!effectiveSnapshot || new Date(backendReading.captured_at) > new Date(effectiveSnapshot.capturedAt)) {
      effectiveSnapshot = backendAsSnapshot;
    }
  }

  return {
    car: carData,
    careScore: scoreData,
    serviceStatus: statusData,
    maintenanceEvents: eventsData,
    incidents: incidentsData,
    obd: {
      latestBackend: backendReading,
      latestSnapshot: lastObdSnapshot,
      effectiveSnapshot,
    },
    generatedAt: new Date().toISOString(),
  };
}

