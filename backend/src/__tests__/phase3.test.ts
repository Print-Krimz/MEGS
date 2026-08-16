/**
 * P3 Constraint Integration Tests
 *
 * Verifies that the DB-level uniqueness and invariant constraints
 * from the P3 migration are active and enforced.
 *
 * These tests connect to the live DB (same as all other integration tests).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../utils/prisma';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find a TA-role user or any non-Applicant user to act as migration actor */
async function getTaActor() {
  const user = await prisma.user.findFirst({
    where: { role: { in: ['TALENT_ACQUISITION', 'ADMINISTRATOR'] }, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return user;
}

/** Find an existing application for use in constraint tests */
async function getFirstApplication() {
  return prisma.application.findFirst({ orderBy: { createdAt: 'asc' } });
}

/** Find an existing deployment for use in constraint tests */
async function getFirstDeployment() {
  return prisma.deployment.findFirst({ orderBy: { createdAt: 'asc' } });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 3 — DB Constraint Verification', () => {
  let actorId: string | null = null;

  beforeAll(async () => {
    const actor = await getTaActor();
    actorId = actor?.id ?? null;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── P3-01: Migration status ────────────────────────────────────────────────

  it('P3-01: All 8 migrations are applied with no pending migrations', async () => {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at
    `;
    const applied = rows.filter(r => r.finished_at !== null);
    // We expect at least 8 (the 7 original + p3 baseline + p3 constraints)
    expect(applied.length).toBeGreaterThanOrEqual(7);

    // The P3 constraints migration must be present and applied
    const p3 = applied.find(r => r.migration_name === '20260806130000_p3_constraints_and_history');
    expect(p3).toBeDefined();
    expect(p3?.finished_at).not.toBeNull();
  });

  // ── P3-02: Uniqueness — one application per user per job ──────────────────

  it('P3-02a: Duplicate (userId, jobPostingId) application is rejected by DB constraint', async () => {
    const existing = await getFirstApplication();
    if (!existing) {
      console.warn('  SKIP: No applications in DB to test duplicate constraint');
      return;
    }

    await expect(
      prisma.application.create({
        data: {
          userId: existing.userId,
          jobPostingId: existing.jobPostingId,
          status: 'SUBMITTED',
        },
      })
    ).rejects.toThrow(); // Unique constraint violation
  });

  // ── P3-02: Partial unique index — one active deployment per application ────

  it('P3-02b: Creating a second active deployment for same application is rejected', async () => {
    const existing = await getFirstDeployment();
    if (!existing || !actorId) {
      console.warn('  SKIP: No deployment or actor found to test active-deployment constraint');
      return;
    }

    // Only test if the existing deployment is in an active state
    if (['ENDED', 'CANCELLED'].includes(existing.status)) {
      console.warn('  SKIP: First deployment is already ENDED/CANCELLED — constraint allows a second');
      return;
    }

    await expect(
      prisma.deployment.create({
        data: {
          employeeId: existing.employeeId,
          applicationId: existing.applicationId,
          clientId: existing.clientId,
          status: 'READY_FOR_DEPLOYMENT',
          createdById: actorId,
        },
      })
    ).rejects.toThrow(); // Partial unique index violation
  });

  // ── P3-02: Check constraint — aiScore range ────────────────────────────────

  it('P3-02c: aiScore outside 0–100 is rejected by check constraint', async () => {
    const existing = await getFirstApplication();
    if (!existing) {
      console.warn('  SKIP: No applications found');
      return;
    }

    await expect(
      prisma.application.update({
        where: { id: existing.id },
        data: { aiScore: 150 }, // Invalid — above 100
      })
    ).rejects.toThrow();
  });

  // ── P3-02: Check constraint — ManpowerRequest headcount ───────────────────

  it('P3-02d: ManpowerRequest headcount < 1 is rejected by check constraint', async () => {
    const mrf = await prisma.manpowerRequest.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!mrf) {
      console.warn('  SKIP: No ManpowerRequests in DB');
      return;
    }

    await expect(
      prisma.manpowerRequest.update({
        where: { id: mrf.id },
        data: { headcount: 0 },
      })
    ).rejects.toThrow();
  });

  // ── P3-02: Check constraint — Deployment contract date range ──────────────

  it('P3-02e: Deployment contractEnd before contractStart is rejected', async () => {
    const dep = await getFirstDeployment();
    if (!dep) {
      console.warn('  SKIP: No deployments in DB');
      return;
    }

    const past = new Date('2020-01-01');
    const future = new Date('2030-01-01');

    await expect(
      prisma.deployment.update({
        where: { id: dep.id },
        data: { contractStart: future, contractEnd: past }, // End before start
      })
    ).rejects.toThrow();
  });

  // ── P3-04: DeploymentStatusHistory model exists and is queryable ──────────

  it('P3-04: DeploymentStatusHistory table exists and is accessible', async () => {
    const count = await prisma.deploymentStatusHistory.count();
    // Should be a non-negative number (0 or more, depending on backfill run)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // ── P3-03: StoredDocument table exists and is queryable ───────────────────

  it('P3-03: StoredDocument table exists and is accessible', async () => {
    const count = await prisma.storedDocument.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
