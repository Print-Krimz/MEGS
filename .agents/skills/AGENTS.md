## Agent Orchestration Policy

Use a single-agent workflow by default.

Before creating sub-agents, evaluate whether the task can be cleanly separated.

Available specialist roles:

- Backend Agent
- Frontend Agent
- AI/RAG Agent
- Reviewer/QA Agent

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
- Verify the implementation before declaring completion.
- Prefer simple, readable solutions over unnecessary abstractions.
- Do not overengineer the capstone.
