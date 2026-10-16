// Test-only data builder shared by the delivery parity test and the benchmark. Deterministic: no randomness besides a seeded PRNG.
export const FIXTURE_NOW = new Date("2026-10-14T04:00:00Z");
export const FIXTURE_FILTERS = { range: "custom", startDate: "2026-09-15", endDate: "2026-10-14" } as const;

const STATUSES = ["SUBMITTED", "REVIEW", "MATCHED", "INITIAL_SCREENING", "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED"];
const BACKOUT_STAGES = ["SUBMITTED", "INITIAL_SCREENING", "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING"];
const OWNERS = ["ta-1", "ta-2", "ta-3", "admin-1", null] as const;

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const person = (id: string, role = "TALENT_ACQUISITION") => ({ id, role, email: `${id}@megs.ph`, applicantProfile: null });
const dayAgo = (n: number) => new Date(FIXTURE_NOW.getTime() - n * 86_400_000);

export function buildWorld(apps: number, mrfCount: number, seed = 7) {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const users = [person("ta-1"), person("ta-2"), person("ta-3"), person("admin-1", "ADMINISTRATOR")];

  const mrfs = Array.from({ length: mrfCount }, (_, i) => {
    const owner = pick(OWNERS);
    const filled = Math.floor(r() * 3);
    return {
      id: i + 1,
      title: `Request ${i + 1}`,
      headcount: 1 + Math.floor(r() * 5),
      status: r() < 0.9 ? "OPEN" : "FILLED",
      targetFillDate: r() < 0.2 ? null : dayAgo(Math.floor(r() * 40) - 20),
      clientId: 1 + (i % 4),
      client: { name: `Client ${1 + (i % 4)}` },
      assignedTaId: owner,
      assignedTa: owner && owner !== "admin-1" ? person(owner) : null,
      deployments: Array.from({ length: filled }, (_, k) => ({ id: i * 10 + k })),
      _count: { jobPostings: Math.floor(r() * 3) },
    };
  });

  const jobFor = (mrfIdx: number | null) => {
    const m = mrfIdx === null ? null : mrfs[mrfIdx];
    return {
      title: `Job ${mrfIdx ?? "none"}`,
      mrfId: m ? m.id : null,
      status: r() < 0.1 ? "CLOSED" : "OPEN",
      postedById: pick(["ta-1", "ta-2", "admin-1"] as const),
      mrf: m ? { assignedTaId: m.assignedTaId, status: m.status, title: m.title, client: { name: m.client.name, reviewThresholdDays: r() < 0.5 ? 3 : null } } : null,
    };
  };

  const appRows = Array.from({ length: apps }, (_, i) => {
    const status = pick(STATUSES);
    const attempt = r() < 0.15 ? 2 : 1;
    return {
      id: i + 1,
      userId: `u${Math.floor(i / (attempt === 2 ? 1 : 1)) % Math.max(1, Math.floor(apps * 0.9))}`,
      jobPostingId: 1 + (i % Math.max(1, mrfCount)),
      attemptNumber: attempt,
      status,
      createdAt: dayAgo(Math.floor(r() * 60) + r()),
      user: { email: `c${i}@x.ph`, applicantProfile: r() < 0.5 ? { firstName: `F${i}`, lastName: `L${i}` } : null },
      jobPosting: jobFor(r() < 0.12 ? null : Math.floor(r() * mrfCount)),
      recruiterDecisions: r() < 0.6 ? [{ fromStatus: "SUBMITTED", toStatus: "INITIAL_SCREENING", createdAt: dayAgo(Math.floor(r() * 30)), isReverted: false }] : [],
      backout: r() < 0.08 ? { stage: pick(BACKOUT_STAGES) } : null,
    };
  });

  const decisionGroups = appRows
    .filter((a) => a.status !== "SUBMITTED" && r() < 0.8)
    .map((a) => ({ applicationId: a.id, toStatus: a.status, _max: { createdAt: dayAgo(Math.floor(r() * 25)) } }));
  const requirements = appRows.filter((a) => a.status === "COMPLIANCE" && r() < 0.4).map((a) => ({ applicationId: a.id }));
  const waiting = appRows.filter((a) => a.status === "DEPLOYED" && r() < 0.7).map((a) => ({ applicationId: a.id }));
  const enteredDecisions = appRows.filter(() => r() < 0.5).map((a) => ({ applicationId: a.id, toStatus: pick(STATUSES.slice(3)) }));

  const deployCount = Math.max(5, Math.floor(apps / 4));
  const deployments = Array.from({ length: deployCount }, (_, i) => {
    const m = r() < 0.15 ? null : mrfs[Math.floor(r() * mrfCount)];
    return {
      id: i + 1,
      employeeId: 1 + Math.floor(i * 0.8),
      createdAt: dayAgo(Math.floor(r() * 90)),
      actualStart: dayAgo(Math.floor(r() * 29) + r()),
      contractEnd: r() < 0.5 ? dayAgo(-30) : null,
      site: r() < 0.5 ? "Site A" : null,
      status: "ACTIVE",
      createdById: "admin-1",
      applicationId: r() < 0.7 ? i + 1 : null,
      client: r() < 0.9 ? { name: `Client ${1 + (i % 4)}` } : null,
      employee: { user: { email: `w${i}@x.ph`, applicantProfile: null } },
      mrf: m ? { id: m.id, title: m.title, createdAt: dayAgo(Math.floor(r() * 120)), assignedTaId: m.assignedTaId } : null,
      application: m ? null : { jobPosting: { postedById: pick(["ta-1", "ta-2", "admin-1"] as const), mrf: null } },
    };
  });
  const earlier = deployments.flatMap((d) => [{ employeeId: d.employeeId, createdAt: d.createdAt }, ...(r() < 0.3 ? [{ employeeId: d.employeeId, createdAt: dayAgo(200) }] : [])]);

  const backouts = Array.from({ length: Math.floor(apps / 10) }, (_, i) => {
    const j = jobFor(r() < 0.15 ? null : Math.floor(r() * mrfCount));
    return {
      applicationId: 1000 + i,
      stage: pick(BACKOUT_STAGES),
      party: pick(["APPLICANT", "CLIENT", "AGENCY"] as const),
      reason: pick(["NO_SHOW", "BETTER_OFFER", "HEALTH"] as const),
      occurredAt: dayAgo(Math.floor(r() * 30) + r()),
      notes: null,
      recordedBy: { email: "ta-1@megs.ph", applicantProfile: null },
      application: { user: { email: `b${i}@x.ph`, applicantProfile: null }, jobPosting: j },
    };
  });
  const closures = Array.from({ length: Math.floor(apps / 12) }, () => ({
    outcome: pick(["REJECTED", "BACKED_OUT"] as const),
    disposition: pick(["TALENT_POOL", "ARCHIVE", null] as const),
    stage: pick(BACKOUT_STAGES),
    reasonCode: pick(["QUALIFICATIONS_MISMATCH", "CLIENT_DECLINED", "HEALTH"] as const),
  }));
  const endorsements = Array.from({ length: Math.floor(apps / 8) }, (_, i) => ({
    applicationId: (i % Math.max(1, Math.floor(apps / 10))) + 1, // repeated endorsements of one application
    application: { jobPosting: jobFor(r() < 0.15 ? null : Math.floor(r() * mrfCount)) },
  }));

  return {
    users, mrfs, appRows, decisionGroups, requirements, waiting, enteredDecisions, deployments, earlier, backouts, closures, endorsements,
    clientDecisionGroups: [
      { outcome: "ENDORSED", _count: { _all: 5 } },
      { outcome: "APPROVED", _count: { _all: 2 } },
      { outcome: "DECLINED", _count: { _all: 3 } },
    ],
    staleFilled: 2,
  };
}

