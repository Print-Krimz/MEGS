import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TADashboardPage from '../pages/ta/TADashboardPage';
import TAApplicationsPage from '../pages/ta/TAApplicationsPage';
import TAApplicationDetailPage from '../pages/ta/TAApplicationDetailPage';
import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { taApi } from '../lib/api/ta';
import { 
  Role, 
  ApplicationStatus, 
  JobStatus, 
  AssetVerificationState, 
  InterviewType,
  DeploymentStatus 
} from '../lib/types/enums';
import type { 
  ApplicationDetail, 
  ApplicationListItem, 
  PipelineStats, 
  ManpowerRequest,
  Client,
  Interview,
  ComplianceRequirement,
  ClientEndorsement,
  Deployment,
  RecruiterDecision
} from '../lib/types/api';

// ── Mock Data Fixtures ──────────────────────────────────────

const mockPipelineStats: PipelineStats = {
  totalActive: 42,
  totalHired: 6,
  totalArchived: 7,
  byStatus: {
    [ApplicationStatus.SUBMITTED]: 12,
    [ApplicationStatus.PARSING]: 0,
    [ApplicationStatus.REVIEW]: 8,
    [ApplicationStatus.NEEDS_ATTENTION]: 2,
    [ApplicationStatus.MATCHED]: 0,
    [ApplicationStatus.TALENT_POOL]: 10,
    [ApplicationStatus.INITIAL_SCREENING]: 5,
    [ApplicationStatus.CLIENT_ENDORSEMENT]: 4,
    [ApplicationStatus.FINAL_INTERVIEW]: 3,
    [ApplicationStatus.HIRED]: 6,
    [ApplicationStatus.ONBOARDING]: 0,
    [ApplicationStatus.COMPLIANCE]: 4,
    [ApplicationStatus.DEPLOYED]: 15,
    [ApplicationStatus.BACKOUT]: 0,
    [ApplicationStatus.ARCHIVED]: 7,
  },
};

