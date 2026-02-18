/**
 * Barrel re-export — preserves backwards-compatibility for all existing imports.
 *
 * Prefer importing directly from the focused modules:
 *   import { authApi }        from './authApi';
 *   import { carApi }         from './carApi';
 *   import { maintenanceApi } from './maintenanceApi';
 *   import { incidentApi }    from './incidentApi';
 *   import { serviceStatusApi } from './serviceStatusApi';
 *   import { publicApi }      from './publicApi';
 *   import { API_URL, ApiError } from './apiConfig';
 *   import type { CarInfo, … } from './types';
 */

export { API_URL, ApiError } from './apiConfig';
export type { AuthUser, TokenResponse } from './types';
export type {
  CarInfo,
  MaintenanceEventType,
  MaintenanceEvent,
  MaintenanceEventCreate,
  ServiceDueStatus,
  CarServiceStatus,
  AllCarsServiceStatus,
  IncidentReport,
  IncidentReportCreate,
  PublicCarInfo,
  PublicMaintenanceEvent,
  PublicIncidentReport,
  PublicCarHistory,
} from './types';

import { authApi } from './authApi';
import { carApi } from './carApi';
import { maintenanceApi } from './maintenanceApi';
import { incidentApi } from './incidentApi';
import { serviceStatusApi } from './serviceStatusApi';
import { publicApi } from './publicApi';

export const api = {
  // Auth
  authLogin: authApi.login.bind(authApi),
  authSignup: authApi.signup.bind(authApi),
  authGoogle: authApi.google.bind(authApi),
  authForgotPassword: authApi.forgotPassword.bind(authApi),

  // Cars
  lookupVehicle: carApi.lookupVehicle.bind(carApi),
  saveCar: carApi.saveCar.bind(carApi),
  getUserCars: carApi.getUserCars.bind(carApi),
  deleteCar: carApi.deleteCar.bind(carApi),
  getCar: carApi.getCar.bind(carApi),
  updateCar: carApi.updateCar.bind(carApi),

  // Maintenance
  getEventTypes: maintenanceApi.getEventTypes.bind(maintenanceApi),
  getMaintenanceEvents: maintenanceApi.getMaintenanceEvents.bind(maintenanceApi),
  createMaintenanceEvent: maintenanceApi.createMaintenanceEvent.bind(maintenanceApi),

  // Service status
  getCarServiceStatus: serviceStatusApi.getCarServiceStatus.bind(serviceStatusApi),
  getAllServiceStatus: serviceStatusApi.getAllServiceStatus.bind(serviceStatusApi),

  // Incidents
  getIncidentTypes: incidentApi.getIncidentTypes.bind(incidentApi),
  getIncidents: incidentApi.getIncidents.bind(incidentApi),
  createIncident: incidentApi.createIncident.bind(incidentApi),

  // Public
  getPublicHistory: publicApi.getPublicHistory.bind(publicApi),
};
