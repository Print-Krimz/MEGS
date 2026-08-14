export * from './enums';
import type {
  Role,
  JobStatus,
  ApplicationStatus,
  InterviewType,
  DeploymentStatus,
  EmploymentStatus,
  EmploymentEventType,
  CandidateScoringDimension,
  CandidateScoringConfigurationScope,
  CandidateScoringConfigurationStatus,
  CandidateScoreStatus,
  AssetVerificationState,
  TalentPoolStatus,
  CandidateAvailability,
  TalentPoolContactOutcome,
  DocumentCategory,
} from './enums';

// ── Generic API Response Envelope ───────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  error?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive?: boolean;
  accountStatus: 'INVITED' | 'ACTIVE' | 'DEACTIVATED' | 'PENDING_SETUP' | string;
  mustChangePassword?: boolean;
  invitedAt?: string | null;
  invitedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
  applicantProfile?: {
    firstName?: string;
    lastName?: string;
  } | null;
  firstName?: string;
  lastName?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SetupAccountRequest {
  token: string;
  password: string;
}

export interface InviteTARequest {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: Role;
}

// ── Applicant Profile Domain ────────────────

export interface WorkExperience {
  id: number;
  applicantProfileId: number;
  company: string;
  roleTitle: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  summary?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Education {
  id: number;
  applicantProfileId: number;
  school: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Skill {
  id: number;
  name: string;
}

export interface ApplicantSkill {
  applicantProfileId: number;
  skillId: number;
  skill: Skill;
}

export interface TrainingCertification {
  id: number;
  applicantProfileId: number;
  title: string;
  provider?: string | null;
  completionDate?: string | null;
  certificateNo?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Asset {
  id: number;
  applicantProfileId: number;
  label: string;
  fileUrl: string;
  notes?: string | null;
  documentType?: string | null;
  verificationState: AssetVerificationState;
  expiresAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharacterReference {
  id: number;
  applicantProfileId: number;
  name: string;
  relationship?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicantProfile {
  id: number;
  userId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  mobileNumber: string;
  gender: string;
  province: string;
  city: string;
  dateOfBirth: string;
  birthPlace: string;
  nationality: string;
  civilStatus: string;
  height?: number | null;
  weight?: number | null;
  religion?: string | null;
  address: string;
  preferredWorkLocations?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pagibig?: string | null;
  philhealth?: string | null;
  sss?: string | null;
  tin?: string | null;
  photoUrl?: string | null;
  resumeUrl?: string | null;
  professionalSummary: string;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactAddress?: string | null;
  additionalNotes?: string | null;
  isActive: boolean;
  hasConsentedToAi: boolean;
  createdAt: string;
  updatedAt: string;

  // Relations
  workExperiences?: WorkExperience[];
  educations?: Education[];
  skills?: (ApplicantSkill | string)[];
  trainings?: TrainingCertification[];
  assets?: Asset[];
  characterReferences?: CharacterReference[];
}

export interface UpsertApplicantProfileInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNumber: string;
  gender: string;
  province: string;
  city: string;
  dateOfBirth: string;
  birthPlace: string;
  nationality: string;
  civilStatus: string;
  height?: number;
  weight?: number;
  religion?: string;
  address: string;
  preferredWorkLocations?: string;
  pagibig?: string;
  philhealth?: string;
  sss?: string;
  tin?: string;
  professionalSummary: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactAddress?: string;
  additionalNotes?: string;
}

export interface AddWorkExperienceInput {
  company: string;
  roleTitle: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  summary?: string;
}

export interface AddEducationInput {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface AddTrainingInput {
  title: string;
  provider?: string;
  completionDate?: string;
  certificateNo?: string;
  notes?: string;
}

export interface AddReferenceInput {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface AddAssetInput {
  label: string;
  notes?: string;
  documentType?: string;
}

// ── Job Posting Domain ──────────────────────

export interface JobPosting {
  id: number;
  postedById: string;
  title: string;
  description: string;
  requirements: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  mrfId?: number | null;
  postedBy?: { id: string; email: string };
  mrf?: ManpowerRequest | null;
  _count?: {
    applications: number;
  };
}

export interface CreateJobInput {
  title: string;
  description: string;
  requirements: string;
  location?: string;
  status?: JobStatus;
  mrfId?: number;
}

export interface UpdateJobInput {
  title?: string;
  description?: string;
  requirements?: string;
  location?: string;
  status?: JobStatus;
  mrfId?: number;
}

// ── Application & Hiring Pipeline ───────────

export interface Application {
  id: number;
  userId: string;
  jobPostingId: number;
  status: ApplicationStatus;
  resumeUrl?: string | null;
  aiScore?: number | null;
  aiSummary?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  jobPosting: JobPosting;
  user: {
    id: string;
    email: string;
    applicantProfile?: ApplicantProfile | null;
  };
}

export interface ApplicationListItem {
  id: number;
  status: ApplicationStatus;
  aiScore?: number | null;
  aiSummary?: string | null;
  isArchived: boolean;
  createdAt: string;
  jobPosting: {
    id: number;
    title: string;
    location?: string | null;
  };
  user: {
    id: string;
    email: string;
    applicantProfile?: {
      firstName: string;
      lastName: string;
      mobileNumber: string;
      city: string;
      province: string;
      photoUrl?: string | null;
    } | null;
  };
  candidateFitScore?: number | null;
  candidateFitScoreCalculatedAt?: string | null;
  candidateScoringConfigurationVersion?: number;
}

export interface Interview {
  id: number;
  applicationId: number;
  type: InterviewType;
  scheduledAt?: string | null;
  conductedAt?: string | null;
  result?: string | null;
  notes?: string | null;
  complianceDeadline?: string | null;
  isCompliant?: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  application?: {
    id: number;
    jobPosting?: { id: number; title: string };
    user?: {
      email: string;
      applicantProfile?: { firstName: string; lastName: string };
    };
  };
}

export interface ScheduleInterviewInput {
  type: InterviewType;
  scheduledAt: string;
  notes?: string;
}

export interface UpdateInterviewStatusInput {
  result: 'PASS' | 'PASSED' | 'FAIL' | 'FAILED' | 'NO_SHOW' | 'PENDING';
  notes?: string;
  conductedAt?: string;
}

export interface ClientEndorsement {
  id: number;
  applicationId: number;
  clientId: number;
  client?: Client;
  outcome: string; // PENDING, ENDORSED, DECLINED
  endorsedById?: string | null;
  endorsedBy?: { id: string; email: string } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordEndorsementInput {
  clientId: number;
  outcome: 'ENDORSED' | 'DECLINED' | 'PENDING';
  notes?: string;
}

export interface ComplianceRequirement {
  id: number;
  applicationId: number;
  documentLabel: string;
  isRequired: boolean;
  deadline?: string | null;
  documentId?: number | null;
  reviewStatus: string; // PENDING, SUBMITTED, APPROVED, REJECTED, EXPIRED
  reviewedById?: string | null;
  reviewedBy?: { id: string; email: string } | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequirementInput {
  documentLabel: string;
  isRequired?: boolean;
  deadline?: string;
}

export interface ReviewRequirementInput {
  reviewStatus: 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
  expiresAt?: string;
}

export interface PostHireDocument {
  id: number;
  applicationId: number;
  label: string;
  fileUrl: string;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecruiterDecision {
  id: number;
  applicationId: number;
  actorId: string;
  actor: {
    id: string;
    email: string;
    role: Role;
  };
  fromStatus: string;
  toStatus: string;
  reason?: string | null;
  createdAt: string;
}

export interface ApplicationDetail extends Application {
  interviews: Interview[];
  clientEndorsements: ClientEndorsement[];
  complianceRequirements: ComplianceRequirement[];
  postHireDocuments?: PostHireDocument[];
  matchScore?: number;
  scoreBreakdown?: {
    skillsMatch?: number;
    experienceMatch?: number;
    educationMatch?: number;
    locationFit?: number;
  };
  aiStrengths?: string[];
  aiGaps?: string[];
}

export interface UpdateStatusInput {
  status: ApplicationStatus;
  reason?: string;
}

// ── Client & Manpower Request (MRF) ─────────

export interface Client {
  id: number;
  name: string;
  industry?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  manpowerRequests?: ManpowerRequest[];
  deployments?: Deployment[];
}

export interface CreateClientInput {
  name: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface ManpowerRequest {
  id: number;
  clientId: number;
  client: Client;
  title: string;
  description?: string | null;
  headcount: number;
  location?: string | null;
  targetFillDate?: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  requiredSkills?: string | null;
  requiredExperience?: string | null;
  requiredEducation?: string | null;
  requiredCertifications?: string | null;
  salaryRangeMin?: number | null;
  salaryRangeMax?: number | null;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'PROJECT_BASED' | null;
  workArrangement?: 'ONSITE' | 'REMOTE' | 'HYBRID' | null;
  complianceRequirements?: string | null;
  status: 'OPEN' | 'FILLED' | 'CANCELLED';
  createdById: string;
  createdAt: string;
  updatedAt: string;
  jobPostings?: JobPosting[];
  complianceTemplates?: MRFComplianceTemplate[];
  _count?: {
    deployments: number;
  };
}

export interface CreateMRFInput {
  clientId: number;
  title: string;
  description?: string;
  headcount: number;
  location?: string;
  targetFillDate?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  requiredSkills?: string;
  requiredExperience?: string;
  requiredEducation?: string;
  requiredCertifications?: string;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  employmentType?: string;
  workArrangement?: string;
  complianceRequirements?: string;
}

export interface MRFComplianceTemplate {
  id: number;
  mrfId?: number | null;
  clientId?: number | null;
  documentLabel: string;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplianceTemplateInput {
  documentLabel: string;
  isRequired?: boolean;
}

// ── Deployment & Employee ───────────────────

export interface Deployment {
  id: number;
  employeeId: number;
  employee: Employee;
  applicationId?: number | null;
  application?: Application | null;
  clientId: number;
  client: Client;
  mrfId?: number | null;
  mrf?: ManpowerRequest | null;
  status: DeploymentStatus;
  site?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: DeploymentStatusHistory[];
}

export interface DeploymentStatusHistory {
  id: number;
  deploymentId: number;
  fromStatus?: DeploymentStatus | null;
  toStatus: DeploymentStatus;
  changedById: string;
  changedBy: { id: string; email: string };
  reason?: string | null;
  createdAt: string;
}

export interface CreateDeploymentInput {
  employeeId?: number;
  clientId: number;
  mrfId?: number;
  site?: string;
  contractStart?: string;
  contractEnd?: string;
  notes?: string;
}

export interface UpdateDeploymentStatusInput {
  status: DeploymentStatus;
  reason?: string;
}

export interface Employee {
  id: number;
  userId: string;
  user: User & { applicantProfile?: ApplicantProfile | null };
  employeeNumber: string;
  status: EmploymentStatus;
  hireDate: string;
  department?: string | null;
  position?: string | null;
  notes?: string | null;
  originatingApplicationId?: number | null;
  createdAt: string;
  updatedAt: string;
  deployments?: Deployment[];
  employmentEvents?: EmploymentEvent[];
}

export interface EmploymentEvent {
  id: number;
  employeeId: number;
  eventType: EmploymentEventType;
  description: string;
  effectiveDate: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  createdAt: string;
}

export interface Digital201File {
  employee: Employee;
  applicantProfile: ApplicantProfile | null;
  deployments: Deployment[];
  complianceRequirements: ComplianceRequirement[];
  employmentEvents: EmploymentEvent[];
  storedDocuments: StoredDocument[];
}

export interface StoredDocument {
  id: number;
  ownerId: string;
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageBucket: string;
  storagePath: string;
  uploadedAt: string;
}

// ── Scoring & Talent Pool ───────────────────

export interface CandidateScore {
  id: number;
  applicationId: number;
  jobPostingId: number;
  configurationId: number;
  status: CandidateScoreStatus;
  skillsScore: number;
  experienceScore: number;
  locationScore: number;
  complianceScore: number;
  educationCertificationScore: number;
  finalFitScore: number;
  knnSimilarity?: number | null;
  explanation: Record<string, unknown>;
  calculatedAt: string;
}

export interface CandidateScoringWeight {
  id?: number;
  configurationId?: number;
  dimension: CandidateScoringDimension;
  weight: number;
}

export interface CandidateScoringConfiguration {
  id: number;
  scope: CandidateScoringConfigurationScope;
  status: CandidateScoringConfigurationStatus;
  version: number;
  revision: number;
  knnSettings: {
    defaultK?: number;
    maximumK?: number;
    minimumSimilarity?: number;
  };
  createdById?: string | null;
  activatedById?: string | null;
  activatedAt: string;
  supersededAt?: string | null;
  createdAt: string;
  weights: CandidateScoringWeight[];
}

export interface ScoringQualityMetrics {
  totalScoresCalculated: number;
  staleScoresCount: number;
  failedScoresCount: number;
  averageFitScore: number;
  scoreDistribution: Record<string, number>;
}

export interface RevalidationStatus {
  totalTasks: number;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export interface TalentPoolMembership {
  id: number;
  applicantProfileId: number;
  applicantProfile: ApplicantProfile & { user: { email: string } };
  sourceApplicationId?: number | null;
  status: TalentPoolStatus;
  availability: CandidateAvailability;
  addedById: string;
  addedAt: string;
  updatedAt: string;
  lastContactedAt?: string | null;
  notes?: string | null;
  contacts?: TalentPoolContact[];
}

export interface TalentPoolContact {
  id: number;
  membershipId: number;
  jobPostingId: number;
  recruiterId: string;
  outcome: TalentPoolContactOutcome;
  notes?: string | null;
  contactedAt: string;
}

export interface TalentPoolSearchResult {
  membership: TalentPoolMembership;
  similarityScore?: number;
  matchedSkills: string[];
}

// ── Notifications ───────────────────────────

export interface Notification {
  id: number;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export interface UnreadCountResponse {
  unreadCount?: number;
  count?: number;
}

// ── Analytics & Reports ─────────────────────

export interface PipelineStats {
  byStatus: Record<ApplicationStatus, number>;
  totalActive: number;
  totalHired: number;
  totalArchived: number;
}

export interface TimeToFillStats {
  averageDaysToScreening: number;
  averageDaysToEndorsement: number;
  averageDaysToOffer: number;
  averageDaysToHire: number;
  averageDaysToDeployment: number;
  overallTimeToFillDays: number;
}

export interface DeploymentStats {
  totalActiveDeployments: number;
  pendingOrientationCount: number;
  readyCount: number;
  dispatchedCount: number;
  byClient: {
    clientId: number;
    clientName: string;
    activeCount: number;
  }[];
}

export interface ComplianceOverviewStats {
  totalRequirements: number;
  approvedCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  complianceRatePercent: number;
}

// ── Audit Logs ──────────────────────────────

export interface AuditLog {
  id: number;
  userId?: string | null;
  user?: { id: string; email: string; role?: Role } | null;
  actor?: { id?: string; email?: string; role?: Role } | null;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  details?: string | Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  timestamp?: string;
}
