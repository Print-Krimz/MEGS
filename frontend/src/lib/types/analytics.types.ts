export type AnalyticsDateRangePreset = "7d" | "30d" | "90d" | "custom";

export interface AnalyticsFilterState {
  range: AnalyticsDateRangePreset;
  startDate?: string;
  endDate?: string;
  clientId?: number;
  mrfId?: number;
  jobPostingId?: number;
  /** Admin only. A TA's numbers are always their own. */
  recruiterId?: string;
}

export interface TAPendingActionItem {
  id: string;
  type: "INITIAL_INTERVIEW" | "CLIENT_ENDORSEMENT" | "FINAL_INTERVIEW" | "COMPLIANCE_REVIEW" | "START_CONFIRMATION" | "CONTRACT_SIGNING";
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

export type StageRowKey =
  | "APPLIED"
  | "INITIAL_SCREENING"
  | "CLIENT_ENDORSEMENT"
  | "FINAL_INTERVIEW"
  | "COMPLIANCE"
  | "CONTRACT_SIGNING"
  | "DEPLOYED";

export interface DeliveryDateRange {
  startDate: string;
  endDate: string;
  days: number;
}

export interface StageTableRow {
  stage: StageRowKey;
  label: string;
  inStageNow: number;
  /** Past the stage limit, measured from a recorded stage change (or a late requirement). */
  overdue: number;
  /** Past the limit only by application age: no stage change was recorded, so the real wait may be shorter. */
  overdueEstimated: number;
  entered: number;
  backedOut: number;
  avgDaysInStage: number | null;
  medianDaysInStage: number | null;
  slaDays: number;
}

export interface DropOffRow {
  stage: StageRowKey;
  label: string;
  reached: number;
  inStage: number;
  movedForward: number;
  backedOut: number;
  rejected: number;
}

export interface ClosureCounts {
  total: number;
  talentPool: number;
  archive: number;
  /** Closed before a disposition was recorded (older records). */
  notRecorded: number;
}

export interface ClosureSummary {
  rejected: ClosureCounts;
  backedOut: ClosureCounts;
  topRejectionReasons: { reason: string; count: number }[];
  rejectedByStage: { stage: string; label: string; count: number }[];
}

export interface BackoutSummary {
  withdrawals: number;
  backouts: number;
  byParty: { APPLICANT: number; CLIENT: number; AGENCY: number };
  byStage: { stage: StageRowKey; label: string; APPLICANT: number; CLIENT: number; AGENCY: number; total: number }[];
  topReasons: { reason: string; count: number }[];
  /** Backouts recorded as NO_SHOW. Also counted by stage above. */
  noShows: number;
  byClient: { clientName: string; count: number }[];
  byRequest: { mrfId: number; title: string; clientName: string | null; count: number }[];
  recent: {
    applicationId: number;
    candidateName: string;
    jobTitle: string;
    clientName: string | null;
    mrfId: number | null;
    stage: string;
    party: "APPLICANT" | "CLIENT" | "AGENCY";
    reason: string;
    occurredAt: string;
  }[];
}

export interface ClientDecisions {
  accepted: number;
  declined: number;
}

export interface DeliveryKpis {
  /** Now: seats filled across the requisitions in scope. */
  fillRate: number;
  filledSeats: number;
  requestedSeats: number;
  openSeats: number;
  requisitions: { total: number; open: number; overdue: number; atRisk: number; filled: number };
  /** In period: deployments whose actual start date falls in the selected range. */
  placementsStarted: number;
  newStarts: number;
  redeployStarts: number;
  /** In period: Manila calendar days from requisition created to actual start. */
  medianDaysToFill: number | null;
  daysToFillSample: number;
  /** In period: left at or after client review. Rate = backouts / (backouts + starts that came from an application). */
  backoutsAfterClientReview: number;
  backoutRate: number;
  backoutRateBase: number;
  /** Now: candidates in the pipeline. */
  activeApplicants: number;
  overdueCandidates: number;
  overdueEstimated: number;
  /** Candidates on a closed job or a filled or cancelled requisition. Not counted as overdue. */
  closedOpenings: number;
  /** Verified overdue candidates who have waited at least twice the stage limit. */
  criticalCandidates: number;
  /** Candidates on openings not linked to any request, so no request counts them. */
  unlinkedApplicants: number;
  /** Requisitions marked FILLED that have no deployment behind them. Excluded from seat counts. */
  staleFilledRequisitions: number;
}

export interface TeamRow {
  recruiterId: string;
  name: string;
  active: number;
  overdue: number;
  overdueEstimated: number;
  openRequisitions: number;
  requestedSeats: number;
  filledSeats: number;
  fillRate: number;
  sentToClient: number;
  newStarts: number;
  redeployStarts: number;
  placed: number;
  backouts: number;
  backoutRate: number;
  medianDaysToFill: number | null;
}

/** Why an open request has nothing moving: no opening posted, no applicants, or only first-stage applicants. */
export type RequestAttention = "NO_OPENING" | "NO_APPLICANTS" | "FIRST_STAGE_ONLY" | null;

/** Work no recruiter owns: administrator-posted openings and requests with no assigned TA. */
export interface UnassignedWork {
  applicants: number;
  overdue: number;
  overdueEstimated: number;
  requests: number;
  requestedSeats: number;
  oldestWaitDays: number | null;
}

export interface RequestRow {
  mrfId: number;
  title: string;
  clientId: number;
  clientName: string;
  status: string;
  ownerId: string | null;
  ownerName: string;
  headcount: number;
  filled: number;
  openSeats: number;
  pipeline: number;
  overdueCandidates: number;
  jobCount: number;
  applicantCount: number;
  attention: RequestAttention;
  targetFillDate: string | null;
  daysRemaining: number | null;
  health: "FILLED" | "ON_TRACK" | "AT_RISK" | "OVERDUE";
  backoutsInPeriod: number;
}

export type TrendGranularity = "day" | "week" | "month";

export interface TrendPoint {
  start: string;
  label: string;
  newStarts: number;
  redeployStarts: number;
  /** Left after the client saw the candidate. */
  backouts: number;
  /** Left before the client saw the candidate. */
  withdrawals: number;
}

export interface Trend {
  granularity: TrendGranularity;
  points: TrendPoint[];
}

export interface StuckCandidate {
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  clientName: string | null;
  mrfId: number | null;
  recruiterId: string;
  recruiterName: string;
  stage: StageRowKey;
  stageLabel: string;
  daysInStage: number;
  slaDays: number;
  daysOver: number;
  urgency: "critical" | "overdue";
  /** No stage change was recorded, so days are counted from the application date. */
  estimated: boolean;
}

export interface TADeliveryDashboard {
  dateRange: DeliveryDateRange;
  kpis: DeliveryKpis;
  requests: RequestRow[];
  stageTable: StageTableRow[];
  dropOff: DropOffRow[];
  backouts: BackoutSummary;
  /** Rejected and Backed Out applications in the period, by disposition. Absent on older servers. */
  closures?: ClosureSummary;
  clientDecisions: ClientDecisions;
  /** The TA's own overdue candidates, longest wait first. */
  stuck: StuckCandidate[];
  stuckTotal: number;
  pendingActions: TAPendingActionItem[];
  /** True number of pending items; the list above is capped per category. */
  pendingActionsTotal: number;
  filterOptions: AnalyticsFilterOptions;
}

export interface AdminDeliveryDashboard {
  dateRange: DeliveryDateRange;
  kpis: DeliveryKpis;
  team: TeamRow[];
  unassigned: UnassignedWork;
  requests: RequestRow[];
  trend: Trend;
  backouts: BackoutSummary;
  clientDecisions: ClientDecisions;
  stageTable: StageTableRow[];
  stuck: StuckCandidate[];
  /** Total overdue items before the list is capped. */
  stuckTotal: number;
  filterOptions: AnalyticsFilterOptions;
}
