import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import {
  AnalyticsFilterBar,
  RecruitmentActivityChart,
  RecruitmentFunnel,
  BottlenecksWidget,
  ApplicationsByJobChart,
  PendingActionsWidget,
} from "../index";
import type {
  RecruitmentActivityTrend,
  FunnelAnalytics,
  BottleneckItem,
  JobDemandItem,
  TAPendingActionItem,
  AnalyticsFilterOptions,
} from "../../../lib/types/analytics.types";

describe("Analytics Components Test Suite", () => {
  const mockOptions: AnalyticsFilterOptions = {
    clients: [{ id: 1, name: "Acme Corp" }],
    mrfs: [{ id: 10, title: "Q3 Expansion", clientId: 1 }],
    jobPostings: [{ id: 100, title: "Senior Electrician", mrfId: 10, postedById: "user-1" }],
    recruiters: [{ id: "user-1", name: "Recruiter Alice", email: "alice@megs.com" }],
    stages: [
      { key: "INITIAL_SCREENING", label: "Initial Screening" },
      { key: "DEPLOYED", label: "Deployed" },
    ],
  };

  it("renders AnalyticsFilterBar and handles range changes, Apply Filters, and Clear Filters", () => {
    const handleChange = vi.fn();
    render(
      <AnalyticsFilterBar
        filters={{ range: "30d" }}
        onChange={handleChange}
        options={mockOptions}
        showClientFilter={true}
        showRecruiterFilter={true}
      />
    );

    expect(screen.getByText("Last 30 Days")).toBeDefined();
    expect(screen.getByText("Last 7 Days")).toBeDefined();

    fireEvent.click(screen.getByText("Last 7 Days"));
    // Click "Apply Filters"
    const applyBtn = screen.getByRole("button", { name: /Apply Filters/i });
    fireEvent.click(applyBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ range: "7d" })
    );
  });

  it("handles cascading MRF to Job Posting selection and active filter chips", () => {
    const handleChange = vi.fn();
    render(
      <AnalyticsFilterBar
        filters={{ range: "30d", mrfId: 10, jobPostingId: 100, stage: "INITIAL_SCREENING" }}
        onChange={handleChange}
        options={mockOptions}
        showClientFilter={true}
        showRecruiterFilter={true}
      />
    );

    // Active filter chips should be rendered
    expect(screen.getByText(/Q3 Expansion/i)).toBeDefined();
    expect(screen.getByText(/Senior Electrician/i)).toBeDefined();
    expect(screen.getByText(/Initial Screening/i)).toBeDefined();

    // Clicking "Clear Filters" button resets all
    const clearBtn = screen.getByRole("button", { name: /Clear Filters/i });
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ range: "30d", mrfId: undefined, jobPostingId: undefined, stage: undefined })
    );
  });


  it("renders RecruitmentActivityChart with metric series and empty states", () => {
    const mockTrend: RecruitmentActivityTrend = {
      dateRange: { startDate: "2026-08-01", endDate: "2026-08-07", days: 7 },
      series: [
        {
          date: "2026-08-01",
          label: "Aug 1",
          applicationsReceived: 5,
          initialInterviewsCompleted: 3,
          clientEndorsements: 2,
          finalInterviewsCompleted: 1,
          candidatesMovedToCompliance: 1,
          candidatesDeployed: 1,
        },
      ],
      totals: {
        applicationsReceived: 5,
        initialInterviewsCompleted: 3,
        clientEndorsements: 2,
        finalInterviewsCompleted: 1,
        candidatesMovedToCompliance: 1,
        candidatesDeployed: 1,
      },
    };

    const { rerender } = render(
      <RecruitmentActivityChart data={mockTrend} title="Activity Trend" />
    );

    expect(screen.getByText("Activity Trend")).toBeDefined();
    expect(screen.getByText("Applications Received")).toBeDefined();
    expect(screen.getByText("Site Deployments")).toBeDefined();

    // Rerender with empty data
    rerender(
      <RecruitmentActivityChart
        data={{
          dateRange: { startDate: "2026-08-01", endDate: "2026-08-07", days: 7 },
          series: [],
          totals: {
            applicationsReceived: 0,
            initialInterviewsCompleted: 0,
            clientEndorsements: 0,
            finalInterviewsCompleted: 0,
            candidatesMovedToCompliance: 0,
            candidatesDeployed: 0,
          },
        }}
      />
    );

    expect(
      screen.getByText(/No recruitment activity was recorded for this period/i)
    ).toBeDefined();
  });

  it("renders RecruitmentFunnel stages and conversion rates", () => {
    const mockFunnel: FunnelAnalytics = {
      totalApplications: 100,
      stages: [
        { stage: "APPLICATIONS", label: "Applications", count: 100, conversionRate: 100, dropoffRate: 0, overallConversion: 100 },
        { stage: "INITIAL_SCREENING", label: "Initial Screening", count: 50, conversionRate: 50, dropoffRate: 50, overallConversion: 50 },
        { stage: "DEPLOYMENT", label: "Deployment", count: 10, conversionRate: 20, dropoffRate: 80, overallConversion: 10 },
      ],
    };

    render(<RecruitmentFunnel data={mockFunnel} />);

    expect(screen.getByText("Applications")).toBeDefined();
    expect(screen.getByText("Initial Screening")).toBeDefined();
    expect(screen.getByText("Deployment")).toBeDefined();
    expect(screen.getAllByText("10%").length).toBeGreaterThan(0); // Overall yield & stage yield
  });

  it("renders BottlenecksWidget with aging and SLA breach flags", () => {
    const mockBottlenecks: BottleneckItem[] = [
      {
        stageKey: "INITIAL_SCREENING",
        stageLabel: "Initial Screening",
        candidateCount: 12,
        averageAgingDays: 7,
        slaThresholdDays: 3,
        overdueCount: 8,
        severity: "CRITICAL",
        description: "Candidates awaiting recruiter interview",
      },
    ];

    render(<BottlenecksWidget bottlenecks={mockBottlenecks} />);

    expect(screen.getByText("Initial Screening")).toBeDefined();
    expect(screen.getByText("CRITICAL")).toBeDefined();
    expect(screen.getByText(/7 days/i)).toBeDefined();
    expect(screen.getByText(/8 candidates/i)).toBeDefined();
  });

  it("renders ApplicationsByJobChart with requisition details", () => {
    const mockJobs: JobDemandItem[] = [
      {
        jobId: 1,
        jobTitle: "HVAC Specialist",
        location: "Manila",
        status: "OPEN",
        mrfId: 10,
        mrfTitle: "Batch A",
        clientId: 1,
        clientName: "Alpha Corp",
        targetHeadcount: 5,
        totalApplications: 25,
        activeCandidates: 10,
        deployedCount: 2,
      },
    ];

    render(<ApplicationsByJobChart data={mockJobs} />);

    expect(screen.getByText("HVAC Specialist")).toBeDefined();
    expect(screen.getByText("Alpha Corp")).toBeDefined();
    expect(screen.getByText(/25 applications/i)).toBeDefined();
  });

  it("renders PendingActionsWidget with action items and direct action links", () => {
    const mockActions: TAPendingActionItem[] = [
      {
        id: "act-1",
        type: "INITIAL_INTERVIEW",
        title: "Schedule Initial Interview",
        candidateName: "John Doe",
        jobTitle: "HVAC Specialist",
        applicationId: 42,
        urgency: "HIGH",
        agingDays: 4,
        targetUrl: "/ta/interviews",
        createdAt: new Date().toISOString(),
      },
    ];

    const { rerender } = render(<PendingActionsWidget actions={mockActions} />);

    expect(screen.getByText("Schedule Initial Interview")).toBeDefined();
    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("HIGH PRIORITY")).toBeDefined();

    // Rerender empty
    rerender(<PendingActionsWidget actions={[]} />);
    expect(screen.getByText("All Recruiter Queues Up to Date")).toBeDefined();
  });
});
