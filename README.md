# Cute Ordering App

Split ordering app with account roles for ordering, cooking, and administration:

- `backend`: Django JSON API
- `frontend`: React + Vite mobile ordering UI

## Run Locally

Open two PowerShell windows.

Backend:

```powershell
cd ordering-app
.\start-backend.ps1
```

Frontend:

```powershell
cd ordering-app
.\start-frontend.ps1
```

Then open:

```text
http://127.0.0.1:5173
```

The frontend talks to Django at:

```text
http://127.0.0.1:8000/api
```

The local demo seeder creates `diandan`, `cook`, and `admin` accounts. Their password defaults to `123456` only while Django is in development mode; override it with the `DEMO_PASSWORD` environment variable. The seeder refuses to run when `DJANGO_DEBUG=false`.

## Production Configuration

Do not commit a real `.env` file. Configure the variables shown in `.env.example` through your hosting provider. At minimum, production requires `DJANGO_DEBUG=false`, a strong `DJANGO_SECRET_KEY`, the deployed host/origin values, and `VITE_API_URL` for the frontend build.

Local databases, uploaded media, virtual environments, dependencies, build output, and runtime logs are excluded by `.gitignore`.

## Useful API Checks

```text
http://127.0.0.1:8000/api/health/
http://127.0.0.1:8000/api/tables/
http://127.0.0.1:8000/api/menu/?table=1
```
