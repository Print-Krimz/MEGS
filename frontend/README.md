# MEGS Frontend

The web app for the MEGS Recruitment Management System. It has separate areas for applicants, Talent Acquisition (TA) staff and Admins, plus the public job site. Built with React 19, Vite, Tailwind CSS v4 and TanStack Query, Router and Table.

## Directory structure

```text
frontend/
├── src/
│   ├── components/       Shared UI components, data tables, dialogs
│   ├── layouts/          Layouts for Admin, TA, Applicant and sign-in pages
│   ├── pages/
│   │   ├── admin/        Users, audit logs, settings, reports
│   │   ├── ta/           Job postings, manpower requests, candidates, interviews
│   │   ├── applicant/    Profile, applications, documents, job search
│   │   └── auth/         Sign-in, registration, password recovery
│   ├── lib/api/          API clients, types and TanStack Query hooks
│   ├── routes.tsx        Router configuration and role guards
│   ├── main.tsx          Entry point
│   └── index.css         Tailwind CSS v4 theme tokens
├── e2e/                  Playwright end-to-end tests
├── vite.config.ts        Vite configuration
└── package.json
```

## Tech stack

| Area | Technology |
| :--- | :--- |
| Framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Server state | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Validation | Zod |

## Getting started

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

| Variable | Purpose |
| :--- | :--- |
| `VITE_API_URL` | Backend API address, for example `http://localhost:3000/api` |
| `VITE_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key |
| `VITE_DISABLE_CAPTCHA` | Set to `true` to skip the CAPTCHA widget in local development |
| `VITE_ENABLE_QUERY_DEVTOOLS` | Set to `true` to show the React Query devtools |

Start the dev server on http://localhost:5173:

```bash
npm run dev
```

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

Run tests:

```bash
npm test
npm run test:e2e
```

## Design principles

- Dense, easy-to-scan tables and forms. Few nested cards.
- High contrast, little animation and no decorative effects.
- Every screen handles loading, empty, error and success states.
