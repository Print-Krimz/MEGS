---
trigger: always_on
---

# Project Agent Rules & Orchestration Policy

## Agent Orchestration Policy

Use a single-agent workflow by default.

Before creating sub-agents, evaluate whether the task can be cleanly separated.

### Available Specialist Roles:

- **Backend Agent:** Express 5, TypeScript, Prisma 7.8, Supabase SSR/Auth, Postgres, Candidate Scoring, Workers.
- **Frontend Agent:** React 19, Vite, TanStack Query/Router/Table, Tailwind CSS v4, Zod validation, HR UI/UX.
- **AI/RAG Agent:** Gemini API, Xenova Transformers embeddings, pgvector cosine similarity, scoring revalidation.
- **Reviewer/QA Agent:** Security audits, deterministic contract checks, integration testing.

### Sub-Agent Trigger Conditions:

Only use sub-agents when:

- The task has clearly separable workstreams.
- Specialized expertise materially helps.
- Parallel work provides real benefit.
- Independent verification is valuable.

### Rules:

1. Do not spawn agents unnecessarily.
2. Give each agent a clear, non-overlapping scope.
3. Do not allow agents to edit the same files concurrently.
4. Give sub-agents only relevant context and files.
5. Require concise handoff summaries.
6. Integrate work through the main agent.
7. Verify the implementation before declaring completion.
8. Prefer simple, readable solutions over unnecessary abstractions.
9. Do not overengineer the capstone.
