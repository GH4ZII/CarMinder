# CarMinder System Overview

Last updated: 2026-03-01  
Purpose: give new contributors a fast, end-to-end picture of how the mobile, web, and backend pieces fit together, plus how to run and extend them locally.

---

## High-level architecture
- **Mobile (Expo / React Native / TypeScript)** lives in `app/`. Uses Expo Router for file-based navigation and shared UI components under `components/`. Talks to the backend via helper functions in `frontendServices/apiCall.ts`.
- **Web (React + Vite + TypeScript)** lives in `web/`. Mirrors core flows for browser users and also calls the same backend API layer.
- **Backend (FastAPI + Python)** lives in `backend-python/`. Exposes REST endpoints under `routers/`, business logic in `services/`, data contracts in `schemas/`, and persistence adapters in `repositories/`. Auth + user data is integrated with Supabase and Firebase Admin.
- **Database & storage**: Supabase is the primary data store. Credentials and URLs come from environment files. Migrations live in `backend-python/migrations/` (SQL) when present.
- **Shared contracts**: TypeScript types are in `web/src/types/` and mobile consumes response shapes defined in `frontendServices/apiCall.ts`. Python Pydantic models in `backend-python/schemas/` define the source of truth for API payloads and responses.

## Data flow (happy path)
1. User signs in on mobile or web (Firebase Auth on the client).  
2. Client grabs an ID token and calls backend endpoints via `frontendServices/apiCall.ts` (mobile) or `web/src/api/` (web).  
3. FastAPI validates the request (auth middleware in `main.py` and router-level checks), then delegates to a service in `backend-python/services/`.  
4. Services call repositories to read/write Supabase. Domain rules and validations live in `domain/` and `schemas/`.  
5. Backend responds with JSON; clients render UI and update local state.

## Key backend modules
- `main.py`: FastAPI app creation, middleware, CORS, router registration.
- `routers/`: Request/response wiring. Example: maintenance event endpoints.
- `services/`: Business logic; orchestrates repositories and validations.
- `repositories/`: DB access (Supabase clients, queries).
- `schemas/`: Pydantic models for requests/responses.
- `config/`: Environment loading (Supabase keys, Firebase Admin, host/port).
- `tests/`: Pytest suite (see `tests/` and `test_scoring_engine.py`).
- `migrations/`: SQL migrations such as `001_maintenance_events.sql`.

## Key mobile app pieces
- `app/(tabs)/`: Tab-based screens (e.g., car detail, add maintenance event).
- `components/`: Themed UI building blocks.
- `frontendServices/apiCall.ts`: Typed API calls to the backend.
- `contexts/AuthContext.tsx`: Auth state and current user info.
- `constants/`, `hooks/`: Shared utilities and configurations.
- Navigation: Expo Router `_layout.tsx` sets stack/tab layouts.

## Key web app pieces
- `web/src/pages/`: Login, Signup, Home, and feature pages.
- `web/src/api/`: REST helpers (e.g., `cars.ts`) pointing to the backend.
- `web/src/types/`: Shared TS interfaces for API payloads and models.
- `web/src/index.css`: Global theming; `App.tsx` wires routes.

## Environment & secrets
- Frontend `.env`: API base URLs, Supabase anon key, Firebase web config.
- Backend `backend-python/.env`: Supabase service key, database URL, Firebase Admin creds, API secrets.
- Never commit real secrets. The backend reads environment values via `config/`.

## Running locally
- **Mobile (Expo):**
  ```bash
  npm install
  npx expo start
  # press i for iOS simulator, a for Android emulator, w for web
  ```
- **Web (Vite):**
  ```bash
  cd web
  npm install
  npm run dev
  ```
- **Backend (FastAPI):**
  ```bash
  cd backend-python
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```

## Testing
- Backend: `cd backend-python && pytest`
- Web: `cd web && npm test` (if configured) or `npm run build` for type checks.
- Mobile: Expo uses Metro; rely on lint/type-check via `npm run lint` (if configured) and EAS/CI for builds.

## Deployment notes (baseline)
- Mobile: EAS build/submit workflows (not committed here, but Expo-ready).
- Web: `npm run build` produces `web/dist` for static hosting.
- Backend: Deploy FastAPI app with environment variables; ensure Supabase and Firebase service keys are set in the environment. Add HTTPS + CORS domains.

## Extending the system (quick playbook)
1. **Add a new feature**: design UI (mobile/web), add API function in `frontendServices/apiCall.ts` or `web/src/api/`, build screen/page.
2. **Backend change**: define Pydantic schema -> service logic -> repository change -> router endpoint -> tests.
3. **DB change**: add SQL migration under `backend-python/migrations/`, run it against Supabase.
4. **Types/contracts**: update TS types in web/mobile to mirror backend schema changes.

