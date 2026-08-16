# AI Agent Customizations & Skills Hub (`.agents/`)

Welcome to the **Antigravity Customizations Hub** for the MEGS Recruitment Management System. This directory provides project-level rules, specialized agent skills, and workflow instructions automatically discovered by Antigravity and compatible agent environments.

---

## Directory Overview

```text
.agents/
├── README.md                            # Central customizations overview (this file)
├── rules/
│   └── AGENTS.md                        # Agent orchestration policy & safety constraints
└── skills/
    ├── development/                     # Authoritative Full-Stack & Backend Skill
    │   └── SKILL.md
    └── frontend/                        # HR/Recruitment Frontend Architecture & UI/UX Skill
        └── SKILL.md

agent/                                   # Project Engineering Documentation Hub (see agent/README.md)
├── README.md                            # Central architecture & engineering index
└── docs/                                # Detailed technical specifications & research
```

---

## 1. Project Agent Rules (`.agents/rules/`)

| Rule File | Description | Location |
| :--- | :--- | :--- |
| **Agent Orchestration Policy** | Single-agent default rules, sub-agent trigger boundaries, specialist roles, and safety policies. | [`rules/AGENTS.md`](./rules/AGENTS.md) |

---

## 2. Project Skills (`.agents/skills/`)

Antigravity automatically discovers and progressively discloses skills located under `.agents/skills/<skill-name>/SKILL.md`:

| Skill Name | Description | Location |
| :--- | :--- | :--- |
| **development** | Authoritative workflow for backend PERN engineering, Supabase server-only security, Prisma 7.8 multi-schema, and AI scoring contracts. | [`skills/development/SKILL.md`](./skills/development/SKILL.md) |
| **frontend** | React 19 + Vite frontend architecture, TanStack Query/Router/Table, Zod validation, and industrial utilitarian HR UI/UX design. | [`skills/frontend/SKILL.md`](./skills/frontend/SKILL.md) |

---

## 3. Engineering Documentation (`agent/docs/`)

For detailed technical specifications, database diagrams, API contracts, and domain research, refer to the [`agent/`](../agent/README.md) directory:

- [**Tech Stack Specification**](../agent/docs/architecture/tech-stack.md) — Node.js, Express 5, Prisma 7.8, Supabase SSR v2, pgvector, Gemini API.
- [**Frontend Architecture Guide**](../agent/docs/architecture/frontend.md) — Detailed UI design tokens, layout hierarchy, and component specs.
- [**Host Company Hiring Process**](../agent/docs/research/hiring-process.md) — Canonical hiring pipeline, MRF sourcing, Gemini AI assessment, digital 201 compliance.
- [**Talent Pool Specification**](../agent/docs/specs/talent-pool-design.md) — Reusable candidate pool, KNN semantic match, availability tracking.

---

## 4. Execution Protocol for AI Agents

1. **Load Relevant Skill:**
   - Full-stack & backend tasks: [`skills/development/SKILL.md`](./skills/development/SKILL.md)
   - Frontend & UI tasks: [`skills/frontend/SKILL.md`](./skills/frontend/SKILL.md)
2. **Adhere to Architectural Boundaries:**
   - Supabase client is server-only with `SUPABASE_SECRET_KEY` (`sb_secret_xxx`).
   - Authentication is mediated via server session endpoints (`/api/auth/*`).
   - Applicant documents are private and accessed only via short-lived signed URLs.
   - Maintain the Gemini assessment baseline threshold (60) and deterministic Candidate Fit calculation.
3. **Verify Before Completion:** Always verify types, contracts, and tests before concluding.
