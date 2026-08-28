## Agent Orchestration Policy

Use a single-agent workflow by default.

Before creating sub-agents, evaluate whether the task can be cleanly separated.

Available specialist roles:

- Backend Agent
- Frontend Agent (HCI Guidelines: `frontend-hci`)
- AI/RAG Agent
- Reviewer/QA Agent (HCI 10-Point Review Checklist)

Only use sub-agents when:

- the task has clearly separable workstreams,
- specialized expertise materially helps,
- parallel work provides real benefit, or
- independent verification is valuable.

Rules:

- Do not spawn agents unnecessarily.
- Give each agent a clear, non-overlapping scope.
- Do not allow agents to edit the same files concurrently.
- Give sub-agents only relevant context and files.
- Require concise handoff summaries.
- Integrate work through the main agent.
- Verify the implementation before declaring completion (including the 10-point HCI review checklist).
- Prefer simple, readable solutions over unnecessary abstractions.
- Strictly avoid AI-generated UI slop and redundant microcopy.
- Do not overengineer the capstone.
