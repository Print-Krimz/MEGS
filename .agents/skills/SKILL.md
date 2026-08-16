---
name: development
description: Authoritative full-stack development skill for the Recruitment Management System. Consolidates frontend, backend, API contracts, database, design rules, and dual-environment execution (Codex & Antigravity).
---

# Recruitment Management System — Unified Development Skill

This skill is the single authoritative source of truth for full-stack engineering across the Recruitment Management System (RMS). It unifies frontend and backend design rules, API contracts, database guidelines, and environment integration.

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
Perform task following project architecture
```

---

## 2. Environment & Global Skill Integration

### Environment Detection

- **Antigravity Environment:** Detected when running inside Antigravity agent sessions (skills auto-discovered under `.agents/skills` and `C:\Users\cnico\.gemini\config\skills`).
- **Codex Environment:** Detected when running under OpenAI Codex / CLI sessions without native `.agents/` auto-loading.

### Global Skill Discovery Rules

1. **Do Not Hardcode Skill Names:** Never assume a global skill exists without verifying its availability.
2. **Antigravity Discovery:** Rely on native skill discovery or inspect global skill paths (`C:\Users\cnico\.gemini\config\skills`).
3. **Codex Discovery:** Inspect available skills via tool search or global config directories before invoking.
4. **Invocation:** If a relevant global skill exists (e.g., `react-best-practices`, `postgres-best-practices`, `ui-ux-pro-max`), invoke or reference it to enhance execution.
5. **Fallback:** If a global skill is unavailable, proceed using the instructions contained directly within this `SKILL.md`.

### Conflict Resolution

When instructions conflict across layers:
1. **Repository Codebase & Active Contracts (Highest Priority):** Verified backend contracts, database schema, and `agent/docs/architecture/tech-stack.md`.
2. **This Project SKILL.md:** Unified development boundaries and rules.
3. **Global Skills (Lowest Priority):** General design or stack patterns.

---

## 3. Core Engineering Principles

### Simplicity & Overengineering Prevention

- **Do Not Overengineer:** Keep the architecture simple, clean, and direct. Do not introduce unnecessary abstractions, complex routers, registries, factories, or multi-agent orchestration layers.
- **Avoid Complex Logic:** Prefer readable, standard, and maintainable code over hyper-abstracted or overly clever solutions.
- **Follow Existing Architecture:** Stick strictly to the established monolithic PERN patterns defined in `agent/docs/architecture/tech-stack.md`.
- **Maintainability:** Ensure code and agent skills remain easy to understand, inspect, and modify manually.
