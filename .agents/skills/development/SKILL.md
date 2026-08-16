---
name: development
description: Authoritative full-stack development skill for the Recruitment Management System (MEGS). Consolidates backend PERN architecture, API contracts, Supabase security constraints, database guidelines, and environment integration (Codex & Antigravity).
---

# Recruitment Management System — Unified Development Skill

This skill is the authoritative source of truth for full-stack engineering across the Recruitment Management System (MEGS). It unifies backend PERN rules, API contracts, database guidelines, and dual-environment execution (Antigravity & Codex).

---

## 1. Overview & Execution Workflow

### Task Execution Protocol

When a task is received:

```text
Task received
    ↓
Inspect task and repository context
    ↓
Load this unified development SKILL.md
    ↓
Determine whether current environment is Codex or Antigravity
    ↓
Discover available global skills for that environment
    ↓
Invoke relevant global skills (if available)
    ↓
Perform task following project architecture & verified contracts
```

---

## 2. Environment & Global Skill Integration

### Environment Detection

- **Antigravity Environment:** Detected when running inside Antigravity agent sessions (skills auto-discovered under `.agents/skills/` and global config paths).
- **Codex Environment:** Detected when running under OpenAI Codex / CLI sessions without native `.agents/` auto-loading.

### Global Skill Discovery Rules

1. **Do Not Hardcode Skill Names:** Never assume a global skill exists without verifying its availability.
2. **Antigravity Discovery:** Rely on native skill discovery or inspect global skill paths (`~/.gemini/config/skills`).
3. **Codex Discovery:** Inspect available skills via tool search or global config directories before invoking.
4. **Invocation:** If a relevant global skill exists (e.g., `react-best-practices`, `postgres-best-practices`, `ui-ux-pro-max`), invoke or reference it to enhance execution.
5. **Fallback:** If a global skill is unavailable, proceed using the instructions contained directly within this project and active specs in `agent/docs/`.

### Conflict Resolution Hierarchy

When instructions conflict across layers:

1. **Repository Codebase & Active Contracts (Highest Priority):** Verified backend contracts, database schema (`backend/prisma/schema/`), and [`agent/docs/architecture/tech-stack.md`](../../../agent/docs/architecture/tech-stack.md).
2. **This Project SKILL.md:** Unified development boundaries and rules.
3. **Global Skills (Lowest Priority):** General design or stack patterns.

---

## 3. Core Architectural Boundaries & Contracts

### 1. Backend Security & Supabase Boundaries
- **Server-Side Only:** Supabase client is strictly initialized on the server (`backend/src/utils/supabase.ts`) using the Supabase Service Role Secret (`SUPABASE_SECRET_KEY` / `sb_secret_xxx`).
- **Client Authentication:** The client never imports or communicates directly with `@supabase/supabase-js`. All client authentication is mediated via server-issued session tokens and HTTP endpoints (`/api/auth/*`).
- **Private Document Vault:** Applicant documents (resumes, 201 compliance files) are strictly private. Files are uploaded via authenticated multipart endpoints (`/api/documents/upload`), stored in Supabase private buckets, and accessed only via short-lived signed URLs generated server-side.

### 2. Database & Schema Rules
- **Prisma 7.8 Multi-Schema:** Database schemas are partitioned by domain in `backend/prisma/schema/*.prisma` (`applicant.prisma`, `client.prisma`, `document.prisma`, `employee.prisma`, `job.prisma`, `main.prisma`, `scoring.prisma`, `talent-pool.prisma`, `user.prisma`).
- **Referential Integrity:** Enforce foreign key constraints and explicit deletion behaviors (`Restrict` for audit/financial records, `Cascade` only where explicitly permitted).

### 3. AI Assessment & Deterministic Scoring
- **Isolated AI Contract:** Resume parsing and assessment use Google Gemini (`gemini-2.5-flash`) with an advisory threshold baseline of 60.
- **Deterministic Fit:** Overall Candidate Fit calculations, KNN vector similarities (using Xenova Transformers embeddings and pgvector), and dynamic weight distributions must follow deterministic calculation services without heuristic deviation.

### 4. Canonical Pipeline State Machine
The application pipeline follows strict linear stages enforced by the backend transition state machine:
`SUBMITTED` → `INITIAL_SCREENING` → `CLIENT_ENDORSEMENT` → `FINAL_INTERVIEW` → `HIRED` → `COMPLIANCE` → `DEPLOYED` (with terminal paths `REJECTED`, `WITHDRAWN`, `TALENT_POOL`).

---

## 4. Engineering Principles

- **Simplicity & Anti-Overengineering:** Keep the architecture simple, clean, and direct. Do not introduce unnecessary abstractions, complex routers, factories, or multi-agent orchestration layers.
- **Readable Code:** Prefer standard, readable, and well-typed code over hyper-abstracted or overly clever solutions.
- **Documentation Alignment:** Keep active specifications in `agent/docs/` synchronized whenever core contracts change.