const mockClients: Client[] = [
  {
    id: 1,
    name: 'Megaworld Logistics Global',
    industry: 'Logistics & Supply Chain',
    contactName: 'Mr. Ricardo Dizon',
    contactEmail: 'contact@megaworld-logistics.com',
    contactPhone: '09171112233',
    address: 'BGC, Taguig City',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Prime Retail Solutions',
    industry: 'Retail Operations',
    contactName: 'Ms. Clara Reyes',
    contactEmail: 'hr@primeretail.ph',
    contactPhone: '09182223344',
    address: 'Quezon City',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockMRFs: ManpowerRequest[] = [
  {
    id: 1,
    clientId: 1,
    title: 'Warehouse Logistics Operators',
    headcount: 10,
    status: 'OPEN',
    priority: 'HIGH',
    createdById: 'ta-1',
    client: mockClients[0],
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    _count: { deployments: 7 },
  },
  {
    id: 2,
    clientId: 2,
    title: 'Customer Experience Specialists',
    headcount: 5,
    status: 'FILLED',
    priority: 'NORMAL',
    createdById: 'ta-1',
    client: mockClients[1],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    _count: { deployments: 5 },
  },
];

const mockApplicationsList: ApplicationListItem[] = [
  {
    id: 101,
    status: ApplicationStatus.INITIAL_SCREENING,
    aiScore: 88,
    isArchived: false,
    createdAt: '2026-02-10T10:00:00Z',
    user: {
      id: 'user-001',
      email: 'alex.torres@example.com',
      applicantProfile: {
        firstName: 'Alex',
        lastName: 'Torres',
        mobileNumber: '09171234567',
        city: 'Taguig City',
        province: 'Metro Manila',
        photoUrl: 'https://example.com/alex.jpg',
      },
    },
    jobPosting: {
      id: 1,
      title: 'Senior Logistics Coordinator',
      location: 'Taguig City',
    },
  },
  {
    id: 102,
    status: ApplicationStatus.NEEDS_ATTENTION,
    aiScore: 74,
    isArchived: false,
    createdAt: '2026-02-01T08:00:00Z',
    user: {
      id: 'user-002',
      email: 'bea.valdez@example.com',
      applicantProfile: {
        firstName: 'Bea',
        lastName: 'Valdez',
        mobileNumber: '09181234567',
        city: 'Quezon City',
        province: 'Metro Manila',
        photoUrl: null,
      },
    },
    jobPosting: {
      id: 2,
      title: 'Customer Success Specialist',
      location: 'Quezon City',
    },
  },
  {
    id: 103,
    status: ApplicationStatus.COMPLIANCE,
    aiScore: 92,
    isArchived: false,
    createdAt: '2026-01-20T10:00:00Z',
    user: {
      id: 'user-003',
      email: 'carlos.mendoza@example.com',
      applicantProfile: {
        firstName: 'Carlos',
        lastName: 'Mendoza',
        mobileNumber: '09191234567',
        city: 'Taguig City',
        province: 'Metro Manila',
        photoUrl: null,
      },
    },
    jobPosting: {
      id: 1,
      title: 'Senior Logistics Coordinator',
      location: 'Taguig City',
    },
  },
];

const mockInterviews: Interview[] = [
  {
    id: 201,
    applicationId: 101,
    type: InterviewType.INITIAL_SCREENING,
    scheduledAt: '2026-02-02T09:00:00Z', // > 7 days ago to test SLA warning
    conductedAt: null,
    result: null,
    notes: 'Phone screening regarding supply chain management experience.',
    isActive: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const mockComplianceRequirements: ComplianceRequirement[] = [
  {
    id: 301,
    applicationId: 101,
    documentLabel: 'NBI Clearance',
    isRequired: true,
    reviewStatus: 'APPROVED',
    deadline: '2026-02-28',
    reviewedBy: {
      id: 'ta-1',
      email: 'recruiter@megs.com',
    },
    expiresAt: '2027-01-01',
    reviewNotes: 'Authentic clearance verified with QR code.',
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-12T00:00:00Z',
  },
  {
    id: 302,
    applicationId: 101,
    documentLabel: 'Medical Fit-To-Work Certificate',
    isRequired: true,
    reviewStatus: 'PENDING',
    deadline: '2026-02-25',
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
];

const mockEndorsements: ClientEndorsement[] = [
  {
    id: 401,
    applicationId: 101,
    clientId: 1,
    outcome: 'ENDORSED',
    notes: 'Candidate has 5 years relevant warehouse supervision background.',
    client: mockClients[0],
    endorsedBy: {
      id: 'ta-1',
      email: 'recruiter@megs.com',
    },
    createdAt: '2026-02-11T14:00:00Z',
    updatedAt: '2026-02-11T14:00:00Z',
  },
];

const mockEmployee: any = {
  id: 1,
  userId: 'user-001',
  user: {
    id: 'user-001',
    email: 'alex.torres@example.com',
    role: Role.APPLICANT,
    accountStatus: 'ACTIVE' as const,
  },
  employeeNumber: 'EMP-2026-0001',
  status: 'ACTIVE' as const,
  hireDate: '2026-02-12T00:00:00Z',
  createdAt: '2026-02-12T00:00:00Z',
  updatedAt: '2026-02-12T00:00:00Z',
};

const mockDeployments: Deployment[] = [
  {
    id: 501,
    applicationId: 101,
    employeeId: 1,
    employee: mockEmployee,
    clientId: 1,
    mrfId: 1,
    site: 'Megaworld Logistics Hub BGC',
    contractStart: '2026-03-01',
    contractEnd: '2027-03-01',
    status: DeploymentStatus.PENDING_ORIENTATION,
    client: mockClients[0],
    mrf: mockMRFs[0],
    createdById: 'ta-1',
    createdAt: '2026-02-12T00:00:00Z',
    updatedAt: '2026-02-12T00:00:00Z',
  },
];

const mockDecisions: RecruiterDecision[] = [
  {
    id: 601,
    applicationId: 101,
    actorId: 'ta-1',
    actor: {
      id: 'ta-1',
      email: 'recruiter@megs.com',
      role: Role.TALENT_ACQUISITION,
    },
    fromStatus: ApplicationStatus.SUBMITTED,
    toStatus: ApplicationStatus.INITIAL_SCREENING,
    reason: 'High AI fit score of 88% and qualified logistics background.',
    createdAt: '2026-02-10T11:00:00Z',
  },
];

const mockApplicationDetail: ApplicationDetail = {
  id: 101,
  userId: 'user-001',
  jobPostingId: 1,
  status: ApplicationStatus.INITIAL_SCREENING,
  resumeUrl: 'https://example.com/resume101.pdf',
  aiScore: 88,
  aiSummary: 'Strong candidate with warehouse operations background',
  aiStrengths: [
    'Strong background in inventory and warehouse operations',
    'Certified in Occupational Safety and Health (BOSH)',
  ],
  aiGaps: ['Limited formal experience with SAP ERP warehouse module'],
  isArchived: false,
  createdAt: '2026-02-10T10:00:00Z',
  updatedAt: '2026-02-11T12:00:00Z',
  user: {
    id: 'user-001',
    email: 'alex.torres@example.com',
    applicantProfile: {
      id: 1,
      userId: 'user-001',
      firstName: 'Alex',
      middleName: 'Santos',
      lastName: 'Torres',
      mobileNumber: '09171234567',
      gender: 'Male',
      province: 'Metro Manila',
      city: 'Taguig City',
      dateOfBirth: '1992-08-20',
      birthPlace: 'Taguig City',
      nationality: 'Filipino',
      civilStatus: 'Married',
      address: '456 Fort Legend Tower, BGC, Taguig City',
      preferredWorkLocations: 'Taguig, Makati, Pasig',
      pagibig: '1234-5678-9012',
      philhealth: '12-345678901-2',
      sss: '01-2345678-9',
      tin: '123-456-789-000',
      photoUrl: 'https://example.com/alex.jpg',
      professionalSummary: 'Accomplished logistics supervisor with over 8 years experience leading warehouse fulfillment.',
      isActive: true,
      hasConsentedToAi: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      workExperiences: [
        {
          id: 11,
          applicantProfileId: 1,
          company: 'LBC Express International',
          roleTitle: 'Logistics Shift Lead',
          location: 'Taguig City',
          startDate: '2021-03-01',
          endDate: null,
          isCurrent: true,
          summary: 'Supervised shift dispatching, parcel scanning, and fleet logistics.',
        },
      ],
      educations: [
        {
          id: 21,
          applicantProfileId: 1,
          school: 'Polytechnic University of the Philippines',
          degree: 'Bachelor Degree',
          fieldOfStudy: 'Supply Chain Operations',
          startDate: '2010-06-01',
          endDate: '2014-04-01',
          notes: 'Graduated Cum Laude',
        },
      ],
      skills: ['Warehouse Operations', 'Fleet Dispatch', 'Inventory Control', 'Supply Chain Management'],
      trainings: [
        {
          id: 31,
          applicantProfileId: 1,
          title: 'BOSH Occupational Safety',
          provider: 'DOLE-OSHC',
          completionDate: '2023-05-10',
          certificateNo: 'OSH-2023-5544',
        },
      ],
      characterReferences: [
        {
          id: 41,
          applicantProfileId: 1,
          name: 'Maria Fernandez',
          relationship: 'Senior Operations Director',
          phone: '09178889900',
          email: 'maria.f@example.com',
        },
      ],
      assets: [
        {
          id: 51,
          applicantProfileId: 1,
          label: 'NBI Clearance Certificate',
          documentType: 'NBI_CLEARANCE',
          fileUrl: 'https://example.com/nbi101.pdf',
          verificationState: AssetVerificationState.VERIFIED,
        },
      ],
    },
  },
  jobPosting: {
    id: 1,
    postedById: 'ta-1',
    title: 'Senior Logistics Coordinator',
    description: 'Lead day-to-day warehouse logistics and carrier coordination.',
    requirements: 'At least 3 years experience in warehouse supervision.',
    location: 'Taguig City',
    status: JobStatus.OPEN,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  interviews: mockInterviews,
  complianceRequirements: mockComplianceRequirements,
  clientEndorsements: mockEndorsements,
  postHireDocuments: [
    {
      id: 701,
      applicationId: 101,
      label: 'Signed Employment Contract',
      fileUrl: 'https://example.com/contract101.pdf',
      isActive: true,
      createdAt: '2026-02-12T10:00:00Z',
      updatedAt: '2026-02-12T10:00:00Z',
    },
  ],
} as any;

// ── Test Setup Helper ──────────────────────────────────────

function renderTAView(
  ui: React.ReactElement,
  {
    initialEntries = ['/ta/dashboard'],
  }: {
    initialEntries?: string[];
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const authValue: AuthContextType = {
    user: {
      id: 'ta-1',
      email: 'recruiter@megs.com',
      role: Role.TALENT_ACQUISITION,
      accountStatus: 'ACTIVE',
    },
    role: Role.TALENT_ACQUISITION,
    session: null,
    isAuthenticated: true,
    isLoading: false,
    mustChangePassword: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    setSession: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={initialEntries}>
          {ui}
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

// ── Test Suite ──────────────────────────────────────────────

describe('MEGS Phase 5: TA Interface — Core Operations Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default API Mocks
    vi.spyOn(taApi, 'getPipelineStats').mockResolvedValue({
      success: true,
      message: 'Pipeline statistics retrieved',
      data: mockPipelineStats,
    });

    vi.spyOn(taApi, 'listApplications').mockResolvedValue({
      success: true,
      message: 'Applications list retrieved',
      data: mockApplicationsList,
      pagination: {
        total: mockApplicationsList.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    } as any);

    vi.spyOn(taApi, 'listMRFs').mockResolvedValue({
      success: true,
      message: 'MRFs retrieved',
      data: mockMRFs,
    });

    vi.spyOn(taApi, 'listClients').mockResolvedValue({
      success: true,
      message: 'Clients retrieved',
      data: mockClients,
    });

    vi.spyOn(taApi, 'checkInterviewCompliance').mockResolvedValue({
      success: true,
      message: 'Interview SLA check completed',
      data: {
        compliant: false,
        pendingSla: 1,
        breachedCount: 1,
        breachedInterviews: mockInterviews,
      },
    } as any);

    vi.spyOn(taApi, 'getComplianceOverview').mockResolvedValue({
      success: true,
      message: 'Compliance overview retrieved',
      data: {
        totalPending: 5,
        approvedCount: 15,
        pendingReviewCount: 5,
        rejectedCount: 0,
      },
    } as any);

    vi.spyOn(taApi, 'getApplication').mockResolvedValue({
      success: true,
      message: 'Application details retrieved',
      data: mockApplicationDetail,
    });

    vi.spyOn(taApi, 'getRecruiterDecisions').mockResolvedValue({
      success: true,
      message: 'Decisions retrieved',
      data: mockDecisions,
    });

    vi.spyOn(taApi, 'listInterviews').mockResolvedValue({
      success: true,
      message: 'Interviews retrieved',
      data: mockInterviews,
    });

    vi.spyOn(taApi, 'listRequirements').mockResolvedValue({
      success: true,
      message: 'Requirements retrieved',
      data: mockComplianceRequirements,
    });

    vi.spyOn(taApi, 'listEndorsements').mockResolvedValue({
      success: true,
      message: 'Endorsements retrieved',
      data: mockEndorsements,
    });

    vi.spyOn(taApi, 'listDeployments').mockResolvedValue({
      success: true,
      message: 'Deployments retrieved',
      data: mockDeployments,
    });
  });

  // ══════════════════════════════════════════════════════════
  // 1. TA Command Center Dashboard Tests
  // ══════════════════════════════════════════════════════════
  describe('TADashboardPage', () => {
    it('renders command center metrics, pipeline summary bar, action alerts, and recent applications', async () => {
      renderTAView(<TADashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ta-dashboard-page')).toBeInTheDocument();
      });

      // 4 Metric cards
      expect(screen.getByTestId('stat-active-candidates')).toHaveTextContent('42');
      expect(screen.getByTestId('stat-open-mrfs')).toHaveTextContent('1');
      expect(screen.getByTestId('stat-active-interviews')).toHaveTextContent('8');
      expect(screen.getByTestId('stat-compliance-stage')).toHaveTextContent('4');

      // Pipeline summary bar
      expect(screen.getByTestId('pipeline-summary-bar')).toBeInTheDocument();
      expect(screen.getByTestId('pipeline-stage-submitted')).toBeInTheDocument();
      expect(screen.getByTestId('pipeline-stage-initial_screening')).toBeInTheDocument();

      // Action Required section
      const actionSection = screen.getByTestId('action-required-section');
      expect(actionSection).toBeInTheDocument();
      expect(within(actionSection).getByText(/Bea Valdez/i)).toBeInTheDocument(); // Needs attention application
      expect(screen.getByText(/1 SLA Alert/i)).toBeInTheDocument(); // SLA breached interview count
      expect(screen.getByText(/5 Unreviewed/i)).toBeInTheDocument(); // Compliance docs

      // MRF Quota Tracker
      expect(screen.getByTestId('mrf-tracker-section')).toBeInTheDocument();
      expect(screen.getByText('Warehouse Logistics Operators')).toBeInTheDocument();
      expect(screen.getByText(/7 \/ 10/i)).toBeInTheDocument(); // Fill ratio

      // Recent Applications Table
      expect(screen.getByTestId('recent-applications-section')).toBeInTheDocument();
      expect(screen.getAllByText('Alex Torres').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    });

    it('renders error state and retries on failure', async () => {
      vi.spyOn(taApi, 'getPipelineStats').mockRejectedValueOnce(
        new Error('Network error connecting to TA API')
      );

      renderTAView(<TADashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard metrics/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Network error connecting to TA API/i)).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════
  // 2. TA Applications Pipeline & Search Page Tests
  // ══════════════════════════════════════════════════════════
  describe('TAApplicationsPage', () => {
    it('renders applications table, filters by search query, and switches status tabs', async () => {
      renderTAView(
        <Routes>
          <Route path="/ta/applications" element={<TAApplicationsPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('ta-applications-page')).toBeInTheDocument();
      });

      // Header and application count
      expect(screen.getByRole('heading', { name: /Application Pipeline/i })).toBeInTheDocument();
      expect(screen.getByTestId('application-table')).toBeInTheDocument();

      // Search input interaction
      const searchInput = screen.getByTestId('application-search-input');
      fireEvent.change(searchInput, { target: { value: 'Alex Torres' } });
      expect(searchInput).toHaveValue('Alex Torres');

      // Status tabs
      const screeningTab = screen.getByTestId('filter-tab-initial_screening');
      fireEvent.click(screeningTab);

      // Verify table rows with waitFor after query refetch
      await waitFor(() => {
        expect(screen.getByText('Alex Torres')).toBeInTheDocument();
      });
      expect(screen.getByText('alex.torres@example.com')).toBeInTheDocument();
      expect(screen.getByText('Senior Logistics Coordinator')).toBeInTheDocument();
    });

    it('handles pagination next and previous triggers', async () => {
      const mockManyApplications: ApplicationListItem[] = Array.from({ length: 25 }, (_, i) => ({
        id: 100 + i,
        status: ApplicationStatus.INITIAL_SCREENING,
        aiScore: 80,
        isArchived: false,
        createdAt: '2026-02-10T10:00:00Z',
        user: {
          id: `user-${i}`,
          email: `candidate${i}@example.com`,
          applicantProfile: {
            firstName: `Candidate`,
            lastName: `${i}`,
            mobileNumber: '09171234567',
            city: 'Taguig City',
            province: 'Metro Manila',
            photoUrl: null,
          },
        },
        jobPosting: {
          id: 1,
          title: 'Senior Logistics Coordinator',
          location: 'Taguig City',
        },
      }));

      vi.spyOn(taApi, 'listApplications').mockResolvedValueOnce({
        success: true,
        message: 'Applications list',
        data: mockManyApplications,
        pagination: {
          total: 25,
          page: 1,
          limit: 10,
          totalPages: 3,
        },
      } as any);

      renderTAView(
        <Routes>
          <Route path="/ta/applications" element={<TAApplicationsPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('applications-pagination')).toBeInTheDocument();
      });

      const paginationEl = screen.getByTestId('applications-pagination');
      expect(within(paginationEl).getByText(/Page/i)).toBeInTheDocument();
      expect(within(paginationEl).getByText(/of/i)).toBeInTheDocument();

      const nextBtn = screen.getByTestId('pagination-next');
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(within(screen.getByTestId('applications-pagination')).getByText(/Page/i)).toBeInTheDocument();
      });
    });
  });

  // ══════════════════════════════════════════════════════════
  // 3. TA Application Detail Page & Workspace Tabs Tests
  // ══════════════════════════════════════════════════════════
  describe('TAApplicationDetailPage & Subcomponents', () => {
    it('renders CandidateSidebar with vertical pipeline and status action bar', async () => {
      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-sidebar')).toBeInTheDocument();
      });

      const sidebar = screen.getByTestId('candidate-sidebar');
      expect(sidebar).toBeInTheDocument();

      // Candidate Profile info
      expect(within(sidebar).getByText('Alex Torres')).toBeInTheDocument();
      expect(within(sidebar).getByText('alex.torres@example.com')).toBeInTheDocument();
      expect(within(sidebar).getByText('09171234567')).toBeInTheDocument();
      expect(within(sidebar).getByText(/Taguig City/i)).toBeInTheDocument();

      // Vertical pipeline indicator
      expect(screen.getByTestId('pipeline-indicator-vertical')).toBeInTheDocument();

      // Status action bar buttons allowed for INITIAL_SCREENING
      expect(screen.getByTestId('action-move-endorsement-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-move-talent-pool-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-archive-btn')).toBeInTheDocument();
    });

    it('navigates through all 6 candidate workspace tabs', async () => {
      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('ta-application-detail-page')).toBeInTheDocument();
      });

      // Default Tab 1: Overview
      expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
      expect(screen.getByTestId('ai-score-card')).toBeInTheDocument();
      expect(screen.getByText(/Strong background in inventory and warehouse operations/i)).toBeInTheDocument();

      // Switch to Tab 2: Resume & Profile
      fireEvent.click(screen.getByTestId('detail-tab-resume'));
      expect(screen.getByTestId('resume-profile-tab')).toBeInTheDocument();
      expect(screen.getByText(/LBC Express International/i)).toBeInTheDocument();
      expect(screen.getByText(/Polytechnic University of the Philippines/i)).toBeInTheDocument();

      // Switch to Tab 3: Interviews
      fireEvent.click(screen.getByTestId('detail-tab-interviews'));
      expect(screen.getByTestId('interviews-tab')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('interview-item-201')).toBeInTheDocument();
      });

      // Switch to Tab 4: Endorsement
      fireEvent.click(screen.getByTestId('detail-tab-endorsement'));
      expect(screen.getByTestId('endorsement-tab')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('endorsement-item-401')).toBeInTheDocument();
      });

      // Switch to Tab 5: Compliance
      fireEvent.click(screen.getByTestId('detail-tab-compliance'));
      expect(screen.getByTestId('compliance-tab')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('compliance-status-banner')).toBeInTheDocument();
        expect(screen.getByTestId('compliance-req-item-301')).toBeInTheDocument();
      });

      // Switch to Tab 6: Deployment
      fireEvent.click(screen.getByTestId('detail-tab-deployment'));
      expect(screen.getByTestId('deployment-tab')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('deployment-status-tracker')).toBeInTheDocument();
        expect(screen.getByText(/Megaworld Logistics Hub BGC/i)).toBeInTheDocument();
      });
    });

    it('re-analyzes AI match score in OverviewTab', async () => {
      const analyzeSpy = vi.spyOn(taApi, 'analyzeApplication').mockResolvedValueOnce({
        success: true,
        message: 'AI re-analysis completed',
        data: {
          aiScore: 94,
          aiSummary: 'Strong candidate with warehouse operations background',
        },
      } as any);

      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('rerun-ai-btn')).toBeInTheDocument();
      });

      const rerunBtn = screen.getByTestId('rerun-ai-btn');
      fireEvent.click(rerunBtn);

      await waitFor(() => {
        expect(analyzeSpy).toHaveBeenCalledWith(101);
      });
    });

    it('schedules an interview in InterviewsTab and records outcome', async () => {
      const scheduleSpy = vi.spyOn(taApi, 'scheduleInterview').mockResolvedValueOnce({
        success: true,
        message: 'Interview scheduled',
        data: {
          id: 202,
          applicationId: 101,
          type: InterviewType.FINAL_INTERVIEW,
          scheduledAt: '2026-02-20T14:00:00Z',
          conductedAt: null,
          result: null,
          notes: 'Panel interview with client logistics VP',
          isActive: true,
          createdAt: '2026-02-12T00:00:00Z',
          updatedAt: '2026-02-12T00:00:00Z',
        },
      });

      const updateInterviewSpy = vi.spyOn(taApi, 'updateInterviewStatus').mockResolvedValueOnce({
        success: true,
        message: 'Interview result recorded',
        data: {
          id: 201,
          applicationId: 101,
          type: InterviewType.INITIAL_SCREENING,
          scheduledAt: '2026-02-02T09:00:00Z',
          conductedAt: null,
          result: 'PASSED',
          notes: 'Candidate passed screening with flying colors',
          isActive: true,
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-12T00:00:00Z',
        },
      });

      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('detail-tab-interviews')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('detail-tab-interviews'));

      // 1. Schedule Interview Modal
      const openScheduleBtn = screen.getByTestId('open-schedule-interview-modal-btn');
      fireEvent.click(openScheduleBtn);

      expect(screen.getByTestId('schedule-interview-form')).toBeInTheDocument();
      const dateInput = screen.getByTestId('interview-scheduled-at-input');
      fireEvent.change(dateInput, { target: { value: '2026-02-20T14:00' } });

      const submitScheduleBtn = screen.getByTestId('submit-schedule-interview-btn');
      fireEvent.click(submitScheduleBtn);

      await waitFor(() => {
        expect(scheduleSpy).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            scheduledAt: '2026-02-20T14:00',
          })
        );
      });

      // 2. Record Outcome Modal on existing interview
      const recordOutcomeBtn = screen.getByTestId('record-result-btn-201');
      fireEvent.click(recordOutcomeBtn);

      expect(screen.getByTestId('record-interview-result-form')).toBeInTheDocument();
      const passBtn = screen.getByTestId('result-pass-btn');
      fireEvent.click(passBtn);

      const submitResultBtn = screen.getByTestId('submit-interview-result-btn');
      fireEvent.click(submitResultBtn);

      await waitFor(() => {
        expect(updateInterviewSpy).toHaveBeenCalledWith(
          101,
          201,
          expect.objectContaining({
            result: 'PASSED',
          })
        );
      });
    });

    it('submits client endorsement in EndorsementTab', async () => {
      const endorseSpy = vi.spyOn(taApi, 'recordEndorsement').mockResolvedValueOnce({
        success: true,
        message: 'Endorsement submitted',
        data: {
          id: 402,
          applicationId: 101,
          clientId: 2,
          outcome: 'ENDORSED',
          notes: 'Recommended for operations shift manager position',
          client: mockClients[1],
          endorsedBy: {
            id: 'ta-1',
            email: 'recruiter@megs.com',
          },
          createdAt: '2026-02-12T00:00:00Z',
          updatedAt: '2026-02-12T00:00:00Z',
        },
      });

      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('detail-tab-endorsement')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('detail-tab-endorsement'));

      const openEndorseBtn = screen.getByTestId('open-endorse-modal-btn');
      fireEvent.click(openEndorseBtn);

      expect(screen.getByTestId('endorse-candidate-form')).toBeInTheDocument();

      const clientSelect = screen.getByTestId('endorsement-client-select');

      // Wait for clients query to populate select options inside the select dropdown
      await waitFor(() => {
        expect(within(clientSelect).getByText(/Prime Retail Solutions/i)).toBeInTheDocument();
      });

      fireEvent.change(clientSelect, { target: { value: '2' } });

      const submitEndorseBtn = screen.getByTestId('submit-endorsement-btn');
      fireEvent.click(submitEndorseBtn);

      await waitFor(() => {
        expect(endorseSpy).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            clientId: 2,
            outcome: 'ENDORSED',
          })
        );
      });
    });

    it('adds requirement and verifies document in ComplianceTab', async () => {
      const createReqSpy = vi.spyOn(taApi, 'createRequirement').mockResolvedValueOnce({
        success: true,
        message: 'Requirement added',
        data: {
          id: 303,
          applicationId: 101,
          documentLabel: 'Pag-IBIG Member ID',
          isRequired: true,
          reviewStatus: 'PENDING',
          createdAt: '2026-02-12T00:00:00Z',
          updatedAt: '2026-02-12T00:00:00Z',
        },
      });

      const reviewReqSpy = vi.spyOn(taApi, 'reviewRequirement').mockResolvedValueOnce({
        success: true,
        message: 'Requirement reviewed',
        data: {
          id: 302,
          applicationId: 101,
          documentLabel: 'Medical Fit-To-Work Certificate',
          isRequired: true,
          reviewStatus: 'APPROVED',
          reviewNotes: 'Cleared for high-intensity warehouse shift duties',
          createdAt: '2026-02-10T00:00:00Z',
          updatedAt: '2026-02-12T00:00:00Z',
        },
      });

      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('detail-tab-compliance')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('detail-tab-compliance'));

      // 1. Add requirement modal
      const addReqBtn = screen.getByTestId('add-requirement-btn');
      fireEvent.click(addReqBtn);

      expect(screen.getByTestId('add-requirement-form')).toBeInTheDocument();
      const labelInput = screen.getByTestId('req-document-label-input');
      fireEvent.change(labelInput, { target: { value: 'Pag-IBIG Member ID' } });

      const submitAddReqBtn = screen.getByTestId('submit-add-requirement-btn');
      fireEvent.click(submitAddReqBtn);

      await waitFor(() => {
        expect(createReqSpy).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            documentLabel: 'Pag-IBIG Member ID',
            isRequired: true,
          })
        );
      });

      // 2. Review requirement dialog
      const reviewBtn = screen.getByTestId('review-doc-btn-302');
      fireEvent.click(reviewBtn);

      expect(screen.getByTestId('review-requirement-form')).toBeInTheDocument();
      const approveBtn = screen.getByTestId('review-approve-btn');
      fireEvent.click(approveBtn);

      const submitReviewBtn = screen.getByTestId('submit-compliance-review-btn');
      fireEvent.click(submitReviewBtn);

      await waitFor(() => {
        expect(reviewReqSpy).toHaveBeenCalledWith(
          302,
          expect.objectContaining({
            reviewStatus: 'APPROVED',
          })
        );
      });
    });

    it('creates deployment assignment in DeploymentTab', async () => {
      const createDeploySpy = vi.spyOn(taApi, 'createDeployment').mockResolvedValueOnce({
        success: true,
        message: 'Deployment assignment created',
        data: {
          id: 502,
          applicationId: 101,
          employeeId: 1,
          clientId: 1,
          mrfId: 1,
          site: 'Makati Regional Logistics Hub',
          status: DeploymentStatus.PENDING_ORIENTATION,
          contractStart: '2026-03-01',
          contractEnd: '2027-03-01',
          client: mockClients[0],
          mrf: mockMRFs[0],
          createdById: 'ta-1',
          createdAt: '2026-02-12T00:00:00Z',
          updatedAt: '2026-02-12T00:00:00Z',
        } as any,
      });

      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('detail-tab-deployment')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('detail-tab-deployment'));

      const openCreateDeployBtn = screen.getByTestId('open-create-deployment-btn');
      fireEvent.click(openCreateDeployBtn);

      expect(screen.getByTestId('create-deployment-form')).toBeInTheDocument();

      const clientSelect = screen.getByTestId('deployment-client-select');

      // Wait for clients dropdown to populate inside the select dropdown
      await waitFor(() => {
        expect(within(clientSelect).getByText(/Megaworld Logistics Global/i)).toBeInTheDocument();
      });

      fireEvent.change(clientSelect, { target: { value: '1' } });

      const submitDeployBtn = screen.getByTestId('submit-create-deployment-btn');
      fireEvent.click(submitDeployBtn);

      await waitFor(() => {
        expect(createDeploySpy).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            clientId: 1,
          })
        );
      });
    });

    it('triggers status transition with confirmation dialog from sidebar', async () => {
      const archiveSpy = vi.spyOn(taApi, 'archiveApplication').mockResolvedValueOnce({
        success: true,
        message: 'Application archived',
        data: null,
      });

      renderTAView(
        <Routes>
          <Route path="/ta/applications/:id" element={<TAApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/applications/101'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('action-archive-btn')).toBeInTheDocument();
      });

      // Click Archive action button
      const archiveBtn = screen.getByTestId('action-archive-btn');
      fireEvent.click(archiveBtn);

      // Confirm dialog appears
      const confirmDialog = screen.getByTestId('confirm-dialog');
      expect(confirmDialog).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to archive this application/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Yes, Archive/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(archiveSpy).toHaveBeenCalledWith(101, '');
      });
    });
  });
});
