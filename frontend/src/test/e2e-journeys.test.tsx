import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Routing Guards
import { RequireAuth } from '../App';
import { AdminLayout } from '../layouts/AdminLayout';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// Applicant Pages
import ApplicantProfilePage from '../pages/applicant/ApplicantProfilePage';
import ApplicantJobsPage from '../pages/applicant/ApplicantJobsPage';
import ApplicantJobDetailPage from '../pages/applicant/ApplicantJobDetailPage';
import ApplicantApplicationsPage from '../pages/applicant/ApplicantApplicationsPage';
import ApplicantApplicationDetailPage from '../pages/applicant/ApplicantApplicationDetailPage';

// Talent Acquisition Pages
import TADashboardPage from '../pages/ta/TADashboardPage';
import TAApplicationDetailPage from '../pages/ta/TAApplicationDetailPage';
import TAJobsPage from '../pages/ta/TAJobsPage';
import TAJobDetailPage from '../pages/ta/TAJobDetailPage';
import TAMRFsPage from '../pages/ta/TAMRFsPage';
import TAEmployeeDetailPage from '../pages/ta/TAEmployeeDetailPage';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminScoringPage from '../pages/admin/AdminScoringPage';
import AdminAuditLogsPage from '../pages/admin/AdminAuditLogsPage';

// Common / Error Pages & Components
import ForbiddenPage from '../pages/common/ForbiddenPage';
import { NotificationBell } from '../components/common/NotificationBell';

// Providers & APIs
import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { authApi } from '../lib/api/auth';
import { applicantApi } from '../lib/api/applicant';
import { taApi } from '../lib/api/ta';
import { adminApi } from '../lib/api/admin';
import { employeeApi } from '../lib/api/employees';
import { notificationApi } from '../lib/api/notifications';

// Types & Enums
import {
  Role,
  JobStatus,
  ApplicationStatus,
  InterviewType,
  InterviewResult,
  ComplianceReviewStatus,
  DeploymentStatus,
  EmploymentStatus,
  EmploymentEventType,
  CandidateScoringDimension,
  CandidateScoringConfigurationScope,
  CandidateScoringConfigurationStatus,
} from '../lib/types/enums';
import type {
  User,
  ApplicantProfile,
  JobPosting,
  ManpowerRequest,
  Employee,
  Digital201File,
  EmploymentEvent,
  CandidateScoringConfiguration,
  ScoringQualityMetrics,
  RevalidationStatus,
  AuditLog,
  Notification,
  AuthSession,
} from '../lib/types/api';

// ── Mock EventSource for Real-Time SSE ─────────────────────────────────────
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState: number = 0;
  onopen: ((ev: unknown) => unknown) | null = null;
  onmessage: ((ev: MessageEvent) => unknown) | null = null;
  onerror: ((ev: unknown) => unknown) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen({} as Event);
    }, 0);
  }

  emitMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({
        data: typeof data === 'string' ? data : JSON.stringify(data),
      } as MessageEvent);
    }
  }

  emitError() {
    this.readyState = 2;
    if (this.onerror) {
      this.onerror({} as Event);
    }
  }

  close() {
    this.readyState = 2;
  }
}

// ── Mock Data Fixtures ─────────────────────────────────────────────────────

const mockApplicantUser: User = {
  id: 'user-app-001',
  email: 'applicant.juan@megs.ph',
  role: Role.APPLICANT,
  accountStatus: 'ACTIVE',
  createdAt: '2026-01-10T00:00:00Z',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
};

const mockTaUser: User = {
  id: 'user-ta-001',
  email: 'recruiter.jane@megs.ph',
  role: Role.TALENT_ACQUISITION,
  accountStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  firstName: 'Jane',
  lastName: 'Recruiter',
};

const mockAdminUser: User = {
  id: 'user-admin-001',
  email: 'admin.super@megs.ph',
  role: Role.ADMINISTRATOR,
  accountStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  firstName: 'Super',
  lastName: 'Admin',
};

