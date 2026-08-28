# Agent Orchestration & Engineering Rules

## 1. Agent Orchestration Policy

- **Single-Agent Default:** Use a single-agent workflow by default.
- **Sub-Agent Delegation Criteria:** Spawn sub-agents only when:
  - The task has distinct, non-overlapping workstreams.
  - Specialized domain expertise materially helps (e.g., specialized test suites, deep security reviews).
  - Parallel work provides real performance or time benefits.
  - Independent verification or code review is required.

### Specialist Roles
- **Backend Agent:** Express 5, TypeScript, Prisma 7.8, Supabase SSR/Auth, Postgres, AI Scoring pipelines.
- **Frontend Agent:** React 19, Vite, TanStack Query/Router/Table, Tailwind CSS v4, Zod validation, HCI guidelines ([`.agents/skills/frontend-hci/SKILL.md`](.agents/skills/frontend-hci/SKILL.md)).
- **AI/RAG Agent:** Gemini API, Xenova embeddings, pgvector cosine similarity, scoring revalidation.
- **Reviewer/QA Agent:** Security audits, deterministic contract checks, integration tests, 10-point HCI UI/UX checklist.

### Sub-Agent Rules
- Do not spawn agents unnecessarily.
- Assign each sub-agent a clear, non-overlapping scope and relevant file list.
- Prevent concurrent edits to the same files.
- Require concise handoff summaries.
- Integrate all changes through the parent agent.

---

## 2. Core Engineering Principles

- **Simplicity First:** Prefer straightforward, readable, maintainable solutions over complex abstractions or overengineered patterns.
- **Source of Truth:** The backend schema and API contracts are authoritative. The frontend visualizes and operates against backend state.
- **HCI Usability Standard:** Prioritize clarity, simplicity, consistency, usability, and accessibility. Never introduce AI-generated UI slop, redundant microcopy, or technical jargon into end-user interfaces.
- **Verification Before Completion:** Always verify changes through type checking, test suites, or explicit file inspection and the 10-point HCI checklist before marking tasks complete.
