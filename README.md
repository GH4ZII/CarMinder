# CarMinder

A car maintenance and reminder app built with Expo (React Native), a FastAPI backend, and an optional Vite-based web app. Track cars, service intervals, maintenance events, incidents, and get reminders.

## Tech stack

- **Mobile:** Expo (React Native), TypeScript, file-based routing via Expo Router
- **Backend:** FastAPI, Supabase, Firebase Admin — `routers/`, `services/`, `schemas/`, `config/` in `backend-python/`
- **Web:** Vite + React in `web/`
- **API layer:** `frontendServices/` (e.g. `apiCall.ts`, `carApi.ts`, `authApi.ts`)

## Quick start

### Frontend (Expo / mobile)

```bash
npm install
npx expo start
```

Then use the CLI to open in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), or [Expo Go](https://expo.dev/go). Edit files in the **app** directory; the project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Backend

```bash
cd backend-python
python -m venv .venv
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Web (Vite)

```bash
cd web
npm install
npm run dev
```

Open the URL shown (usually `http://localhost:5173`).

- **Production build:** `npm run build`
- **Preview build:** `npm run preview`

## Architecture

- **Frontend:** Expo app; API calls live in `frontendServices/` (e.g. `apiCall.ts`, `carApi.ts`, `maintenanceApi.ts`, `authApi.ts`).
- **Backend:** FastAPI in `backend-python/` with Supabase and Firebase Admin; routers for auth, cars, maintenance, service intervals, car score, incident reports, public history, push tokens.
- **Env:** `.env` at repo root (frontend), `backend-python/.env` (backend).

## Adding new backend features

1. **Schema:** Add a Pydantic model in `backend-python/schemas/`.
2. **Logic:** Implement in `backend-python/services/`.
3. **Route:** Add an endpoint in `backend-python/routers/`.
4. **Wire up:** Import and include the router in `main.py`.
5. **Frontend:** Add or use an API helper in `frontendServices/` and call it from your screens in **app**.

## Environment variables

- **Frontend:** `.env` — API base URL, Supabase URL/key, Firebase client config.
- **Backend:** `backend-python/.env` — Supabase URL and service key, JWT secret, other API keys.

Keep secrets out of git; use `.env.example` or docs for required keys.

## Contributing

- Do not commit secrets; use env files and keep them ignored.
- Follow the existing folder structure and naming.
- Use clear names and brief comments where helpful.

## Learn more

- [Expo docs](https://docs.expo.dev/) and [Expo Router](https://docs.expo.dev/router/introduction)
- [FastAPI](https://fastapi.tiangolo.com/)
