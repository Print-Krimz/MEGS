import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  jobPosting: { findUnique: vi.fn() }, deployment: { findFirst: vi.fn(), findMany: vi.fn() },
  application: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() }, complianceRequirement: { findMany: vi.fn() },
  ensureApplicantProfile: vi.fn(), generate: vi.fn(), reuse: vi.fn(), enqueue: vi.fn(), sideTask: vi.fn(),
  upload: vi.fn(), parse: vi.fn(), fill: vi.fn(), parseCount: vi.fn(), revalidate: vi.fn(), updateResume: vi.fn(),
}));
vi.mock("../../utils/supabase.js", () => ({ default: { storage: { from: () => ({}) } } }));
vi.mock("../../utils/prisma.js", () => ({ default: { jobPosting: mocks.jobPosting, deployment: mocks.deployment, application: mocks.application, complianceRequirement: mocks.complianceRequirement, resumeParseResult: { count: mocks.parseCount }, $executeRaw: vi.fn(), $transaction: async (fn: any) => fn({ jobPosting: mocks.jobPosting, application: mocks.application, $executeRaw: vi.fn() }) } }));
vi.mock("../../middleware/upload.middleware.js", () => ({ uploadFileToSupabase: vi.fn(), uploadFileToSupabaseWithInfo: mocks.upload }));
vi.mock("../../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../workers/resume.worker.js", () => ({ enqueueResumeAnalysis: mocks.enqueue, enqueueResumeSideTask: mocks.sideTask, trackFitRevalidation: vi.fn() }));
vi.mock("../scoring/scoring-configuration.service.js", () => ({ revalidateApplication: mocks.revalidate }));
vi.mock("./applicant.service.js", () => ({ ensureApplicantProfile: mocks.ensureApplicantProfile, updateProfileResumeService: mocks.updateResume, processResumeExtractionService: vi.fn(), applyExtractedProfileService: vi.fn() }));
vi.mock("./resume-merge.service.js", () => ({ parseResumeToProposal: mocks.parse, fillBlanksFromParse: mocks.fill }));
vi.mock("../ta/ta.compliance.service.js", () => ({ generateComplianceRequirementsFromMRF: mocks.generate, reuseValidSameClientDocuments: mocks.reuse }));
import { fetchJobDetails, getActiveDeploymentStatus, fetchMyDocuments, submitApplicationService } from "./application.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.jobPosting.findUnique.mockResolvedValue({ id: 1, status: "OPEN", title: "Operator", mrf: { clientId: 5, client: { id: 5, name: "Client A" } } });
  mocks.deployment.findFirst.mockResolvedValue(null);
  mocks.ensureApplicantProfile.mockResolvedValue({ resumeUrl: "private-resume" });
  mocks.generate.mockResolvedValue([]); mocks.reuse.mockResolvedValue(0);
  mocks.revalidate.mockResolvedValue(undefined); mocks.enqueue.mockResolvedValue(undefined); mocks.sideTask.mockResolvedValue(undefined);
  mocks.updateResume.mockResolvedValue(undefined); mocks.parseCount.mockResolvedValue(0);
  mocks.upload.mockResolvedValue({ url: "/api/documents/9/download", documentId: 9, sha256: "abc" });
  mocks.parse.mockResolvedValue({ id: 5, status: "PARSED" }); mocks.fill.mockResolvedValue(undefined);
  mocks.ensureApplicantProfile.mockResolvedValue({ id: 3, resumeUrl: "private-resume" });
  mocks.application.create.mockImplementation(async ({ data }) => ({ id: 22, createdAt: new Date(), ...data }));
});
describe("returning worker application contract", () => {
  it("shows Apply again when only historical completed applications exist", async () => {
    mocks.application.findFirst.mockResolvedValue(null);
    const result = await fetchJobDetails(1, "worker-1");
    expect(result.alreadyApplied).toBe(false);
    expect(mocks.application.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isArchived: false, OR: expect.arrayContaining([expect.objectContaining({ status: { notIn: ["BACKOUT", "ARCHIVED", "REJECTED", "DEPLOYED"] } })]) }) }));
  });
  it("locks a direct or scheduled placement even without a DEPLOYED application", async () => {
    mocks.deployment.findFirst.mockResolvedValue({ id: 4, client: { name: "Client A" }, application: null, mrf: { title: "Operator" } });
    await expect(getActiveDeploymentStatus("worker-1")).resolves.toMatchObject({ isCurrentlyDeployed: true, deploymentId: 4 });
    expect(mocks.deployment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { employee: { userId: "worker-1" }, status: { notIn: ["ENDED", "CANCELLED"] } } }));
  });
  it("automatically enters Requirements for a previously deployed same-client worker", async () => {
    mocks.application.findMany.mockResolvedValue([{ id: 8, status: "DEPLOYED", isArchived: false, attemptNumber: 1 }]);
    mocks.deployment.findMany.mockResolvedValue([{ id: 10, applicationId: 8 }]);
    mocks.application.findFirst.mockResolvedValue({ attemptNumber: 1 }); // the previous attempt sets the next attempt number
    const result = await submitApplicationService(1, "worker-1");
    expect(result.status).toBe("COMPLIANCE");
    expect(mocks.application.create).toHaveBeenCalledWith({ data: expect.objectContaining({ attemptNumber: 2, status: "COMPLIANCE" }) });
    expect(mocks.generate).toHaveBeenCalledWith(22);
    expect(mocks.reuse).toHaveBeenCalledWith(22, [8]);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it("starts from Submitted for a different client or no actual deployment history", async () => {
    mocks.application.findMany.mockResolvedValue([]); mocks.deployment.findMany.mockResolvedValue([]);
    await expect(submitApplicationService(1, "worker-1")).resolves.toMatchObject({ status: "SUBMITTED" });
    expect(mocks.enqueue).toHaveBeenCalledWith(22);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("prevents an unfinished second application", async () => {
    mocks.application.findMany.mockResolvedValue([{ id: 8, status: "COMPLIANCE", isArchived: false, attemptNumber: 1 }]);
    await expect(submitApplicationService(1, "worker-1")).rejects.toThrow("active application");
    expect(mocks.application.create).not.toHaveBeenCalled();
  });
  it("restricts My Documents to the signed-in applicant and uses a field allowlist", async () => {
    mocks.complianceRequirement.findMany.mockResolvedValue([]);
    await expect(fetchMyDocuments("worker-1")).resolves.toEqual([]);
    expect(mocks.complianceRequirement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { application: { userId: "worker-1" } }, select: expect.objectContaining({ updateRequestReason: true, updateRequestDeadline: true }) }));
  });

  describe("optional resume reading after the application is saved", () => {
    const file = { buffer: Buffer.from("resume"), mimetype: "application/pdf", originalname: "resume.pdf" } as Express.Multer.File;
    beforeEach(() => { mocks.application.findMany.mockResolvedValue([]); mocks.deployment.findMany.mockResolvedValue([]); mocks.application.findFirst.mockResolvedValue(null); });

    it("saves the application and responds while the provider read is still unresolved", async () => {
      mocks.parse.mockReturnValue(new Promise(() => undefined));
      mocks.enqueue.mockImplementation(async () => undefined); // admission only; the read runs later in the queue
      await expect(submitApplicationService(1, "worker-1", file)).resolves.toMatchObject({ id: 22, status: "SUBMITTED", resumeUrl: "/api/documents/9/download" });
      expect(mocks.application.create).toHaveBeenCalledTimes(1);
      expect(mocks.parse).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it("reads the resume, fills blanks on the first parse only, then scores, inside the queued step", async () => {
      await submitApplicationService(1, "worker-1", file);
      const [id, beforeAnalysis] = mocks.enqueue.mock.calls[0];
      expect(id).toBe(22);
      await beforeAnalysis();
      expect(mocks.parse).toHaveBeenCalledWith(expect.objectContaining({ profileId: 3, documentId: 9, source: "APPLICATION_SUBMIT" }));
      expect(mocks.fill).toHaveBeenCalledWith(5);
      expect(mocks.revalidate).toHaveBeenCalledWith(22, 1);
      expect(mocks.parse.mock.invocationCallOrder[0]).toBeLessThan(mocks.revalidate.mock.invocationCallOrder[0]);

      mocks.fill.mockClear(); mocks.parseCount.mockResolvedValue(1);
      await beforeAnalysis();
      expect(mocks.fill).not.toHaveBeenCalled();
    });

    it("still scores when the optional read fails", async () => {
      mocks.parse.mockRejectedValue(new Error("provider timeout"));
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      await submitApplicationService(1, "worker-1", file);
      await mocks.enqueue.mock.calls[0][1]();
      expect(mocks.revalidate).toHaveBeenCalledWith(22, 1);
    });

    it("keeps queue refusal visible as NEEDS_ATTENTION and scores immediately", async () => {
      mocks.enqueue.mockRejectedValue(new Error("closed"));
      mocks.application.update = vi.fn(async ({ data }) => ({ id: 22, createdAt: new Date(), jobPostingId: 1, resumeUrl: "/api/documents/9/download", ...data }));
      await expect(submitApplicationService(1, "worker-1", file)).resolves.toMatchObject({ status: "NEEDS_ATTENTION" });
      expect(mocks.revalidate).toHaveBeenCalledWith(22, 1);
    });

    it("runs the optional read through the bounded queue for a same-client returning worker", async () => {
      mocks.application.findMany.mockResolvedValue([{ id: 8, status: "DEPLOYED", isArchived: false, attemptNumber: 1 }]);
      mocks.deployment.findMany.mockResolvedValue([{ id: 10, applicationId: 8 }]);
      await expect(submitApplicationService(1, "worker-1", file)).resolves.toMatchObject({ status: "COMPLIANCE" });
      expect(mocks.enqueue).not.toHaveBeenCalled();
      expect(mocks.sideTask).toHaveBeenCalledTimes(1);
      expect(mocks.parse).not.toHaveBeenCalled();
    });
  });
});
