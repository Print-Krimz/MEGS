# MEGS Recruitment Management System

MEGS is a hiring system for MEGS Inc., a Philippine manpower agency. It handles the full path from a job opening to a deployed worker: job posts, applications, resume screening, interviews, contract signing and placement tracking.

Applicants apply online or at the office. Talent Acquisition (TA) staff screen candidates and run the hiring process. An Admin, who leads the TA team, manages users, settings and reports.

Live site: https://megsinc.com

## Who uses it

| Role | How they get an account | What they do |
| :--- | :--- | :--- |
| Applicant | Self-registers | Applies to jobs, uploads documents, tracks application status, manages their profile |
| Talent Acquisition (TA) | Created from the seed or by an Admin invitation | Manages job postings and manpower requests, screens candidates, schedules interviews, records client decisions, tracks deployments |
| Admin | Created from the seed | Manages staff accounts, system settings, audit logs, scoring settings and team-wide reports |

## Main features

- Resume parsing: Google Gemini reads uploaded resumes and fills in the applicant profile.
- Candidate scoring: each application gets a score against the job requirements. Staff can review and re-run scoring.
- Talent pool: pgvector similarity search finds past applicants who fit a new opening.
- Job and manpower request management: TA staff create requests from clients and publish job posts.
- Interview scheduling, contract signing and deployment tracking.
- Intake from several sources: online applications, walk-ins and imports from other job sites.
- Notifications by email (Brevo) and SMS.
- Reports with Excel and PDF export.
- Staff accounts require multi-factor authentication. Every protected API route is checked on the server.

## Tech stack

| Area | Technology |
| :--- | :--- |
| Backend | Node.js 22, TypeScript, Express 5 |
| Database | PostgreSQL on Supabase, Prisma ORM 7.8 (multi-file schema), pgvector |
| Authentication and file storage | Supabase Auth and Supabase Storage |
| AI | Google Gemini (`gemini-2.5-flash` for parsing, `gemini-embedding-001` for embeddings) |
| Email | Brevo API |
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4 |
| Data and routing | TanStack Query, Router and Table |
| Validation | Zod |
| Hosting | Heroku (API), Vercel (web app), Cloudflare (DNS) |

## Repository layout

```text
MEGS/
├── backend/                  Express API and background workers
│   ├── prisma/
│   │   ├── schema/           Prisma models split across 11 files, plus SQL migrations
│   │   └── seed.ts           Creates the first Admin and TA accounts
│   ├── src/
│   │   ├── controllers/      Request handlers
│   │   ├── middleware/       Authentication, role checks, rate limits
│   │   ├── routes/           API route definitions
│   │   ├── services/         Business logic, scoring, resume parsing, reports
│   │   ├── utils/            Prisma, Supabase, Gemini and mail clients
│   │   └── workers/          Queues for resume parsing and email
│   └── server.ts             Server entry point (port 3000)
├── frontend/                 React single-page app
│   └── src/
│       ├── components/       Shared UI components
│       ├── layouts/          Layouts for Admin, TA, Applicant and sign-in pages
│       ├── pages/            Screens for each role and the public site
│       └── lib/api/          API clients and TanStack Query hooks
├── docs/                     Project documentation
└── .github/workflows/        Backend checks and deployment
```

## Getting started

You need Node.js 22, npm, a Supabase project with the `pgvector` extension enabled, a Google Gemini API key and a Brevo API key.

```bash
git clone https://github.com/Print-Krimz/MEGS.git
cd MEGS
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`. [`backend/.env.example`](backend/.env.example) lists every variable with a placeholder. The main groups are database URLs, Supabase keys, JWT settings, `OTP_SECRET`, backup encryption keys, Gemini, and Brevo.

```bash
npm run db:generate
npm run db:migrate
npm run seed
npm run dev
```

The API runs on http://localhost:3000.

`npm run seed` needs `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TA_EMAIL` and `TA_PASSWORD` in the environment. `npm run seed:admin` needs only the two Admin values. The seed never changes the password of an existing account, and new staff must change their password at first sign-in.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The app runs on http://localhost:5173. [`frontend/.env.example`](frontend/.env.example) sets the API address (`VITE_API_URL`) and the Cloudflare Turnstile key.

### Email

Production email goes through the Brevo API from `noreply@megsinc.com`. Set `BREVO_API_KEY` and `EMAIL_FROM`. Brevo must authenticate the sending domain, and its IP allow-list must be off because Heroku IP addresses change. Outside production, if no email provider is configured, the server prints a redacted preview to the console.

## Scripts

Backend (`backend/`):

- `npm run dev`: start the API with hot reload.
- `npm run build`: compile TypeScript into `dist/`.
- `npm start`: run the compiled server.
- `npm test`: run the Vitest suites. Some suites use a real database, so run them against a test database.
- `npm run seed`, `npm run seed:admin`: create the first staff accounts.
- `npm run db:migrate`, `npm run db:generate`, `npm run db:studio`: Prisma migrations, client generation and database viewer.

Frontend (`frontend/`):

- `npm run dev`: start Vite.
- `npm run build`: type-check and build the production bundle.
- `npm test`: run unit and component tests.
- `npm run test:e2e`: run Playwright end-to-end tests.
- `npm run preview`: serve the production build locally.

## Testing and deployment

When a push to `main` changes `backend/`, GitHub Actions installs the backend, generates the Prisma client, type-checks and runs the tests with no real database or secrets. If they pass, the workflow deploys the API to Heroku. See [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml).

## Security

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
