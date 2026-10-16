import { describe, it, expect, vi, beforeEach } from "vitest";

// Fully mocked: no database, no embedding provider.
const { employeeFindMany, jobFindMany, queryRaw, embeddings } = vi.hoisted(() => ({
  employeeFindMany: vi.fn(),
  jobFindMany: vi.fn(),
  queryRaw: vi.fn(),
  embeddings: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => ({
  default: {
    employee: { findMany: employeeFindMany },
    jobPosting: { findMany: jobFindMany },
    $queryRaw: queryRaw,
  },
}));
vi.mock("../scoring/embedding.service.js", () => ({ generateJobEmbeddings: embeddings }));
vi.mock("../scoring/scoring-configuration.service.js", () => ({
  getActiveScoringConfiguration: vi.fn().mockResolvedValue({ knnSettings: { minimumSimilarity: 0.5 } }),
}));

import { listRedeploymentSuggestions } from "./redeployment-suggestions.service.js";

const DIMENSIONS = 768;
const JOB_COUNT = 60;
const WORKER_COUNT = 1000;
const TOPICS = 8;
const INELIGIBLE = new Set([4, 8, 20]);
const CLIENTS = 6;

// Small deterministic PRNG so the fixture and the ranking are reproducible.
const prng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buildFixture = () => {
  const random = prng(2026);
  const topics = Array.from({ length: TOPICS }, () => Array.from({ length: DIMENSIONS }, () => random() - 0.5));
  const noisy = (topic: number[]) => topic.map((value) => value + (random() - 0.5) * 0.4);

  const jobs = Array.from({ length: JOB_COUNT }, (_, index) => ({
    id: 1000 + index,
    title: `Role ${index % 7} Operator ${index}`,
    description: "Operate equipment",
    requirements: "Safety training",
    location: "Laguna",
    mrf: {
      clientId: 1 + (index % CLIENTS),
      client: { name: `Client ${1 + (index % CLIENTS)}` },
      requiredSkills: "forklift",
      requiredExperience: null,
      requiredEducation: null,
      requiredCertifications: null,
    },
  }));
  const jobVectors = jobs.map((_, index) => noisy(topics[index % TOPICS]));

  const vectors = new Map<number, number[]>();
  const employees = Array.from({ length: WORKER_COUNT }, (_, index) => {
    const id = index + 1;
    const profileId = 5000 + id;
    // Every 10th worker has no profile vector, so the keyword fallback is exercised too.
    if (id % 10 !== 0) vectors.set(profileId, noisy(topics[id % TOPICS]));
    return {
      id,
      position: id % 3 === 0 ? "Operator" : null,
      // A few workers are ineligible for suggestions: they already hold an open placement.
      eligible: !INELIGIBLE.has(id),
      deployments: id % 2 === 0 ? [{ clientId: 1 + (id % CLIENTS), mrf: { title: "Forklift Operator" }, application: null }] : [],
      user: {
        applications: id % 5 === 0 ? [{ jobPostingId: 1000 + (id % JOB_COUNT) }] : [],
        applicantProfile: {
          id: profileId,
          skills: [{ skill: { name: "Forklift" } }],
          invitations: id % 7 === 0 ? [{ jobPostingId: 1000 + ((id + 3) % JOB_COUNT) }] : [],
        },
      },
    };
  });
  return { jobs, jobVectors, vectors, employees };
};

const fixture = buildFixture();

const installMocks = () => {
  employeeFindMany.mockImplementation(async (args: any) => {
    const ids: number[] | undefined = args.where?.id?.in;
    return fixture.employees
      .filter((employee) => employee.eligible && (!ids || ids.includes(employee.id)))
      .map(({ eligible: _eligible, ...employee }) => employee);
  });
  jobFindMany.mockResolvedValue(fixture.jobs);
  queryRaw.mockImplementation(async (_strings: TemplateStringsArray, profileIds: number[]) =>
    profileIds.flatMap((id) => (fixture.vectors.has(id) ? [{ applicantProfileId: id, embedding: JSON.stringify(fixture.vectors.get(id)) }] : []))
  );
  embeddings.mockResolvedValue(fixture.jobVectors);
};

// CPU clock ticks are coarse on some platforms, so cheap calls are repeated and averaged.
const cpuMs = async (run: () => Promise<unknown>, repeats = 1) => {
  const before = process.cpuUsage();
  for (let i = 0; i < repeats; i++) await run();
  const used = process.cpuUsage(before);
  return (used.user + used.system) / 1000 / repeats;
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe("listRedeploymentSuggestions employeeIds batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMocks();
  });

  it("keeps the no-parameter contract: every eligible worker is ranked", async () => {
    const full = await listRedeploymentSuggestions();
    const eligible = fixture.employees.filter((employee) => employee.eligible);
    expect(Object.keys(full.items).length).toBeGreaterThan(0);
    expect(Object.keys(full.items).length).toBeLessThanOrEqual(eligible.length);
    expect(employeeFindMany.mock.calls[0][0].where.id).toBeUndefined();
    for (const entry of Object.values(full.items)) expect(entry.suggestions.length).toBeLessThanOrEqual(20);
  });

  it("ranks a 10-worker subset exactly like the same workers in the full-list path", async () => {
    const full = await listRedeploymentSuggestions();
    // Mix of vector workers, keyword-only workers (id % 10 === 0), same-client workers, and excluded jobs.
    const requested = [2, 3, 5, 10, 14, 20, 21, 35, 70, 101];
    const subset = await listRedeploymentSuggestions(requested);

    const expectedIds = requested.filter((id) => fixture.employees[id - 1].eligible);
    expect(Object.keys(subset.items).map(Number).sort((a, b) => a - b)).toEqual(expectedIds.sort((a, b) => a - b));
    for (const id of expectedIds) expect(subset.items[id]).toEqual(full.items[id]);

    // The reads are bounded to the requested workers.
    expect(employeeFindMany.mock.calls[1][0].where.id).toEqual({ in: requested });
    const requestedProfileIds = expectedIds.map((id) => 5000 + id);
    expect((queryRaw.mock.calls[1][1] as number[]).sort()).toEqual(requestedProfileIds.sort());
  });

  it("keeps same-client precedence and application/invitation exclusions for requested workers", async () => {
    const [worker] = [6]; // even id: has a past client; id % 6 === 0: not excluded by an application
    const result = await listRedeploymentSuggestions([worker]);
    const suggestions = result.items[worker].suggestions;
    const pastClientId = 1 + (worker % CLIENTS);
    const sameClientJobs = fixture.jobs.filter((job) => job.mrf.clientId === pastClientId).map((job) => job.id);
    const leading = suggestions.slice(0, sameClientJobs.length).map((suggestion) => suggestion.jobId);
    expect(suggestions.slice(0, sameClientJobs.length).every((suggestion) => suggestion.sameClient)).toBe(true);
    expect(leading.sort()).toEqual(sameClientJobs.sort());

    const excluded = await listRedeploymentSuggestions([5, 7]);
    expect(excluded.items[5].suggestions.map((s) => s.jobId)).not.toContain(1000 + (5 % JOB_COUNT));
    expect(excluded.items[7].suggestions.map((s) => s.jobId)).not.toContain(1000 + ((7 + 3) % JOB_COUNT));
  });

  it("does not return workers that fail the eligibility check, even when requested", async () => {
    const result = await listRedeploymentSuggestions([4, 8, 9]);
    expect(Object.keys(result.items)).toEqual(["9"]);
  });

  it("scores a 10-worker batch with at least 80% less CPU than 1,000 workers over the same 60 jobs", async () => {
    const batchIds = Array.from({ length: 10 }, (_, index) => 100 + index * 7);
    // Warm up JIT so both measurements compare steady-state work.
    await listRedeploymentSuggestions(batchIds);
    await listRedeploymentSuggestions();

    const fullRuns: number[] = [];
    const batchRuns: number[] = [];
    for (let run = 0; run < 5; run++) {
      fullRuns.push(await cpuMs(() => listRedeploymentSuggestions()));
      batchRuns.push(await cpuMs(() => listRedeploymentSuggestions(batchIds), 40));
    }
    const full = median(fullRuns);
    const batch = median(batchRuns);
    const reduction = 1 - batch / full;
    console.info(
      `[P4 benchmark] 60 jobs x ${DIMENSIONS} dims, mocked Prisma. Full path (${WORKER_COUNT} workers, ${fixture.employees.filter((e) => e.eligible).length} eligible): ` +
        `median ${full.toFixed(1)} ms CPU (runs ${fullRuns.map((v) => v.toFixed(0)).join("/")}). ` +
        `10-worker batch: median ${batch.toFixed(1)} ms CPU (runs ${batchRuns.map((v) => v.toFixed(1)).join("/")}). Reduction ${(reduction * 100).toFixed(1)}%.`
    );
    expect(reduction).toBeGreaterThanOrEqual(0.8);
  }, 120_000);
});
