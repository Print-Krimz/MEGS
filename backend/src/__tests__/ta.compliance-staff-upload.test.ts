import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaMock } = vi.hoisted(() => {
const tx = {
  complianceRequirement: { findUnique: vi.fn(), update: vi.fn() },
  complianceDocumentVersion: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
};
const prismaMock = {
  complianceRequirement: { findUnique: vi.fn() },
  storedDocument: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn(tx)),
};
return { tx, prismaMock };
});
vi.mock("../utils/prisma.js", () => ({ default: prismaMock }));
vi.mock("../utils/supabase.js", () => ({ default: { auth: { getClaims: vi.fn() }, storage: { from: vi.fn() } } }));
vi.mock("../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../services/document/document.service.js", () => ({ uploadAndStoreDocument: vi.fn() }));
vi.mock("../services/ta/ownership.js", () => ({ assertOwns: vi.fn(), requireOwned: vi.fn(() => vi.fn()), JOB_OWNER_SELECT: {} }));

import { uploadComplianceDocumentForApplicant } from "../services/applicant/application.service.js";
import { uploadAndStoreDocument } from "../services/document/document.service.js";
import { assertOwns } from "../services/ta/ownership.js";
import { logAudit } from "../utils/audit.js";
import { sendNotification, sendRoleNotification } from "../utils/notification.js";

const actor = { id: "ta-1", role: "TALENT_ACQUISITION" };
const file = { buffer: Buffer.from("paper scan"), originalname: "nbi.jpg", mimetype: "image/jpeg" } as Express.Multer.File;

const requirement = (over: Record<string, unknown> = {}, app: Record<string, unknown> = {}) => ({
  id: 7,
  applicationId: 70,
  documentLabel: "NBI Clearance",
  reviewStatus: "PENDING",
  updateRequestedAt: null,
  updateRequestCompletedAt: null,
  application: {
    id: 70,
    userId: "applicant-1",
    status: "COMPLIANCE",
    isArchived: false,
    user: { email: "a@x.test", accountStatus: "WALK_IN", applicantProfile: { firstName: "Ana", lastName: "Cruz" } },
    jobPosting: { postedById: "ta-1", title: "Guard" },
    ...app,
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assertOwns).mockResolvedValue(undefined);
  prismaMock.complianceRequirement.findUnique.mockResolvedValue(requirement());
  prismaMock.storedDocument.findFirst.mockResolvedValue(null);
  vi.mocked(uploadAndStoreDocument).mockResolvedValue({ id: 99 } as any);
  tx.complianceRequirement.findUnique.mockResolvedValue({ id: 7, documentId: null });
  tx.complianceRequirement.update.mockResolvedValue({ id: 7, documentId: 99, reviewStatus: "SUBMITTED" });
});

describe("TA uploads a compliance document for an applicant", () => {
  it("stores under the applicant, links it, audits with the TA id and notifies no TA", async () => {
    const result = await uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file });
    expect(assertOwns).toHaveBeenCalledWith("requirement", 7, actor);
    expect(uploadAndStoreDocument).toHaveBeenCalledWith("applicant-1", "VAULT_201", file, 70);
    expect(tx.complianceRequirement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 }, data: expect.objectContaining({ documentId: 99, reviewStatus: "SUBMITTED" }) })
    );
    expect(result).toEqual({ id: 7, documentId: 99, reviewStatus: "SUBMITTED" });
    expect(logAudit).toHaveBeenCalledWith("ta-1", "COMPLIANCE_DOCUMENT_UPLOADED_BY_STAFF", "ComplianceRequirement", 7, {
      applicationId: 70,
      documentLabel: "NBI Clearance",
      applicantUserId: "applicant-1",
    });
    expect(sendRoleNotification).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled(); // walk-in: no login, no TA notice
  });

  it("notifies the applicant only when the account is ACTIVE", async () => {
    prismaMock.complianceRequirement.findUnique.mockResolvedValue(
      requirement({}, { user: { email: "a@x.test", accountStatus: "ACTIVE", applicantProfile: null } })
    );
    await uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNotification).mock.calls[0][0]).toBe("applicant-1");
    expect(sendRoleNotification).not.toHaveBeenCalled();
  });

  it("reuses an identical file the applicant already stored", async () => {
    prismaMock.storedDocument.findFirst.mockResolvedValue({ id: 55 });
    await uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file });
    expect(prismaMock.storedDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: "applicant-1", category: "VAULT_201" }) })
    );
    expect(uploadAndStoreDocument).not.toHaveBeenCalled();
    expect(tx.complianceRequirement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documentId: 55 }) })
    );
  });

  it("refuses a closed application", async () => {
    prismaMock.complianceRequirement.findUnique.mockResolvedValue(requirement({}, { isArchived: true }));
    await expect(uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file })).rejects.toThrow(/closed/);
    expect(uploadAndStoreDocument).not.toHaveBeenCalled();
  });

  it("refuses an approved requirement unless an update was requested", async () => {
    prismaMock.complianceRequirement.findUnique.mockResolvedValue(requirement({ reviewStatus: "APPROVED" }));
    await expect(uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file })).rejects.toThrow(/already been approved/);

    prismaMock.complianceRequirement.findUnique.mockResolvedValue(
      requirement({ reviewStatus: "APPROVED", updateRequestedAt: new Date() })
    );
    await expect(uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file })).resolves.toBeDefined();
  });

  it("refuses a TA who does not own the requirement", async () => {
    vi.mocked(assertOwns).mockRejectedValue(new Error("Requirement not found"));
    await expect(uploadComplianceDocumentForApplicant({ actor, requirementId: 7, file })).rejects.toThrow(/not found/);
    expect(prismaMock.complianceRequirement.findUnique).not.toHaveBeenCalled();
    expect(uploadAndStoreDocument).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