const mockApplicantProfile: ApplicantProfile = {
  id: 1,
  userId: 'user-app-001',
  firstName: 'Juan',
  middleName: 'Protacio',
  lastName: 'Dela Cruz',
  mobileNumber: '09171234567',
  gender: 'Male',
  province: 'Metro Manila',
  city: 'Taguig City',
  dateOfBirth: '1996-06-12',
  birthPlace: 'Manila',
  nationality: 'Filipino',
  civilStatus: 'Single',
  height: 175,
  weight: 70,
  religion: 'Christian',
  address: 'Unit 402, High Street Residences, BGC',
  preferredWorkLocations: 'Taguig, Makati, Pasig',
  pagibig: '1234-5678-9012',
  philhealth: '12-345678901-2',
  sss: '01-2345678-9',
  tin: '123-456-789-000',
  photoUrl: 'https://example.com/photo.jpg',
  resumeUrl: 'https://example.com/resume-juan.pdf',
  professionalSummary: 'Supply Chain & Logistics Specialist with 4+ years warehousing experience.',
  emergencyContactName: 'Maria Dela Cruz',
  emergencyContactRelationship: 'Mother',
  emergencyContactPhone: '09189876543',
  emergencyContactAddress: 'Unit 402, High Street Residences',
  additionalNotes: 'Ready for immediate deployment',
  isActive: true,
  hasConsentedToAi: true,
  createdAt: '2026-01-10T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  workExperiences: [
    {
      id: 101,
      applicantProfileId: 1,
      company: 'Megaworld Logistics Hub',
      roleTitle: 'Warehouse Shift Lead',
      location: 'Taguig City',
      startDate: '2023-01-01',
      endDate: null,
      isCurrent: true,
      summary: 'Directed inbound inventory sorting, dispatch, and safety auditing.',
    },
  ],
  educations: [
    {
      id: 201,
      applicantProfileId: 1,
      school: 'Polytechnic University of the Philippines',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Operations Management',
      startDate: '2015-06-01',
      endDate: '2019-04-01',
      notes: 'Graduated Cum Laude',
    },
  ],
  skills: ['Inventory Management', 'Forklift Safety', 'Supply Chain Coordination', 'WMS'],
  trainings: [
    {
      id: 301,
      applicantProfileId: 1,
      title: 'BOSH Certification',
      provider: 'DOLE-OSHC',
      completionDate: '2024-03-01',
      certificateNo: 'BOSH-2024-0012',
      notes: '40-Hour Mandatory Safety Training',
    },
  ],
  characterReferences: [
    {
      id: 401,
      applicantProfileId: 1,
      name: 'Engr. Ramon Mercado',
      relationship: 'Warehouse Director',
      phone: '09171112233',
      email: 'ramon.mercado@megaworld.com',
      notes: 'Direct supervisor',
    },
  ],
};

const mockClients: any[] = [
  {
    id: 1,
    name: 'Megaworld Logistics Global',
    industry: 'Supply Chain & Warehousing',
    contactName: 'Director Sarah Santos',
    contactEmail: 'sarah.santos@megaworld.ph',
    contactPhone: '02-8888-1234',
    address: 'BGC Corporate Center, Taguig City',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    _count: { manpowerRequests: 3, deployments: 12 },
  },
];

const mockMRF: ManpowerRequest = {
  id: 1,
  clientId: 1,
  title: 'Warehouse Logistics Operators',
  headcount: 10,
  location: 'Taguig City',
  priority: 'HIGH',
  status: 'OPEN',
  targetFillDate: '2026-03-31T00:00:00Z',
  requiredSkills: 'Inventory Management, Forklift Operation',
  description: 'Urgent hiring for high-volume shift operators.',
  createdById: 'user-ta-001',
  client: mockClients[0],
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  _count: { deployments: 7 },
};

const mockJob: JobPosting = {
  id: 1,
  postedById: 'user-ta-001',
  title: 'Senior Logistics Coordinator',
  description: 'Manage warehouse inventory sorting, carrier dispatches, and daily shift coordination.',
  requirements: 'At least 3 years in warehousing, logistics operations, and WMS software.',
  location: 'Taguig City',
  status: JobStatus.OPEN,
  mrfId: 1,
  mrf: mockMRF,
  createdAt: '2026-01-20T00:00:00Z',
  updatedAt: '2026-01-20T00:00:00Z',
  _count: { applications: 5 },
};

const mockApplicantApplications = [
  {
    id: 101,
    userId: 'user-app-001',
    jobPostingId: 1,
    status: ApplicationStatus.SUBMITTED,
    resumeUrl: 'https://example.com/resume-juan.pdf',
    coverLetter: 'Excited to contribute to warehouse operations.',
    isArchived: false,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-01T10:00:00Z',
    jobPosting: mockJob,
    user: {
      id: 'user-app-001',
      email: 'applicant.juan@megs.ph',
      applicantProfile: mockApplicantProfile,
    },
  },
];

const mockApplicationListItem: any = {
  id: 101,
  jobPostingId: 1,
  status: ApplicationStatus.INITIAL_SCREENING,
  aiScore: 92,
  isArchived: false,
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
  user: {
    id: 'user-app-001',
    email: 'applicant.juan@megs.ph',
    applicantProfile: mockApplicantProfile,
  },
  jobPosting: {
    id: 1,
    title: 'Senior Logistics Coordinator',
    location: 'Taguig City',
  },
};

