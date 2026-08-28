import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../utils/prisma.js";
import {
  generatePipelineReportPDF,
  generatePipelineReportXLSX,
  generateDeploymentReportPDF,
  generateDeploymentReportXLSX,
} from "./export.service.js";

vi.mock("../../utils/prisma.js", () => {
  return {
    default: {
      application: {
        findMany: vi.fn(),
      },
      deployment: {
        findMany: vi.fn(),
      },
    },
  };
});

describe("Export Service with Cascading Filter Support", () => {
  const user = { id: "recruiter-123", email: "ta@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pipeline Report Generation", () => {
    it("should query applications applying mrfId, jobPostingId, stage, and date range filters", async () => {
      (prisma.application.findMany as any).mockResolvedValue([
        {
          id: 101,
          status: "INITIAL_SCREENING",
          aiScore: 88,
          createdAt: new Date("2026-08-20T10:00:00.000Z"),
          jobPosting: {
            title: "Delivery Driver",
            mrf: { id: 457, title: "1 TARD" },
          },
          user: {
            email: "john@example.com",
            applicantProfile: { firstName: "John", lastName: "Doe" },
          },
        },
      ]);

      const filters = {
        mrfId: 457,
        jobPostingId: 777,
        stage: "INITIAL_SCREENING",
        range: "30d" as const,
      };

      const pdfBuffer = await generatePipelineReportPDF(user, filters);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            jobPostingId: 777,
            status: "INITIAL_SCREENING",
            jobPosting: expect.objectContaining({ mrfId: 457 }),
            createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        })
      );
    });

    it("should generate Excel spreadsheet with filtered applications", async () => {
      (prisma.application.findMany as any).mockResolvedValue([
        {
          id: 102,
          status: "CLIENT_ENDORSEMENT",
          aiScore: 92,
          createdAt: new Date("2026-08-22T10:00:00.000Z"),
          jobPosting: {
            title: "Operations Lead",
            mrf: { id: 600, title: "Logistics MRF" },
          },
          user: {
            email: "jane@example.com",
            applicantProfile: { firstName: "Jane", lastName: "Smith" },
          },
        },
      ]);

      const filters = {
        mrfId: 600,
        stage: "CLIENT_ENDORSEMENT",
      };

      const xlsxBuffer = await generatePipelineReportXLSX(user, filters);
      expect(xlsxBuffer).toBeInstanceOf(Buffer);
      expect(xlsxBuffer.length).toBeGreaterThan(0);

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "CLIENT_ENDORSEMENT",
            jobPosting: expect.objectContaining({ mrfId: 600 }),
          }),
        })
      );
    });
  });

  describe("Deployment Report Generation", () => {
    it("should query deployments applying mrfId and custom date range filters", async () => {
      (prisma.deployment.findMany as any).mockResolvedValue([
        {
          id: 501,
          status: "DEPLOYED",
          site: "Laguna Plant",
          contractStart: new Date("2026-08-01"),
          contractEnd: new Date("2027-08-01"),
          client: { name: "Acme Logistics" },
          mrf: { title: "1 TARD" },
          employee: null,
          application: {
            user: {
              email: "worker@example.com",
              applicantProfile: { firstName: "Juan", lastName: "Cruz" },
            },
          },
        },
      ]);

      const filters = {
        mrfId: 457,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      };

      const pdfBuffer = await generateDeploymentReportPDF(user, filters);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      expect(prisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mrfId: 457,
            createdAt: {
              gte: new Date("2026-08-01"),
              lte: new Date("2026-08-31T23:59:59.999Z"),
            },
          }),
        })
      );
    });

    it("should generate Excel spreadsheet with filtered deployments", async () => {
      (prisma.deployment.findMany as any).mockResolvedValue([]);

      const filters = {
        clientId: 521,
      };

      const xlsxBuffer = await generateDeploymentReportXLSX(user, filters);
      expect(xlsxBuffer).toBeInstanceOf(Buffer);
      expect(xlsxBuffer.length).toBeGreaterThan(0);

      expect(prisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 521,
          }),
        })
      );
    });
  });
});
