export type AnalyticsDateRangePreset = "7d" | "30d" | "90d" | "custom";

export interface AnalyticsFilterState {
  range: AnalyticsDateRangePreset;
  startDate?: string;
  endDate?: string;
  clientId?: number;
  mrfId?: number;
  jobPostingId?: number;
  stage?: string;
  recruiterId?: string;
  mineOnly?: boolean;
}

export interface DailyActivityPoint {
  date: string;
  label: string;
  applicationsReceived: number;
  initialInterviewsCompleted: number;
  clientEndorsements: number;
  finalInterviewsCompleted: number;
  candidatesMovedToCompliance: number;
  candidatesDeployed: number;
}

export interface RecruitmentActivityTrend {
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  series: DailyActivityPoint[];
  totals: {
    applicationsReceived: number;
    initialInterviewsCompleted: number;
    clientEndorsements: number;
    finalInterviewsCompleted: number;
    candidatesMovedToCompliance: number;
    candidatesDeployed: number;
  };
}

export interface AdminOverviewStats {
  totalApplications: number;
  activeCandidates: number;
  talentPoolCandidates: number;
  clientEndorsements: number;
  candidatesInCompliance: number;
  totalDeployments: number;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversionRate: number; // % from previous stage
  dropoffRate: number;    // % lost from previous stage
  overallConversion: number; // % from total initial applications
}

export interface FunnelAnalytics {
  totalApplications: number;
  stages: FunnelStage[];
}

export interface BottleneckItem {
  stageKey: string;
  stageLabel: string;
  candidateCount: number;
  averageAgingDays: number;
  slaThresholdDays: number;
  overdueCount: number;
  severity: "HEALTHY" | "WARNING" | "CRITICAL";
  description: string;
}

export interface JobDemandItem {
  jobId: number;
  jobTitle: string;
  location: string;
  status: string;
  mrfId?: number | null;
  mrfTitle?: string | null;
  clientId?: number | null;
  clientName?: string | null;
  targetHeadcount: number;
  totalApplications: number;
  activeCandidates: number;
  deployedCount: number;
}

export interface TAOverviewStats {
  myActiveApplications: number;
  initialInterviewsPending: number;
  readyForEndorsement: number;
  pendingClientDecisions: number;
  finalInterviewsPending: number;
  awaitingCompliance: number;
}

export interface TAPendingActionItem {
  id: string;
  type: "INITIAL_INTERVIEW" | "CLIENT_ENDORSEMENT" | "FINAL_INTERVIEW" | "COMPLIANCE_REVIEW";
  title: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle: string;
  applicationId: number;
  urgency: "HIGH" | "MEDIUM" | "NORMAL";
  agingDays?: number;
  deadline?: string | null;
  targetUrl: string;
  createdAt: string;
}

export interface AnalyticsFilterOptions {
  clients: { id: number; name: string }[];
  mrfs: { id: number; title: string; clientId: number }[];
  jobPostings: { id: number; title: string; mrfId?: number | null; postedById: string }[];
  recruiters: { id: string; email: string; name: string }[];
  stages: { key: string; label: string }[];
}