const mockApplicationDetail: any = {
  id: 101,
  userId: 'user-app-001',
  jobPostingId: 1,
  status: ApplicationStatus.INITIAL_SCREENING,
  resumeUrl: 'https://example.com/resume-juan.pdf',
  coverLetter: 'Excited to contribute to warehouse operations.',
  isArchived: false,
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
  jobPosting: mockJob,
  user: {
    id: 'user-app-001',
    email: 'applicant.juan@megs.ph',
    role: Role.APPLICANT,
    accountStatus: 'ACTIVE',
    applicantProfile: mockApplicantProfile,
  },
  aiResumeAnalysis: {
    id: 201,
    applicationId: 101,
    fitScore: 92,
    strengths: ['Direct experience leading warehouse operations & logistics dispatch', 'DOLE BOSH certified'],
    gaps: ['WMS cross-docking experience could be expanded'],
    skillsAnalysis: { matched: ['Inventory Management', 'Forklift Safety', 'WMS'], missing: [] },
    experienceAnalysis: { yearsRelevant: 4, relevanceScore: 95 },
    educationAnalysis: { degreeMatch: true, score: 90 },
    recommendations: 'Strong candidate for immediate endorsement.',
    rawAnalysis: '{}',
    createdAt: '2026-02-01T12:00:00Z',
    updatedAt: '2026-02-01T12:00:00Z',
  },
  interviews: [
    {
      id: 301,
      applicationId: 101,
      type: InterviewType.INITIAL_SCREENING,
      scheduledAt: '2026-02-05T14:00:00Z',
      conductedAt: null,
      result: InterviewResult.PENDING,
      notes: 'Initial technical and shift availability screening',
      createdAt: '2026-02-02T08:00:00Z',
      updatedAt: '2026-02-02T08:00:00Z',
      isActive: true,
    },
  ],
  endorsements: [
    {
      id: 401,
      applicationId: 101,
      clientId: 1,
      endorsedBy: 'user-ta-001',
      status: 'PENDING',
      feedback: 'Endorsed with 92% AI fit index',
      createdAt: '2026-02-02T10:00:00Z',
      updatedAt: '2026-02-02T10:00:00Z',
    },
  ],
  complianceRequirements: [
    {
      id: 501,
      applicationId: 101,
      documentLabel: 'NBI Clearance',
      isRequired: true,
      reviewStatus: ComplianceReviewStatus.PENDING,
      createdAt: '2026-02-02T10:00:00Z',
      updatedAt: '2026-02-02T10:00:00Z',
    },
  ],
  statusHistory: [
    {
      id: 601,
      applicationId: 101,
      fromStatus: null,
      toStatus: ApplicationStatus.SUBMITTED,
      changedById: 'user-app-001',
      reason: 'Application submitted',
      createdAt: '2026-02-01T10:00:00Z',
    },
  ],
};

const mockEmployee: Employee = {
  id: 1,
  userId: 'user-app-001',
  employeeNumber: 'EMP-2026-0001',
  status: EmploymentStatus.ACTIVE,
  hireDate: '2026-02-10T00:00:00Z',
  department: 'Warehouse Operations',
  position: 'Senior Operations Shift Lead',
  notes: 'High performer with zero SLA breaches',
  createdAt: '2026-02-10T00:00:00Z',
  updatedAt: '2026-02-10T00:00:00Z',
  user: {
    id: 'user-app-001',
    email: 'applicant.juan@megs.ph',
    role: Role.APPLICANT,
    accountStatus: 'ACTIVE',
    applicantProfile: mockApplicantProfile,
  },
};

const mockEmploymentEvents: EmploymentEvent[] = [
  {
    id: 1101,
    employeeId: 1,
    eventType: EmploymentEventType.HIRED,
    description: 'Initial employment record established following compliance sign-off.',
    effectiveDate: '2026-02-10T00:00:00Z',
    actorId: 'user-ta-001',
    createdAt: '2026-02-10T00:00:00Z',
  },
];

const mockDigital201: Digital201File = {
  employee: mockEmployee,
  applicantProfile: mockApplicantProfile,
  deployments: [
    {
      id: 701,
      employeeId: 1,
      employee: mockEmployee,
      clientId: 1,
      client: mockClients[0],
      site: 'Taguig Main Fulfillment Center',
      contractStart: '2026-02-15',
      contractEnd: '2027-02-15',
      status: DeploymentStatus.ACTIVE,
      createdById: 'user-ta-001',
      createdAt: '2026-02-10T00:00:00Z',
      updatedAt: '2026-02-10T00:00:00Z',
    },
  ],
  complianceRequirements: [
    {
      id: 801,
      applicationId: 101,
      documentLabel: 'NBI Clearance',
      isRequired: true,
      reviewStatus: ComplianceReviewStatus.APPROVED,
      createdAt: '2026-02-02T10:00:00Z',
      updatedAt: '2026-02-02T10:00:00Z',
    },
  ],
  employmentEvents: mockEmploymentEvents,
  storedDocuments: [],
};

const mockActiveConfig: CandidateScoringConfiguration = {
  id: 1,
  version: 1,
  revision: 0,
  scope: CandidateScoringConfigurationScope.GLOBAL,
  status: CandidateScoringConfigurationStatus.ACTIVE,
  activatedAt: '2026-08-01T00:00:00Z',
  activatedById: 'admin.super@megs.ph',
  createdAt: '2026-08-01T00:00:00Z',
  knnSettings: {
    defaultK: 5,
    maximumK: 20,
    minimumSimilarity: 0.70,
  },
  weights: [
    { id: 1, configurationId: 1, dimension: CandidateScoringDimension.SKILLS, weight: 40 },
    { id: 2, configurationId: 1, dimension: CandidateScoringDimension.EXPERIENCE, weight: 25 },
    { id: 3, configurationId: 1, dimension: CandidateScoringDimension.LOCATION, weight: 15 },
    { id: 4, configurationId: 1, dimension: CandidateScoringDimension.COMPLIANCE, weight: 10 },
    { id: 5, configurationId: 1, dimension: CandidateScoringDimension.EDUCATION_CERTIFICATIONS, weight: 10 },
  ],
};

const mockQualityMetrics: ScoringQualityMetrics = {
  totalScoresCalculated: 1420,
  staleScoresCount: 4,
  failedScoresCount: 0,
  averageFitScore: 84.2,
  scoreDistribution: {
    '90-100%': 340,
    '80-89%': 520,
    '70-79%': 380,
    '<70%': 180,
  },
};

