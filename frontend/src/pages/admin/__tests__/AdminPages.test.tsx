import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminDashboard } from "../AdminDashboard";
import { UsersPage } from "../UsersPage";
import { ScoringConfigPage } from "../ScoringConfigPage";
import { ScoringQualityPage } from "../ScoringQualityPage";
import { RevalidationQueuePage } from "../RevalidationQueuePage";
import { AuditLogsPage } from "../AuditLogsPage";

// Mock useAuth
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR" },
    isAuthenticated: true,
  }),
}));

// Mock adminApi
vi.mock("../../../lib/api/admin.api", () => ({
  adminApi: {
    listUsers: vi.fn().mockResolvedValue([
      {
        id: "admin-1",
        email: "admin@megs.ph",
        role: "ADMINISTRATOR",
        isActive: true,
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "ta-1",
        email: "recruiter@megs.ph",
        role: "TALENT_ACQUISITION",
        isActive: true,
        createdAt: "2026-08-05T00:00:00Z",
      },
    ]),
    getScoringConfig: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      revision: 3,
      scope: "DEFAULT",
      status: "ACTIVE",
      activatedAt: "2026-08-10T00:00:00Z",
      weights: {
        SKILLS: 30,
        EXPERIENCE: 25,
        LOCATION: 15,
        COMPLIANCE: 15,
        EDUCATION_CERTIFICATIONS: 15,
      },
      knnSettings: {
        defaultK: 10,
        maximumK: 50,
        minimumSimilarity: 0.5,
        excludeCurrentlyHired: true,
      },
      matchThreshold: 60,
    }),
    getScoringConfigHistory: vi.fn().mockResolvedValue([]),
    getRevalidationStatus: vi.fn().mockResolvedValue({
      counts: { PENDING: 4, PROCESSING: 1, COMPLETED: 150, FAILED: 0 },
      failures: [],
    }),
    getQualityMetrics: vi.fn().mockResolvedValue({
      totalCalculated: 150,
      averageFitScore: 79.5,
      minFitScore: 35,
      maxFitScore: 98,
      coveragePercentage: 100,
      knnLatencyP95: 38,
      scoreDistribution: {
        "80-100": 70,
        "60-79": 50,
        "40-59": 20,
        "20-39": 10,
        "0-19": 0,
      },
    }),
    listAuditLogs: vi.fn().mockResolvedValue([
      {
        id: 1,
        action: "SCORING_CONFIG_ACTIVATED",
        userId: "admin-1",
        entity: "CandidateScoringConfiguration",
        entityId: "1",
        createdAt: "2026-08-14T00:00:00Z",
      },
    ]),
  },
}));

// Mock tanstack router components
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Admin Interface Pages Suite", () => {
  it("renders AdminDashboard with telemetry and scoring matrix", async () => {
    renderWithClient(<AdminDashboard />);
    expect(await screen.findByText("System Administration & Governance")).toBeDefined();
    expect(await screen.findByText("Registered Accounts")).toBeDefined();
    expect(await screen.findByText("SCORING_CONFIG_ACTIVATED")).toBeDefined();
  });

  it("renders UsersPage with user list and action buttons", async () => {
    renderWithClient(<UsersPage />);
    expect(await screen.findByText("User Access & Role Administration")).toBeDefined();
    expect(await screen.findByText("admin@megs.ph")).toBeDefined();
    expect(await screen.findByText("recruiter@megs.ph")).toBeDefined();
  });

  it("renders ScoringConfigPage with dimension sliders and validation", async () => {
    renderWithClient(<ScoringConfigPage />);
    expect(await screen.findByText("Candidate Match Scoring Configuration")).toBeDefined();
    expect(await screen.findByText("1. Skills & Technical Competencies")).toBeDefined();
    expect(await screen.findByText("Talent Discovery & Match Parameters")).toBeDefined();
  });

  it("renders ScoringQualityPage with histogram and telemetry", async () => {
    renderWithClient(<ScoringQualityPage />);
    expect(await screen.findByText("Candidate Match Quality & Analytics")).toBeDefined();
    expect(await screen.findByText("Candidate Match Score Distribution")).toBeDefined();
  });

  it("renders RevalidationQueuePage with background worker counts", async () => {
    renderWithClient(<RevalidationQueuePage />);
    expect(await screen.findByText("Candidate Score Reassessment Queue")).toBeDefined();
    expect(await screen.findByText("Pending in Queue")).toBeDefined();
  });

  it("renders AuditLogsPage with filterable audit ledger", async () => {
    renderWithClient(<AuditLogsPage />);
    expect(await screen.findByText("Security & Administrative Audit Logs")).toBeDefined();
    expect(await screen.findByText("SCORING_CONFIG_ACTIVATED")).toBeDefined();
  });
});
