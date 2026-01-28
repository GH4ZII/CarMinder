# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


## Quick Start

### Frontend

```bash
npm install
npx expo start
```

### Backend

```bash
cd backend-python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Architecture

- **Frontend:** Expo, TypeScript, API calls in `frontendServices/apiCall.ts`
- **Backend:** FastAPI, Supabase, Firebase Admin, organized in `routers/`, `services/`, `schemas/`, `config/`
- **Env files:** `.env` (frontend), `backend-python/.env` (backend)

## How to Add New Backend Functions

1. **Create a schema:** Add a Pydantic model in `backend-python/schemas/`.
2. **Add logic:** Implement in `backend-python/services/`.
3. **Add route:** Create an endpoint in `backend-python/routers/`.
4. **Register router:** Import in `main.py`.
5. **Frontend:** Add API call in `frontendServices/apiCall.ts` and use it in your React Native components.

## Environment Variables

- **Frontend:** `.env` (API URLs, Supabase keys, Firebase client IDs)
- **Backend:** `backend-python/.env` (Supabase service key, API keys)

## Contributing

- Keep secrets out of git.
- Follow the folder structure.
- Use clear names and comments.

##