export type World = ReturnType<typeof buildWorld>;

/** Wire a world into the vi.fn mocks used by the delivery service. */
export function wireWorld(m: Record<string, any>, w: World) {
  m.applicationFindMany.mockImplementation(async (args: any) => (args.where?.isArchived !== undefined ? w.appRows.filter((a) => a.status !== "REJECTED") : w.appRows));
  m.decisionGroupBy.mockResolvedValue(w.decisionGroups);
  m.requirementFindMany.mockResolvedValue(w.requirements);
  m.deploymentFindMany.mockImplementation(async (args: any) => {
    if (args.where?.status === "READY_FOR_DEPLOYMENT") return w.waiting;
    if (args.where?.actualStart) return w.deployments;
    return w.earlier;
  });
  m.decisionFindMany.mockResolvedValue(w.enteredDecisions);
  m.backoutFindMany.mockResolvedValue(w.backouts);
  m.closureFindMany.mockResolvedValue(w.closures);
  m.endorsementFindMany.mockResolvedValue(w.endorsements);
  m.endorsementGroupBy.mockResolvedValue(w.clientDecisionGroups);
  m.userFindMany.mockResolvedValue(w.users);
  m.mrfFindMany.mockResolvedValue(w.mrfs);
  m.mrfCount.mockResolvedValue(w.staleFilled);
}
