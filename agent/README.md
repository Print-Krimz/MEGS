# MEGS Engineering & Architecture Documentation Hub (`agent/`)

Welcome to the **MEGS System Documentation Hub**. This directory provides technical specifications, database architecture, domain workflows, and research documentation for human engineers and AI agents.

---

## Directory Overview

```text
agent/
├── README.md                            # Documentation Hub overview & index (this file)
├── docs/                                # Active engineering documentation
│   ├── architecture/
│   │   ├── tech-stack.md                # Definitive PERN, Supabase SSR, Prisma, Gemini tech stack
│   │   └── frontend.md                  # Comprehensive React 19 + Vite frontend architecture & design
│   ├── research/
│   │   └── hiring-process.md            # Host company recruitment & canonical hiring pipeline
│   └── specs/
│       └── talent-pool-design.md        # Reusable talent pool, availability, and KNN discovery
└── archive/                             # Historical specifications & baseline gap analysis
    └── research-architecture.md         # Baseline CAP2 research-to-system alignment matrix
```

---

## 1. Active Architecture & Tech Stack (`docs/architecture/`)

| Document | Description |
| :--- | :--- |
| [**Tech Stack Specification**](./docs/architecture/tech-stack.md) | Node.js (ESM), Express 5, TypeScript, PostgreSQL (Supabase pooler/direct), Prisma 7.8 multi-schema, Google Gemini 2.5 AI parsing, Xenova Transformers vector search, SSE notifications, and private document vault. |
| [**Frontend Architecture & Design**](./docs/architecture/frontend.md) | Industrial utilitarian HR design tokens, React 19 + Vite, TanStack Query/Router/Table, Zod schemas, role-based auth layouts (Admin, TA, Applicant), and anti-AI-slop design rules. |

---

## 2. Domain Workflows & Research (`docs/research/` & `docs/specs/`)

| Document | Description |
| :--- | :--- |
| [**Host Company Hiring Process**](./docs/research/hiring-process.md) | End-to-end recruitment lifecycle: Manpower Requests (MRF), Gemini AI screening & deterministic candidate fit, TA review & client endorsement, final interviews, digital 201 compliance, and deployment. |
| [**Talent Pool Specification**](./docs/specs/talent-pool-design.md) | Reusable talent pool architecture, candidate availability tracking, recruiter contact logs, and KNN semantic similarity matching. |

---

## 3. Historical Archives (`archive/`)

| Document | Description |
| :--- | :--- |
| [**Research-Architecture Alignment**](./archive/research-architecture.md) | Historical CAP2 research-to-system traceability matrix, gap analysis, and phased remediation logs. |

---

## 4. Antigravity Agent Customizations (`.agents/`)

For AI agent execution runbooks, skill discovery, and orchestration rules, see the [`.agents/`](../.agents/README.md) directory:
- [Unified Development Skill](../.agents/skills/development/SKILL.md)
- [Frontend Architecture Skill](../.agents/skills/frontend/SKILL.md)
- [Agent Orchestration Rules](../.agents/rules/AGENTS.md)
