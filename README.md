# Port Diary

Personal portfolio tracker — transactions, investment journal, dividends, charts, AI analysis, and market news.

Production: [portdiary.com](https://portdiary.com)

## Stack

- **Frontend:** React 19 + Vite (static SPA behind nginx)
- **Backend:** Express 5 + PostgreSQL 16
- **Deploy:** Docker Compose on VPS (GitHub Actions)

## Local development

```bash
# Frontend
npm ci && npm run dev

# Backend (separate terminal)
cd backend && npm ci && npm run dev
```

Set environment variables from `.env.example`. Registration requires SMTP for OTP email delivery.

## Database

Migrations run automatically when the backend starts (`backend/src/db/migrate.js`).

To wipe all data and start fresh (irreversible):

```bash
# Linux / macOS / VPS
./scripts/reset-db.sh

# Windows
.\scripts\reset-db.ps1
```

After reset, only users who complete OTP email verification during registration can log in.

## Account privacy

Users can export all data or delete their account from **Settings** in the dashboard. See `public/privacy.html`.

## Tests

```bash
cd backend && npm test
```

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md).