## Useful paths at a glance
- Mobile: `app/`, `components/`, `frontendServices/apiCall.ts`, `contexts/AuthContext.tsx`
- Web: `web/src/pages/`, `web/src/api/`, `web/src/types/`, `web/src/index.css`
- Backend: `backend-python/main.py`, `backend-python/routers/`, `backend-python/services/`, `backend-python/schemas/`, `backend-python/migrations/`

---

If you need more depth (request/response examples, auth headers, or DB ERDs), call it out and we can add a focused appendix.

---

## Low-level backend map (routers → services → repositories)

### Maintenance events
- **Router** `backend-python/routers/maintenance_event.py`
  - `GET /maintenance/event-types` → returns static `EVENT_TYPES`.
  - `GET /cars/{car_id}/events` → `maintenance_service.list_events(uid, car_id)`; 404 if car not owned.
  - `POST /cars/{car_id}/events` → `maintenance_service.create_event(uid, car_id, payload)`; validates; 400 on validation, 404 on ownership.
- **Service** `backend-python/services/maintenance_service.py`
  - `list_events` ensures ownership via `_ensure_car_ownership`, then `maintenance_repository.list_events_for_car`.
  - `create_event` ensures ownership, normalizes `cost` to `cost_cents`, builds row, calls `maintenance_repository.insert_event`; raises `ValidationError` on failure.
  - `_ensure_car_ownership` delegates to `car_repository.get_car_by_id_and_user`; raises `NotFoundError`.
- **Repository** `backend-python/repositories/maintenance_repository.py`
  - `list_events_for_car` → Supabase select `maintenance_events` filtered by `car_id`, ordered by `event_date` then `created_at`.
  - `insert_event` → Supabase insert; returns the inserted row.
- **Schema** `backend-python/schemas/maintenance_event.py`
  - `MaintenanceEventCreate` validators: `event_type` whitelisted, `event_date` not future, `mileage`/`cost` non-negative, trims vendor/notes.
  - `MaintenanceEventResponse` shapes server output (adds `cost_cents`, `created_at`, `receipt_image_url`).

### Cars (representative subset)
- **Router** `backend-python/routers/car.py` (not fully listed here)
  - Typical ops: create/list/delete/update cars; service status endpoints; score endpoint.
- **Repositories**: `car_repository` handles Supabase reads/writes for car rows and ownership checks.
- **Schemas**: `schemas/car.py` defines request/response models.

### Incidents
- **Router** `backend-python/routers/incident_report.py`
  - `GET /cars/{car_id}/incidents`, `POST /cars/{car_id}/incidents`, plus metadata `GET /incidents/types`.
- **Services**: `services/incident_service.py` (validation, ownership).
- **Repositories**: `repositories/incident_repository.py` (Supabase I/O).

### Service interval / scoring
- **Router** `backend-python/routers/service_interval.py`
  - Exposes service status computations (`/service-status`, `/cars/{id}/service-status`).
- **Service**: `services/service_interval.py` calculates due/overdue windows based on last maintenance and configured intervals.
- **Scoring**: `routers/car_score.py` + `services/scoring_engine.py` aggregate maintenance, incidents, and mileage to produce overall grades; see `backend-python/SCORING.md`.

### Auth
- **Router** `backend-python/routers/auth.py`
  - Email/password login, signup, Google/Apple auth, forgot password.
- **Config**: `config/auth.py` provides `get_current_user_uid` dependency (validates Firebase token / session).

---

## Frontend/mobile API surface (mobile uses `frontendServices/apiCall.ts`)
- Auth: `authLogin`, `authSignup`, `authGoogle`, `authApple`, `authForgotPassword`.
- Cars: `lookupVehicle`, `saveCar`, `getUserCars`, `getCar`, `deleteCar`, `updateCar`.
- Maintenance: `getEventTypes`, `getMaintenanceEvents`, `createMaintenanceEvent`.
- Service status: `getCarServiceStatus`, `getAllServiceStatus`.
- Incidents: `getIncidentTypes`, `getIncidents`, `createIncident`.
- Public: `getPublicHistory`.
- Scoring: `getCarCareScore`.

Each call:
- Builds URL from `API_URL` (Env: `EXPO_PUBLIC_API_URL`).
- Adds `Authorization: Bearer <token>` when required.
- Throws `ApiError` (with `status` and `detail`) on auth/validation failures so screens can handle errors.

