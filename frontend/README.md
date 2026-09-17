# MEGS Frontend — Recruitment Management System

The modern, responsive Single Page Application (SPA) for the MEGS Recruitment Management System, built with **React 19**, **Vite**, **Tailwind CSS v4**, and the **TanStack suite**.

---

## 🏛 Architecture & Directory Structure

`	ext
frontend/
├── src/
│   ├── components/       # Reusable UI primitives, data tables, modals, badges
│   ├── layouts/          # Role-based layouts (AdminLayout, TALayout, ApplicantLayout, AuthLayout)
│   ├── pages/            # Role & public views
│   │   ├── admin/        # System administration, user management, audit logs
│   │   ├── ta/           # Talent Acquisition, MRF requisitions, candidate scoring, interviews
│   │   ├── applicant/    # Profile, applications, compliance uploads, job discovery
│   │   └── auth/         # Login, registration, password recovery
│   ├── lib/
│   │   └── api/          # Axios/Fetch clients, DTOs, and TanStack Query hooks
│   ├── routes.tsx        # Client router configuration & role guards
│   ├── main.tsx          # Application entry point & QueryClientProvider setup
│   └── index.css         # Tailwind CSS v4 design tokens and utilities
├── vite.config.ts        # Vite configuration (Port 5173)
└── package.json          # Dependencies & npm scripts
`

---

## 🚀 Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 19 | High-performance component composition |
| **Build Tool** | Vite 6 | Rapid HMR and optimized production bundles |
| **Styling** | Tailwind CSS v4 | CSS-first tokens, container queries, industrial utilitarian UI |
| **Icons** | Lucide React | Clean, consistent SVG icon set |
| **Server State** | TanStack Query v5 | Data fetching, background caching, and optimistic mutations |
| **Data Grids** | TanStack Table v8 | Headless candidate grids, server-side sorting, and filtering |
| **Validation** | Zod | Strict form schemas and runtime API contracts |

---

## 🛠 Getting Started

### 1. Install Dependencies
`ash
npm install
`

### 2. Environment Configuration
Create a .env file in the rontend/ directory (or configure via root .env):
`env
VITE_API_BASE_URL=http://localhost:3000/api
`

### 3. Development Server
Start the Vite local development server (runs on http://localhost:5173):
`ash
npm run dev
`

### 4. Build for Production
`ash
npm run build
npm run preview
`

---

## 🎨 UI/UX & Design Principles

The MEGS interface follows an **Industrial Utilitarian** design philosophy:
- **High Information Density:** Clean, scannable data tables with clear typography and minimal nested cards.
- **Accessible & Restrained:** High contrast ratios, no gratuitous animations, and zero AI-slop (no unnecessary gradients, purple glows, or floating decorative badges).
- **Comprehensive State Coverage:** Every view provides dedicated Loading, Empty, Error, and Success states.