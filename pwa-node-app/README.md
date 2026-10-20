# PWA Prototype CockroachDB Dashboard

This Express application connects to the CockroachDB Cloud `pwa_prototype` database, exposes the PWA prototype records through HTTP, and serves a responsive dashboard.

## Requirements

- Node.js 18 or newer
- A CockroachDB Cloud SQL connection string with access to the `pwa_prototype` database

## Setup

```powershell
Copy-Item .env.example .env
npm install
```

Open `.env` and replace `DATABASE_URL` with the SQL connection string from CockroachDB Cloud. The connection string must target the `pwa_prototype` database and retain TLS settings, for example:

```text
postgresql://<username>:<password>@<host>:26257/pwa_prototype?sslmode=verify-full
```

You can optionally set `PORT`; it defaults to `3000`.

Do not commit `.env` or expose its credentials.

## Run

```powershell
npm start
```

Then open <http://localhost:3000> for the dashboard.

## API

- `GET /api/prototypes` returns `{ data, count }` with the records from `public.pwa_prototypes`.
- `GET /api/health` performs a database connectivity check and returns the service status.

Example:

```powershell
Invoke-RestMethod http://localhost:3000/api/prototypes
Invoke-RestMethod http://localhost:3000/api/health
```