### Mobile screens (selected)
- `app/(tabs)/addCar.tsx`: collects car data, calls `api.saveCar`.
- `app/(tabs)/car/[id]/add-event.tsx`: captures maintenance event form, fetches `getEventTypes`, posts via `createMaintenanceEvent`, uses native pickers for date/time.
- `app/(tabs)/car/[id]/index.tsx`: car detail; reads service status and maintenance lists.
- `app/(auth)/login.tsx`, `signup.tsx`: auth flows wired to API + Firebase context.

---

## Web client map (Vite React)
- Pages in `web/src/pages/` call `web/src/api/*.ts` helpers (pattern mirrors mobile `apiCall.ts`).
- Shared types in `web/src/types/` keep responses aligned with backend schemas.
- Global styles `web/src/index.css`; routing configured in `web/src/App.tsx`.

---

## Request/response contracts (quick reference)
- Maintenance:
  - POST `/cars/{car_id}/events` payload: `{ event_type, event_date (YYYY-MM-DD), mileage?, cost?, vendor?, notes? }`
  - Response: `MaintenanceEventResponse` (includes `cost_cents`, `created_at`, `id`, etc.)
- Event types:
  - GET `/maintenance/event-types` → `{ event_types: string[] }`
- Cars:
  - POST `/cars/` → car record
  - GET `/cars/` → list of user's cars
- Incidents:
  - POST `/cars/{car_id}/incidents` → incident record
- Service status:
  - GET `/service-status` → aggregate counts + per-car statuses
  - GET `/cars/{car_id}/service-status` → detailed status for one car
- Score:
  - GET `/cars/{car_id}/score` → overall score, grades, recommendations

---

## Execution path example (create maintenance event)
1. Mobile screen `add-event.tsx` gathers form, calls `api.createMaintenanceEvent(carId, token, payload)`.
2. API hits FastAPI `POST /cars/{car_id}/events`.
3. Dependency `get_current_user_uid` authenticates token; router hands payload to `maintenance_service.create_event`.
4. Service validates ownership, normalizes cost to cents, calls `maintenance_repository.insert_event`.
5. Supabase writes row; response returns canonical event to client; UI navigates back and refreshes list.

---

## Scoring algorithm (car care score)
Source of truth: `backend-python/SCORING.md`. API route: `GET /cars/{car_id}/score`.

**Pipeline**
- Orchestrator `services/scoring_service.py` → normalize raw Supabase rows → pure engine → explain.
- Layers:
  - `domain/scoring/normalize.py`: dataclasses + enum validation; no I/O.
  - `domain/scoring/engine.py`: pure numeric scoring; deterministic for a given `as_of` date.
  - `services/scoring_explain.py`: turns raw scores into human-readable summaries/recommendations.

**Categories & weights (sum to 100%)**
- Maintenance regularity 40%: evaluates oil/brake/tire/inspection intervals over last 5 years. Scores each gap on time & mileage; worse of the two counts. Late penalties ramp down in tiers; recent intervals weighted higher.
- EU inspection 15%: combines current deadline status (60%) with historical gaps between inspections (40%).
- Incident history 20%: starts at 100; subtract severity penalties, add repair credits; leniency if incidents are below expected count for vehicle age.
- Mileage tracking 10%: rewards having current mileage, logging mileage on events, monotonic increases, and reasonable annual distance.
- Documentation quality 15%: per-event/incident point system (mileage, cost, vendor, notes length, receipts) plus volume bonus scaled by car age.

**Confidence & dampening**
- Confidence factors: data volume vs car age, mileage presence, EU deadline presence, base constant.
- If confidence < 0.5, raw score is pulled toward 50 (neutral) using a linear blend; else raw score stands.

**Grading**
- >=90 A, >=75 B, >=60 C, >=40 D, else F.

**Recommendations**
- Up to 5 auto-generated suggestions based on weak categories (e.g., overdue maintenance, missing documentation, unrepaired incidents).

**Why it matters for UI**
- Clients should display `overall_score`, `grade`, `confidence_label`, per-category scores, and `recommendations`.
- If confidence is `very_low` or `low`, consider surfacing a “add more data” nudge (log maintenance, add mileage, upload receipts).

---

## Extension checklists
- **Add new field to maintenance event**: update Pydantic schema validators → repository insert → SQL migration → TS types in `apiCall.ts` and web types → adjust UI forms.
- **New endpoint**: add router handler → service logic → repository call → schema → hook it in mobile/web API helper → render in screens/pages.
- **DB change**: create migration in `backend-python/migrations/`; run against Supabase; keep schemas/types in sync.

---

For deeper per-function docs (e.g., scoring formulas or incident severity semantics), ping me and I’ll add appendices with code references and examples.
