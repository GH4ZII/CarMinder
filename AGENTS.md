# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

CarMinder is a car maintenance tracking app (Norwegian market). It has three services:

| Service | Dir | Dev command | Port |
|---------|-----|-------------|------|
| **Backend API** (FastAPI) | `backend-python/` | `source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000` | 8000 |
| **Web App** (Vite/React) | `web/` | `npm run dev -- --host 0.0.0.0` | 5173 |
| **Mobile App** (Expo/RN) | root | `npx expo start` | 8081 |

The mobile app requires a physical device or emulator and is not testable in Cloud Agent VMs. Focus on backend + web for dev/testing.

### Running services

- **Backend**: Requires a `.env` file in `backend-python/` with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET_KEY`, `FIREBASE_WEB_API_KEY`, `VEHICLE_API_KEY`, `CRON_SECRET`. The server starts without valid values (placeholder strings work), but actual API calls to Supabase/Firebase will fail without real credentials.
- **Web**: No `.env` required for dev (defaults to `http://localhost:8000` for API). Run from the `web/` directory.
- **API docs**: FastAPI Swagger UI is at `http://localhost:8000/docs`.

### Lint / type-check / build

- **Expo lint**: `npx expo lint` (root dir) — pre-existing warnings/errors in the repo
- **Web TypeScript**: `npx tsc --noEmit` (from `web/`)
- **Web build**: `npm run build` (from `web/`)
- **Python venv**: Activate with `source backend-python/.venv/bin/activate`

### Gotchas

- `python3.12-venv` apt package must be installed before creating the Python virtualenv (not present by default on Ubuntu 24.04 minimal).
- The backend uses `@lru_cache` for settings and DB client — environment variable changes require a server restart.
- Root `package.json` uses npm (lockfile is `package-lock.json`), and so does `web/`.
