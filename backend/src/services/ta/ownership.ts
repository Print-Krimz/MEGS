// Single source of truth for which records a Talent Acquisition user owns.
// Chain: Client -> MRF -> JobPosting -> Application (interviews, endorsements, requirements) -> Deployment.
// Only TA users are restricted. Any other role (Admin) gets an empty filter, which matches everything.
import type { NextFunction, Request, Response } from "express";
import prisma from "../../utils/prisma.js";
import { sendError } from "../../utils/response.js";

export interface Actor {
  id: string;
  role: string;
}

type Where = Record<string, unknown>;
const restricted = (a: Actor) => a.role === "TALENT_ACQUISITION";

const mrf = (a: Actor): Where => (restricted(a) ? { assignedTaId: a.id } : {});

const client = (a: Actor): Where =>
  restricted(a) ? { OR: [{ assignedTaId: a.id }, { manpowerRequests: { some: { assignedTaId: a.id } } }] } : {};

// A job follows its requisition. Legacy jobs with no requisition stay with the TA who posted them.
const job = (a: Actor): Where =>
  restricted(a) ? { OR: [{ mrf: { is: { assignedTaId: a.id } } }, { mrfId: null, postedById: a.id }] } : {};

// The fields needed to resolve a job's owner; select them with JOB_OWNER_SELECT.
export interface JobOwnerFields {
  postedById: string;
  mrfId: number | null;
  mrf?: { assignedTaId: string | null } | null;
}

export const JOB_OWNER_SELECT = { postedById: true, mrfId: true, mrf: { select: { assignedTaId: true } } } as const;

// Same rule as job(): the requisition's assignee (null when unassigned), else the poster of a legacy job.
export const jobOwnerTaId = (job: JobOwnerFields): string | null =>
  job.mrfId !== null ? job.mrf?.assignedTaId ?? null : job.postedById;

// Same rule as deployment(): its requisition's assignee, else its application's job owner, else whoever created it.
export const deploymentOwnerTaId = (d: {
  mrfId: number | null;
  mrf?: { assignedTaId: string | null } | null;
  application?: { jobPosting: JobOwnerFields | null } | null;
  createdById: string | null;
}): string | null => {
  if (d.mrfId !== null) return d.mrf?.assignedTaId ?? null;
  if (d.application?.jobPosting) return jobOwnerTaId(d.application.jobPosting);
  return d.createdById;
};

const application = (a: Actor): Where => (restricted(a) ? { jobPosting: { is: job(a) } } : {});

// A deployment follows its requisition, then its application's job, then its creator.
const deployment = (a: Actor): Where =>
  restricted(a)
    ? {
        OR: [
          { mrf: { is: { assignedTaId: a.id } } },
          { mrfId: null, application: { is: { jobPosting: { is: job(a) } } } },
          { mrfId: null, applicationId: null, createdById: a.id },
        ],
      }
    : {};

// A worker is owned through a deployment the TA owns, or the redeployment follow-up label.
const employee = (a: Actor): Where =>
  restricted(a) ? { OR: [{ deployments: { some: deployment(a) } }, { redeploymentOwnerId: a.id }] } : {};

// The redeployment pool is shared: every TA may see available workers and place them in their own openings.
const employeePool = (a: Actor): Where =>
  restricted(a) ? { OR: [employee(a), { status: "AVAILABLE_FOR_REDEPLOYMENT" }] } : {};

const requirement = (a: Actor): Where => (restricted(a) ? { application: { is: application(a) } } : {});
const interview = requirement;
const endorsement = requirement;

const template = (a: Actor): Where =>
  restricted(a) ? { OR: [{ mrf: { is: mrf(a) } }, { mrfId: null, client: { is: client(a) } }] } : {};

// A Talent Pool or Redeployment offer follows the job it offers.
const invitation = (a: Actor): Where => (restricted(a) ? { jobPosting: { is: job(a) } } : {});

export const ownedWhere = { mrf, client, job, application, deployment, employee, employeePool, requirement, interview, endorsement, template, invitation };

type Kind = keyof typeof ownedWhere | "candidate";

const LABEL: Record<Kind, string> = {
  mrf: "Manpower Request",
  client: "Client",
  job: "Job posting",
  application: "Application",
  deployment: "Deployment",
  employee: "Employee",
  employeePool: "Employee",
  requirement: "Requirement",
  interview: "Interview",
  endorsement: "Endorsement",
  template: "Compliance template",
  invitation: "Invitation",
  candidate: "Candidate",
};

const count = (kind: Exclude<Kind, "candidate">, where: Where): Promise<number> => {
  switch (kind) {
    case "mrf": return prisma.manpowerRequest.count({ where: where as any });
    case "client": return prisma.client.count({ where: where as any });
    case "job": return prisma.jobPosting.count({ where: where as any });
    case "application": return prisma.application.count({ where: where as any });
    case "deployment": return prisma.deployment.count({ where: where as any });
    case "employee":
    case "employeePool": return prisma.employee.count({ where: where as any });
    case "requirement": return prisma.complianceRequirement.count({ where: where as any });
    case "interview": return prisma.interview.count({ where: where as any });
    case "endorsement": return prisma.clientEndorsement.count({ where: where as any });
    case "template": return prisma.mRFComplianceTemplate.count({ where: where as any });
    case "invitation": return prisma.talentPoolInvitation.count({ where: where as any });
  }
};

/** Resolves true when the actor may touch the record. Unknown and unowned records look the same. */
export async function owns(kind: Kind, id: number | string, actor: Actor): Promise<boolean> {
  if (!restricted(actor)) return true;
  if (kind === "candidate") {
    // Profile id (number) or user id (uuid). A profile is owned when the person applied to an owned job.
    const byProfileId = typeof id === "number" || /^\d+$/.test(String(id));
    const user = { applications: { some: application(actor) } };
    return (
      (await prisma.applicantProfile.count({
        where: { ...(byProfileId ? { id: Number(id) } : { userId: String(id) }), user: { is: user } } as any,
      })) > 0
    );
  }
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return false;
  return (await count(kind, { id: numeric, ...ownedWhere[kind](actor) })) > 0;
}

/** Throws a "not found" error (mapped to 404 by the existing handlers) when the actor does not own the record. */
export async function assertOwns(kind: Kind, id: number | string, actor: Actor): Promise<void> {
  if (!(await owns(kind, id, actor))) throw new Error(`${LABEL[kind]} not found`);
}

/** Route guard: 404 unless the TA owns the record named by `req.params[param]`. */
export const requireOwned = (kind: Kind, param = "id") =>
  // The tag lets a test confirm every by-id route carries a guard.
  Object.assign(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const raw = req.params[param];
        const id = Array.isArray(raw) ? raw[0] : raw;
        if (id === undefined || !req.user || !(await owns(kind, id, req.user))) {
          sendError(res, `${LABEL[kind]} not found`, 404);
          return;
        }
        next();
      } catch (error: any) {
        sendError(res, error.message, 500);
      }
    },
    { ownershipKind: kind }
  );

/** Route guard for an id in the request body. A missing field passes; schemas decide whether it is required. */
export const requireOwnedBody =
  (kind: Kind, field: string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const value = req.body?.[field];
      if (value === undefined || value === null || value === "") {
        next();
        return;
      }
      if (!req.user || !(await owns(kind, value, req.user))) {
        sendError(res, `${LABEL[kind]} not found`, 404);
        return;
      }
      next();
    } catch (error: any) {
      sendError(res, error.message, 500);
    }
  };
