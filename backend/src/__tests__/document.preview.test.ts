import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import prisma from "../utils/prisma.js";
import { getDocumentPreview, uploadAndStoreDocument } from "../services/document/document.service.js";

describe("Document Preview API Service", () => {
  let applicantA: any;
  let applicantB: any;
  let taUser: any;
  let docA: any;

  beforeAll(async () => {
    applicantA = await prisma.user.create({
      data: {
        id: `cand-a-${Date.now()}`,
        email: `cand-a-${Date.now()}@example.com`,
        role: "APPLICANT",
      },
    });

    applicantB = await prisma.user.create({
      data: {
        id: `cand-b-${Date.now()}`,
        email: `cand-b-${Date.now()}@example.com`,
        role: "APPLICANT",
      },
    });

    taUser = await prisma.user.create({
      data: {
        id: `ta-user-${Date.now()}`,
        email: `ta-user-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "nbi-clearance.pdf",
      encoding: "7bit",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Mock PDF Content"),
      size: 26,
      destination: "",
      filename: "",
      path: "",
      stream: null as any,
    };

    await uploadAndStoreDocument(applicantA.id, "POST_HIRE", mockFile);
    docA = await prisma.storedDocument.findFirst({
      where: { ownerId: applicantA.id },
      orderBy: { uploadedAt: "desc" },
    });
  });

  afterAll(async () => {
    try {
      if (docA?.id) {
        await prisma.storedDocument.deleteMany({ where: { id: docA.id } });
      }
      if (applicantA?.id) {
        await prisma.user.deleteMany({ where: { id: applicantA.id } });
      }
      if (applicantB?.id) {
        await prisma.user.deleteMany({ where: { id: applicantB.id } });
      }
      if (taUser?.id) {
        await prisma.user.deleteMany({ where: { id: taUser.id } });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  it("allows the owner (Applicant A) to get document preview details", async () => {
    const preview = await getDocumentPreview(docA.id, applicantA.id, applicantA.role);
    expect(preview.id).toBe(docA.id);
    expect(preview.originalName).toBe("nbi-clearance.pdf");
    expect(preview.mimeType).toBe("application/pdf");
    expect(preview.url).toBeDefined();
  });

  it("allows TA user to get document preview details", async () => {
    const preview = await getDocumentPreview(docA.id, taUser.id, taUser.role);
    expect(preview.id).toBe(docA.id);
    expect(preview.originalName).toBe("nbi-clearance.pdf");
    expect(preview.mimeType).toBe("application/pdf");
    expect(preview.url).toBeDefined();
  });

  it("blocks another applicant (Applicant B) from viewing Applicant A's document", async () => {
    await expect(
      getDocumentPreview(docA.id, applicantB.id, applicantB.role)
    ).rejects.toThrow("Unauthorized to access this document");
  });
});