const mockRevalidationStatus: RevalidationStatus = {
  totalTasks: 120,
  pendingTasks: 15,
  processingTasks: 5,
  completedTasks: 100,
  failedTasks: 0,
};

const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    userId: 'user-admin-001',
    user: { id: 'user-admin-001', email: 'admin.super@megs.ph', role: Role.ADMINISTRATOR },
    action: 'INVITED_TA',
    entity: 'User',
    entityId: 2,
    details: 'Invited new TA recruiter recruiter.jane@megs.ph',
    createdAt: '2026-08-14T08:30:00Z',
  },
];

const mockNotifications: Notification[] = [
  {
    id: 9001,
    userId: 'user-app-001',
    title: 'Application Advanced',
    message: 'Your application for Senior Logistics Coordinator was moved to Initial Screening.',
    type: 'SUCCESS',
    isRead: false,
    link: '/app/applications/101',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

// ── Test Helper: Render with Providers ─────────────────────────────────────
function renderWithTestProviders(
  ui: React.ReactElement,
  {
    initialEntries = ['/'],
    user = mockApplicantUser,
    role = Role.APPLICANT,
    isAuthenticated = true,
  }: {
    initialEntries?: string[];
    user?: User | null;
    role?: Role | null;
    isAuthenticated?: boolean;
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const authSession: AuthSession | null = isAuthenticated && user
    ? {
        access_token: 'mock-jwt-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        user,
      }
    : null;

  const authValue: AuthContextType = {
    user,
    role,
    session: authSession,
    isAuthenticated,
    isLoading: false,
    mustChangePassword: false,
    login: vi.fn().mockImplementation(async () => {
      return {
        access_token: 'mock-jwt-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        user: mockApplicantUser,
      };
    }),
    register: vi.fn().mockResolvedValue({ id: 'user-app-001', email: 'applicant.juan@megs.ph', role: 'APPLICANT' }),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshProfile: vi.fn().mockResolvedValue(user),
    setSession: vi.fn(),
  };

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={initialEntries}>
          {ui}
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );

  return { ...renderResult, queryClient, authValue };
}

// ── Test Suite ─────────────────────────────────────────────────────────────
describe('MEGS Phase 10 & 11: End-to-End User Journey Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    MockEventSource.instances = [];

    // Mock global EventSource
    (globalThis as any).EventSource = MockEventSource;

    // Auth API
    vi.spyOn(authApi, 'register').mockResolvedValue({
      success: true,
      message: 'Registration successful',
      data: { id: 'user-app-001', email: 'applicant.juan@megs.ph', role: 'APPLICANT' },
    });
    vi.spyOn(authApi, 'login').mockResolvedValue({
      access_token: 'mock-jwt-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      user: mockApplicantUser,
    } as any);

    // Applicant API
    vi.spyOn(applicantApi, 'getProfile').mockResolvedValue({
      success: true,
      message: 'Profile retrieved',
      data: mockApplicantProfile,
    });
    vi.spyOn(applicantApi, 'upsertProfile').mockResolvedValue({
      success: true,
      message: 'Profile saved successfully',
      data: mockApplicantProfile,
    });
    vi.spyOn(applicantApi, 'setAiConsent').mockResolvedValue({
      success: true,
      message: 'AI consent updated',
      data: { hasConsentedToAi: false },
    });
    vi.spyOn(applicantApi, 'updateSkills').mockResolvedValue({
      success: true,
      message: 'Skills updated',
      data: [...(mockApplicantProfile.skills || []).map((s: any) => typeof s === 'string' ? s : s.skill?.name || ''), 'Cross-Docking Logistics'],
    });
    vi.spyOn(applicantApi, 'getOpenJobs').mockResolvedValue({
      success: true,
      message: 'Jobs retrieved',
      data: [mockJob],
    });
    vi.spyOn(applicantApi, 'getJobDetails').mockResolvedValue({
      success: true,
      message: 'Job retrieved',
      data: mockJob,
    });
    vi.spyOn(applicantApi, 'applyToJob').mockResolvedValue({
      success: true,
      message: 'Application submitted successfully',
      data: mockApplicantApplications[0] as any,
    });
    vi.spyOn(applicantApi, 'getMyApplications').mockResolvedValue({
      success: true,
      message: 'Applications retrieved',
      data: mockApplicantApplications as any,
    });

    // TA API
    vi.spyOn(taApi, 'getPipelineStats').mockResolvedValue({
      success: true,
      message: 'Pipeline stats retrieved',
      data: {
        totalActive: 45,
        byStatus: {
          [ApplicationStatus.SUBMITTED]: 10,
          [ApplicationStatus.INITIAL_SCREENING]: 8,
          [ApplicationStatus.FINAL_INTERVIEW]: 4,
          [ApplicationStatus.COMPLIANCE]: 3,
        },
      } as any,
    });
    vi.spyOn(taApi, 'listApplications').mockResolvedValue({
      success: true,
      message: 'Applications list retrieved',
      data: [mockApplicationListItem],
    });
    vi.spyOn(taApi, 'getApplication').mockResolvedValue({
      success: true,
      message: 'Application detail retrieved',
      data: mockApplicationDetail,
    });
    vi.spyOn(taApi, 'checkInterviewCompliance').mockResolvedValue({
      success: true,
      message: 'Compliance checked',
      data: { pendingSla: 1, breachedCount: 0, complianceRate: 95 } as any,
    });
    vi.spyOn(taApi, 'getComplianceOverview').mockResolvedValue({
      success: true,
      message: 'Overview retrieved',
      data: { totalRequired: 10, pendingReviewCount: 2, approvedCount: 8, isFullyCompliant: false } as any,
    });
    vi.spyOn(taApi, 'listMRFs').mockResolvedValue({
      success: true,
      message: 'MRFs retrieved',
      data: [mockMRF],
    });
    vi.spyOn(taApi, 'createMRF').mockResolvedValue({
      success: true,
      message: 'MRF created',
      data: mockMRF,
    });
    vi.spyOn(taApi, 'listJobs').mockResolvedValue({
      success: true,
      message: 'Jobs retrieved',
      data: [mockJob],
    });
    vi.spyOn(taApi, 'getJob').mockResolvedValue({
      success: true,
      message: 'Job detail retrieved',
      data: mockJob,
    });
    vi.spyOn(taApi, 'createJob').mockResolvedValue({
      success: true,
      message: 'Job created',
      data: mockJob,
    });
    vi.spyOn(taApi, 'getRankedCandidates').mockResolvedValue({
      success: true,
      message: 'Ranked candidates retrieved',
      data: [mockApplicationListItem],
    });
    vi.spyOn(taApi, 'rankCandidates').mockResolvedValue({
      success: true,
      message: 'Candidate matches re-ranked',
      data: { reevaluatedCount: 1 },
    });
    vi.spyOn(taApi, 'analyzeApplication').mockResolvedValue({
      success: true,
      message: 'Analysis completed',
      data: mockApplicationDetail.aiResumeAnalysis!,
    });
    vi.spyOn(taApi, 'updateInterviewStatus').mockResolvedValue({
      success: true,
      message: 'Interview status recorded',
      data: { ...mockApplicationDetail.interviews[0], result: InterviewResult.PASS } as any,
    });
    vi.spyOn(taApi, 'reviewRequirement').mockResolvedValue({
      success: true,
      message: 'Document reviewed',
      data: { ...mockApplicationDetail.complianceRequirements[0], reviewStatus: ComplianceReviewStatus.APPROVED } as any,
    });
    vi.spyOn(taApi, 'listClients').mockResolvedValue({
      success: true,
      message: 'Clients retrieved',
      data: mockClients,
    });

    // Employee API
    vi.spyOn(employeeApi, 'getDigital201').mockResolvedValue({
      success: true,
      message: 'Digital 201 retrieved',
      data: mockDigital201,
    });
    vi.spyOn(employeeApi, 'getEmploymentHistory').mockResolvedValue({
      success: true,
      message: 'History retrieved',
      data: mockEmploymentEvents,
    });
    vi.spyOn(employeeApi, 'addEmploymentEvent').mockResolvedValue({
      success: true,
      message: 'Event logged',
      data: {
        id: 1102,
        employeeId: 1,
        eventType: EmploymentEventType.STATUS_CHANGE,
        description: 'Promoted to Senior Operations Shift Lead',
        effectiveDate: '2026-04-01T00:00:00Z',
        createdAt: '2026-03-15T00:00:00Z',
      },
    });

    // Admin API
    vi.spyOn(adminApi, 'listUsers').mockResolvedValue({
      success: true,
      message: 'Users retrieved',
      data: [mockAdminUser, mockTaUser, mockApplicantUser],
    });
    vi.spyOn(adminApi, 'inviteUser').mockResolvedValue({
      success: true,
      message: 'Invitation sent successfully to TA staff',
      data: { user: mockTaUser, invitationLink: 'https://megs.ph/setup?token=xyz' },
    });
    vi.spyOn(adminApi, 'toggleUserStatus').mockResolvedValue({
      success: true,
      message: 'User status updated',
      data: { ...mockTaUser, accountStatus: 'DEACTIVATED' },
    });
    vi.spyOn(adminApi, 'getActiveScoringConfiguration').mockResolvedValue({
      success: true,
      message: 'Scoring config retrieved',
      data: mockActiveConfig,
    });
    vi.spyOn(adminApi, 'listScoringConfigurations').mockResolvedValue({
      success: true,
      message: 'History retrieved',
      data: [mockActiveConfig],
    });
    vi.spyOn(adminApi, 'createScoringConfiguration').mockResolvedValue({
      success: true,
      message: 'Configuration updated',
      data: { ...mockActiveConfig, revision: 2 },
    });
    vi.spyOn(adminApi, 'triggerRevalidation').mockResolvedValue({
      success: true,
      message: 'Candidate score revalidation queued across all active applications.',
      data: { message: 'Revalidation queued', queued: 450 },
    });
    vi.spyOn(adminApi, 'getRevalidationStatus').mockResolvedValue({
      success: true,
      message: 'Revalidation status retrieved',
      data: mockRevalidationStatus,
    });
    vi.spyOn(adminApi, 'getScoringQualityMetrics').mockResolvedValue({
      success: true,
      message: 'Quality metrics retrieved',
      data: mockQualityMetrics,
    });
    vi.spyOn(adminApi, 'listAuditLogs').mockResolvedValue({
      success: true,
      message: 'Audit logs retrieved',
      data: mockAuditLogs,
    });

    // Notification API
    vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({
      success: true,
      message: 'Unread count retrieved',
      data: { count: 2, unreadCount: 2 },
    });
    vi.spyOn(notificationApi, 'listNotifications').mockResolvedValue({
      success: true,
      message: 'Notifications retrieved',
      data: mockNotifications,
    });
    vi.spyOn(notificationApi, 'markAllAsRead').mockResolvedValue({
      success: true,
      message: 'All notifications marked as read',
      data: { count: 2 },
    });
    vi.spyOn(notificationApi, 'markAsRead').mockResolvedValue({
      success: true,
      message: 'Marked as read',
      data: { ...mockNotifications[0], isRead: true },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 1: APPLICANT END-TO-END JOURNEY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 1: Applicant End-to-End Journey', () => {
    it('1.1: Applicant registers a new account and logs in with credentials', async () => {
      const { container, unmount } = renderWithTestProviders(
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>,
        { initialEntries: ['/register'], isAuthenticated: false, user: null, role: null }
      );

      expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
      fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'applicant.juan@megs.ph' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'P@ssword1234' } });

      const confirmPwInput = container.querySelector('#confirmPassword') as HTMLInputElement;
      fireEvent.change(confirmPwInput, { target: { value: 'P@ssword1234' } });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith({
          email: 'applicant.juan@megs.ph',
          password: 'P@ssword1234',
        });
      });

      unmount();

      // Login step
      const { container: loginContainer } = renderWithTestProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>,
        { initialEntries: ['/login'], isAuthenticated: false, user: null, role: null }
      );

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'applicant.juan@megs.ph' } });
      const passwordInput = loginContainer.querySelector('#password') as HTMLInputElement;
      fireEvent.change(passwordInput, { target: { value: 'P@ssword1234' } });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('1.2: Applicant completes profile with Government IDs, AI consent, and skills', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/app/profile" element={<ApplicantProfilePage />} />
        </Routes>,
        { initialEntries: ['/app/profile'], role: Role.APPLICANT, user: mockApplicantUser }
      );

      await waitFor(() => {
        expect(screen.getByText('My Profile & Credentials')).toBeInTheDocument();
      });

      // Personal Details
      expect(screen.getByText('Personal Details')).toBeInTheDocument();
      const sssInput = screen.getByLabelText(/sss number/i);
      expect(sssInput).toHaveValue('01-2345678-9');

      // Save personal details
      const saveBtn = screen.getByRole('button', { name: /save profile/i });
      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(applicantApi.upsertProfile).toHaveBeenCalled();
      });

      // Switch to Resume & AI Consent tab
      const resumeTab = screen.getByTestId('tab-resume');
      fireEvent.click(resumeTab);

      await waitFor(() => {
        expect(screen.getByTestId('ai-consent-toggle')).toBeInTheDocument();
      });

      // Toggle AI consent
      fireEvent.click(screen.getByTestId('ai-consent-toggle'));
      await waitFor(() => {
        expect(applicantApi.setAiConsent).toHaveBeenCalledWith(false);
      });

      // Switch to Skills tab
      const skillsTab = screen.getByTestId('tab-skills');
      fireEvent.click(skillsTab);

      await waitFor(() => {
        expect(screen.getAllByText('Inventory Management').length).toBeGreaterThan(0);
      });

      // Add new skill
      const skillInput = screen.getByTestId('skill-input');
      fireEvent.change(skillInput, { target: { value: 'Cross-Docking Logistics' } });
      fireEvent.click(screen.getByTestId('add-skill-btn'));

      await waitFor(() => {
        expect(applicantApi.updateSkills).toHaveBeenCalled();
      });
    });

    it('1.3: Applicant browses job postings on /app/jobs, filters by search, and applies', async () => {
      // Mock getMyApplications returning empty array so job is not already applied
      vi.spyOn(applicantApi, 'getMyApplications').mockResolvedValue({
        success: true,
        message: 'Applications retrieved',
        data: [],
      });

      renderWithTestProviders(
        <Routes>
          <Route path="/app/jobs" element={<ApplicantJobsPage />} />
          <Route path="/app/jobs/:id" element={<ApplicantJobDetailPage />} />
        </Routes>,
        { initialEntries: ['/app/jobs'], role: Role.APPLICANT, user: mockApplicantUser }
      );

      await waitFor(() => {
        expect(screen.getByText('Explore Open Positions')).toBeInTheDocument();
        expect(screen.getByText('Senior Logistics Coordinator')).toBeInTheDocument();
      });

      // Search filter
      const searchInput = screen.getByTestId('job-search-input');
      fireEvent.change(searchInput, { target: { value: 'Logistics' } });
      expect(screen.getByText('Senior Logistics Coordinator')).toBeInTheDocument();

      // Navigate to job detail via View Details link
      const viewJobLink = screen.getByTestId('view-job-btn-1');
      fireEvent.click(viewJobLink);

      await waitFor(() => {
        expect(screen.getAllByText('Senior Logistics Coordinator').length).toBeGreaterThan(0);
      });

      // Click Apply Now button
      const applyBtn = screen.getByRole('button', { name: /apply now/i });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole('button', { name: /submit application/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(applicantApi.applyToJob).toHaveBeenCalledWith(1, undefined);
      });
    });

    it('1.4: Applicant navigates to /app/applications and verifies 15-stage PipelineIndicator', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/app/applications" element={<ApplicantApplicationsPage />} />
          <Route path="/app/applications/:id" element={<ApplicantApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/app/applications/101'], role: Role.APPLICANT, user: mockApplicantUser }
      );

      await waitFor(() => {
        expect(screen.getByText('Senior Logistics Coordinator')).toBeInTheDocument();
      });

      // Verify Pipeline Indicator is rendered
      expect(screen.getByTestId('pipeline-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('pipeline-step-submitted')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 2: TALENT ACQUISITION (TA) RECRUITER FULL LIFECYCLE JOURNEY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 2: Talent Acquisition (TA) Recruiter Full Lifecycle Journey', () => {
    it('2.1: TA views TADashboardPage with pipeline summary and action alerts', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/ta/dashboard" element={<TADashboardPage />} />
        </Routes>,
        { initialEntries: ['/ta/dashboard'], role: Role.TALENT_ACQUISITION, user: mockTaUser }
      );

      await waitFor(() => {
        expect(screen.getByText('Talent Acquisition Command Center')).toBeInTheDocument();
      });

      expect(screen.getByTestId('pipeline-summary-bar')).toBeInTheDocument();
      expect(screen.getByTestId('action-required-section')).toBeInTheDocument();
    });

    it('2.2: TA creates an MRF on /ta/mrfs and links a Job Posting on /ta/jobs', async () => {
      const { unmount } = renderWithTestProviders(
        <Routes>
          <Route path="/ta/mrfs" element={<TAMRFsPage />} />
        </Routes>,
        { initialEntries: ['/ta/mrfs'], role: Role.TALENT_ACQUISITION, user: mockTaUser }
      );

      await waitFor(() => {
        expect(screen.getByTestId('create-mrf-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-mrf-btn'));

      await waitFor(() => {
        expect(screen.getByText('Create Manpower Request (MRF)')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('mrf-client-select'), { target: { value: '1' } });
      fireEvent.change(screen.getByTestId('mrf-title-input'), { target: { value: 'Warehouse Logistics Operators' } });
      fireEvent.change(screen.getByTestId('mrf-location-input'), { target: { value: 'Taguig City' } });

      fireEvent.click(screen.getByTestId('submit-create-mrf-btn'));

      await waitFor(() => {
        expect(taApi.createMRF).toHaveBeenCalled();
      });

      unmount();

      renderWithTestProviders(
        <Routes>
          <Route path="/ta/jobs" element={<TAJobsPage />} />
        </Routes>,
        { initialEntries: ['/ta/jobs'], role: Role.TALENT_ACQUISITION, user: mockTaUser }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create job posting/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /create job posting/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Job Posting')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('job-title-input'), { target: { value: 'Senior Logistics Coordinator' } });
      fireEvent.change(screen.getByTestId('job-location-input'), { target: { value: 'Taguig City' } });
      fireEvent.change(screen.getByTestId('job-description-input'), { target: { value: 'Full warehousing operations' } });
      fireEvent.change(screen.getByTestId('job-requirements-input'), { target: { value: '3+ years experience' } });

      fireEvent.click(screen.getByTestId('submit-create-job-btn'));

      await waitFor(() => {
        expect(taApi.createJob).toHaveBeenCalled();
      });
    });

    it('2.3: TA views Job Detail (/ta/jobs/:id) and triggers AI Candidate Re-ranking', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/ta/jobs/:id" element={<TAJobDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/jobs/1'], role: Role.TALENT_ACQUISITION, user: mockTaUser }
      );

      await waitFor(() => {
        expect(screen.getAllByText('Senior Logistics Coordinator').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
      });

      const reRankBtn = screen.getByTestId('rerank-candidates-btn');
      fireEvent.click(reRankBtn);

      await waitFor(() => {
        expect(taApi.rankCandidates).toHaveBeenCalledWith(1);
      });
    });

    it('2.4: Candidate Workspace (/ta/applications/:id) overview and AI analysis', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'], role: Role.TALENT_ACQUISITION, user: mockTaUser }
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Juan Dela Cruz/i).length).toBeGreaterThan(0);
      });

      expect(screen.getByTestId('detail-tab-overview')).toBeInTheDocument();

      // Re-run AI analysis
      const rerunBtn = screen.getByRole('button', { name: /re-run ai analysis/i });
      fireEvent.click(rerunBtn);

      await waitFor(() => {
        expect(taApi.analyzeApplication).toHaveBeenCalledWith(101);
      });
    });

    it('2.5: Employee Digital 201 File (/ta/employees/:id) dossier review and employment event logging', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/ta/employees/:id" element={<TAEmployeeDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/employees/1'], role: Role.TALENT_ACQUISITION, user: mockTaUser }
      );

      await waitFor(() => {
        expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/EMP-2026-0001/i).length).toBeGreaterThan(0);
      });

      // Switch to timeline tab
      const timelineTab = screen.getByTestId('tab-201-timeline');
      fireEvent.click(timelineTab);

      // Open Add Event modal
      await waitFor(() => {
        expect(screen.getByTestId('add-event-btn')).toBeInTheDocument();
      });

      const addEventBtn = screen.getByTestId('add-event-btn');
      fireEvent.click(addEventBtn);

      await waitFor(() => {
        expect(screen.getByText('Record Employment Event')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('event-description-input'), {
        target: { value: 'Promoted to Senior Operations Shift Lead' },
      });

      fireEvent.click(screen.getByTestId('submit-event-btn'));

      await waitFor(() => {
        expect(employeeApi.addEmploymentEvent).toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 3: ADMINISTRATOR CONFIGURATION & GOVERNANCE JOURNEY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 3: Administrator Configuration & Governance Journey', () => {
    it('3.1: Admin views AdminDashboardPage with system health status and total accounts', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Routes>,
        { initialEntries: ['/admin/dashboard'], role: Role.ADMINISTRATOR, user: mockAdminUser }
      );

      await waitFor(() => {
        expect(screen.getByText('System Administration Console')).toBeInTheDocument();
      });

      expect(screen.getByTestId('admin-metric-cards')).toBeInTheDocument();
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('TA Recruiter Staff')).toBeInTheDocument();
    });

    it('3.2: Admin invites new TA staff and toggles user status on AdminUsersPage', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Routes>,
        { initialEntries: ['/admin/users'], role: Role.ADMINISTRATOR, user: mockAdminUser }
      );

      await waitFor(() => {
        expect(screen.getByText('User & Access Control Management')).toBeInTheDocument();
      });

      // Open Invite TA Staff modal
      const inviteBtn = screen.getByTestId('invite-ta-button');
      fireEvent.click(inviteBtn);

      await waitFor(() => {
        expect(screen.getByText('Invite TA Staff')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new.recruiter@megs.ph' } });
      fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alex' } });
      fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });

      fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

      await waitFor(() => {
        expect(adminApi.inviteUser).toHaveBeenCalled();
      });
    });

    it('3.3: Admin configures scoring weights, validates 100% sum, and triggers revalidation', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/admin/scoring" element={<AdminScoringPage />} />
        </Routes>,
        { initialEntries: ['/admin/scoring'], role: Role.ADMINISTRATOR, user: mockAdminUser }
      );

      await waitFor(() => {
        expect(screen.getByText('Candidate Scoring Configuration')).toBeInTheDocument();
      });

      // Trigger Batch Revalidation
      const revalBtn = screen.getByTestId('trigger-revalidation-button');
      fireEvent.click(revalBtn);

      await waitFor(() => {
        expect(adminApi.triggerRevalidation).toHaveBeenCalled();
      });
    });

    it('3.4: Admin searches audit events and inspects JSON payload on AdminAuditLogsPage', async () => {
      renderWithTestProviders(
        <Routes>
          <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Routes>,
        { initialEntries: ['/admin/audit-logs'], role: Role.ADMINISTRATOR, user: mockAdminUser }
      );

      await waitFor(() => {
        expect(screen.getByText('Immutable Audit Trail')).toBeInTheDocument();
      });

      // View Payload
      const viewPayloadBtns = screen.getAllByTestId('audit-view-details-btn');
      fireEvent.click(viewPayloadBtns[0]);

      await waitFor(() => {
        expect(screen.getByTestId('audit-details-modal')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 4: CROSS-CUTTING REAL-TIME NOTIFICATIONS & ACCESS CONTROL
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 4: Cross-Cutting Real-Time Notifications & Access Control', () => {
    it('4.1: Simulates incoming SSE notification event, updates unread counter badge, and marks as read', async () => {
      renderWithTestProviders(
        <div className="p-4">
          <NotificationBell />
        </div>,
        { role: Role.APPLICANT, user: mockApplicantUser }
      );

      // Verify unread count badge
      await waitFor(() => {
        expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
      });

      // Simulate incoming SSE event
      act(() => {
        if (MockEventSource.instances.length > 0) {
          MockEventSource.instances[0].emitMessage({
            id: 9003,
            userId: 'user-app-001',
            title: 'Interview Scheduled',
            message: 'Your screening interview is scheduled.',
            type: 'INFO',
            isRead: false,
            link: '/app/applications/101',
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Open popover
      const bellBtn = screen.getByTestId('notification-bell-btn');
      fireEvent.click(bellBtn);

      await waitFor(() => {
        expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
      });

      // Mark all notifications as read
      const markAllBtn = screen.getByTestId('mark-all-read-btn');
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(notificationApi.markAllAsRead).toHaveBeenCalled();
      });
    });

    it('4.2: Enforces role-based access control and redirects unauthorized roles to /forbidden', async () => {
      // APPLICANT attempting to access Admin route -> redirects to /forbidden
      renderWithTestProviders(
        <Routes>
          <Route
            path="/admin/*"
            element={
              <RequireAuth allowedRoles={[Role.ADMINISTRATOR]}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route path="scoring" element={<AdminScoringPage />} />
          </Route>
          <Route path="/forbidden" element={<ForbiddenPage />} />
        </Routes>,
        { initialEntries: ['/admin/scoring'], role: Role.APPLICANT, user: mockApplicantUser }
      );

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      });
    });
  });
});
