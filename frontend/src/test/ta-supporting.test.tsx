import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TAJobsPage from '../pages/ta/TAJobsPage';
import TAJobDetailPage from '../pages/ta/TAJobDetailPage';
import TAClientsPage from '../pages/ta/TAClientsPage';
import TAClientDetailPage from '../pages/ta/TAClientDetailPage';
import TAMRFsPage from '../pages/ta/TAMRFsPage';
import TAMRFDetailPage from '../pages/ta/TAMRFDetailPage';
import TATalentPoolPage from '../pages/ta/TATalentPoolPage';
import TAInterviewsPage from '../pages/ta/TAInterviewsPage';
import TADeploymentsPage from '../pages/ta/TADeploymentsPage';
import TAEmployeesPage from '../pages/ta/TAEmployeesPage';
import TAEmployeeDetailPage from '../pages/ta/TAEmployeeDetailPage';
import TAAnalyticsPage from '../pages/ta/TAAnalyticsPage';

import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { taApi } from '../lib/api/ta';
import { employeeApi } from '../lib/api/employees';
import {
  Role,
  JobStatus,
  ApplicationStatus,
  InterviewType,
  DeploymentStatus,
  EmploymentStatus,
  CandidateAvailability,
} from '../lib/types/enums';
import type {
  JobPosting,
  ManpowerRequest,
  Client,
  ApplicationListItem,
  TalentPoolSearchResult,
  TalentPoolMembership,
  Deployment,
  DeploymentStats,
  Employee,
  Digital201File,
  EmploymentEvent,
  PipelineStats,
  TimeToFillStats,
  ComplianceOverviewStats,
} from '../lib/types/api';

// ── Mock Fixtures ──────────────────────────────────────────

const mockClients: Client[] = [
  {
    id: 1,
    name: 'Megaworld Logistics Global',
    industry: 'Logistics & Supply Chain',
    contactName: 'Mr. Ricardo Dizon',
    contactEmail: 'contact@megaworld.com',
    contactPhone: '09171112233',
    address: 'BGC, Taguig City',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    manpowerRequests: [],
    deployments: [],
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
    manpowerRequests: [],
    deployments: [],
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
    location: 'Taguig City',
    targetFillDate: '2026-03-31T00:00:00Z',
    requiredSkills: 'Forklift Operation, WMS',
    description: 'Day shift and night shift warehouse operators',
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
    status: 'OPEN',
    priority: 'URGENT',
    location: 'Quezon City',
    targetFillDate: '2026-03-15T00:00:00Z',
    requiredSkills: 'Customer Service, Bilingual',
    createdById: 'ta-1',
    client: mockClients[1],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    _count: { deployments: 2 },
  },
];

const mockJobs: JobPosting[] = [
  {
    id: 1,
    postedById: 'ta-1',
    title: 'Senior Logistics Coordinator',
    description: 'Lead day-to-day warehouse logistics and carrier coordination.',
    requirements: 'At least 3 years experience in warehouse supervision.',
    location: 'Taguig City',
    status: JobStatus.OPEN,
    mrfId: 1,
    mrf: mockMRFs[0],
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    _count: { applications: 8 },
  },
  {
    id: 2,
    postedById: 'ta-1',
    title: 'Customer Service Representative',
    description: 'Provide omnichannel customer support.',
    requirements: 'Excellent verbal communication and problem solving.',
    location: 'Quezon City',
    status: JobStatus.DRAFT,
    mrfId: 2,
    mrf: mockMRFs[1],
    createdAt: '2026-02-05T00:00:00Z',
    updatedAt: '2026-02-05T00:00:00Z',
    _count: { applications: 0 },
  },
];

const mockRankedCandidates: ApplicationListItem[] = [
  {
    id: 101,
    status: ApplicationStatus.INITIAL_SCREENING,
    aiScore: 92,
    candidateFitScore: 92,
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
    status: ApplicationStatus.REVIEW,
    aiScore: 78,
    candidateFitScore: 78,
    isArchived: false,
    createdAt: '2026-02-11T11:00:00Z',
    user: {
      id: 'user-002',
      email: 'maria.santos@example.com',
      applicantProfile: {
        firstName: 'Maria',
        lastName: 'Santos',
        mobileNumber: '09187654321',
        city: 'Makati City',
        province: 'Metro Manila',
      },
    },
    jobPosting: {
      id: 1,
      title: 'Senior Logistics Coordinator',
      location: 'Taguig City',
    },
  },
];

const mockTalentPoolMemberships: TalentPoolMembership[] = [
  {
    id: 201,
    applicantProfileId: 1,
    applicantProfile: {
      id: 1,
      userId: 'user-001',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      mobileNumber: '09170001111',
      gender: 'Male',
      province: 'Metro Manila',
      city: 'Taguig City',
      dateOfBirth: '1990-01-01',
      birthPlace: 'Manila',
      nationality: 'Filipino',
      civilStatus: 'Single',
      address: 'Taguig City',
      professionalSummary: 'Experienced Forklift Operator with valid TESDA NCII',
      isActive: true,
      hasConsentedToAi: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      skills: ['Forklift Operation', 'WMS', 'Safety Standards'] as any,
      user: { email: 'juan.delacruz@example.com' },
    },
    status: 'ACTIVE',
    availability: CandidateAvailability.AVAILABLE,
    addedById: 'ta-1',
    addedAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
    lastContactedAt: '2026-02-01T00:00:00Z',
  },
];

const mockTalentPoolSearch: TalentPoolSearchResult[] = [
  {
    membership: mockTalentPoolMemberships[0],
    similarityScore: 89,
    matchedSkills: ['Forklift Operation', 'WMS'],
  },
];

const mockEmployee: Employee = {
  id: 1,
  userId: 'user-001',
  user: {
    id: 'user-001',
    email: 'alex.torres@example.com',
    role: Role.APPLICANT,
    accountStatus: 'ACTIVE',
    applicantProfile: {
      id: 1,
      userId: 'user-001',
      firstName: 'Alex',
      lastName: 'Torres',
      mobileNumber: '09171234567',
      gender: 'Male',
      province: 'Metro Manila',
      city: 'Taguig City',
      dateOfBirth: '1992-08-20',
      birthPlace: 'Taguig City',
      nationality: 'Filipino',
      civilStatus: 'Married',
      address: '456 BGC Tower, Taguig City',
      sss: '01-2345678-9',
      tin: '123-456-789-000',
      philhealth: '12-345678901-2',
      pagibig: '1234-5678-9012',
      emergencyContactName: 'Elena Torres',
      emergencyContactRelationship: 'Spouse',
      emergencyContactPhone: '09179998877',
      professionalSummary: 'Experienced Warehouse Shift Supervisor',
      isActive: true,
      hasConsentedToAi: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
  employeeNumber: 'EMP-2026-0001',
  status: EmploymentStatus.ACTIVE,
  hireDate: '2026-02-12T00:00:00Z',
  department: 'Warehouse Logistics',
  position: 'Shift Supervisor',
  createdAt: '2026-02-12T00:00:00Z',
  updatedAt: '2026-02-12T00:00:00Z',
};

const mockDeployments: Deployment[] = [
  {
    id: 501,
    employeeId: 1,
    employee: mockEmployee,
    clientId: 1,
    client: mockClients[0],
    mrfId: 1,
    mrf: mockMRFs[0],
    site: 'Megaworld Logistics Hub BGC',
    contractStart: '2026-03-01',
    contractEnd: '2027-03-01',
    status: DeploymentStatus.ACTIVE,
    createdById: 'ta-1',
    createdAt: '2026-02-12T00:00:00Z',
    updatedAt: '2026-02-12T00:00:00Z',
  },
];

const mockEmploymentEvents: EmploymentEvent[] = [
  {
    id: 701,
    employeeId: 1,
    eventType: 'HIRED' as any,
    description: 'Hired as Shift Supervisor for Megaworld Account',
    effectiveDate: '2026-02-12T00:00:00Z',
    createdAt: '2026-02-12T00:00:00Z',
  },
  {
    id: 702,
    employeeId: 1,
    eventType: 'DEPLOYED' as any,
    description: 'Dispatched to BGC Logistics Hub Site',
    effectiveDate: '2026-03-01T00:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
  },
];

const mockDigital201: Digital201File = {
  employee: mockEmployee,
  applicantProfile: mockEmployee.user.applicantProfile!,
  deployments: mockDeployments,
  complianceRequirements: [
    {
      id: 801,
      applicationId: 101,
      documentLabel: 'NBI Clearance',
      isRequired: true,
      reviewStatus: 'APPROVED',
      reviewedAt: '2026-02-11T00:00:00Z',
      createdAt: '2026-02-10T00:00:00Z',
      updatedAt: '2026-02-11T00:00:00Z',
    },
    {
      id: 802,
      applicationId: 101,
      documentLabel: 'Medical Examination & Drug Test',
      isRequired: true,
      reviewStatus: 'APPROVED',
      reviewedAt: '2026-02-11T00:00:00Z',
      createdAt: '2026-02-10T00:00:00Z',
      updatedAt: '2026-02-11T00:00:00Z',
    },
  ],
  employmentEvents: mockEmploymentEvents,
  storedDocuments: [
    {
      id: 901,
      ownerId: 'user-001',
      category: 'VAULT_201' as any,
      originalName: 'Alex_Torres_NBI_Clearance_2026.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 154000,
      sha256: 'abc123sha',
      storageBucket: 'vault-201',
      storagePath: '201/user-001/nbi.pdf',
      uploadedAt: '2026-02-10T00:00:00Z',
    },
  ],
};

const mockPipelineStats: PipelineStats = {
  totalActive: 24,
  totalHired: 6,
  totalArchived: 4,
  byStatus: {
    [ApplicationStatus.SUBMITTED]: 8,
    [ApplicationStatus.PARSING]: 0,
    [ApplicationStatus.REVIEW]: 4,
    [ApplicationStatus.NEEDS_ATTENTION]: 1,
    [ApplicationStatus.MATCHED]: 0,
    [ApplicationStatus.TALENT_POOL]: 2,
    [ApplicationStatus.INITIAL_SCREENING]: 3,
    [ApplicationStatus.CLIENT_ENDORSEMENT]: 2,
    [ApplicationStatus.FINAL_INTERVIEW]: 2,
    [ApplicationStatus.HIRED]: 6,
    [ApplicationStatus.ONBOARDING]: 0,
    [ApplicationStatus.COMPLIANCE]: 2,
    [ApplicationStatus.DEPLOYED]: 7,
    [ApplicationStatus.BACKOUT]: 0,
    [ApplicationStatus.ARCHIVED]: 4,
  },
};

const mockTimeToFillStats: TimeToFillStats = {
  averageDaysToScreening: 2.1,
  averageDaysToEndorsement: 4.3,
  averageDaysToOffer: 7.8,
  averageDaysToHire: 10.2,
  averageDaysToDeployment: 12.4,
  overallTimeToFillDays: 12.4,
};

const mockDeploymentStats: DeploymentStats = {
  totalActiveDeployments: 7,
  pendingOrientationCount: 2,
  readyCount: 1,
  dispatchedCount: 1,
  byClient: [
    {
      clientId: 1,
      clientName: 'Megaworld Logistics Global',
      activeCount: 5,
    },
    {
      clientId: 2,
      clientName: 'Prime Retail Solutions',
      activeCount: 2,
    },
  ],
};

const mockComplianceOverview: ComplianceOverviewStats = {
  totalRequirements: 48,
  approvedCount: 45,
  pendingReviewCount: 3,
  rejectedCount: 0,
  complianceRatePercent: 94,
};

// ── Test Helper ────────────────────────────────────────────

function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {}
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
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

// ── Test Suites ────────────────────────────────────────────

describe('Phase 6: Talent Acquisition Supporting Modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Mock Implementations
    vi.spyOn(taApi, 'listJobs').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockJobs,
    });
    vi.spyOn(taApi, 'getJob').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockJobs[0],
    });
    vi.spyOn(taApi, 'createJob').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockJobs[0],
    });
    vi.spyOn(taApi, 'getRankedCandidates').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockRankedCandidates,
    });
    vi.spyOn(taApi, 'matchTalentPoolForJob').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockTalentPoolMemberships,
    });
    vi.spyOn(taApi, 'rankCandidates').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { reevaluatedCount: 2 },
    });

    vi.spyOn(taApi, 'listClients').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockClients,
    });
    vi.spyOn(taApi, 'getClient').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        ...mockClients[0],
        manpowerRequests: mockMRFs,
        deployments: mockDeployments,
      },
    });
    vi.spyOn(taApi, 'createClient').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockClients[0],
    });

    vi.spyOn(taApi, 'listMRFs').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockMRFs,
    });
    vi.spyOn(taApi, 'getMRF').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        ...mockMRFs[0],
        jobPostings: [mockJobs[0]],
        complianceTemplates: [
          {
            id: 1,
            mrfId: 1,
            documentLabel: 'NBI Clearance',
            isRequired: true,
            createdAt: '2026-02-01T00:00:00Z',
            updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
      },
    });
    vi.spyOn(taApi, 'createMRF').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockMRFs[0],
    });
    vi.spyOn(taApi, 'listMRFComplianceTemplates').mockResolvedValue({
      success: true,
      message: 'OK',
      data: [
        {
          id: 1,
          mrfId: 1,
          documentLabel: 'NBI Clearance',
          isRequired: true,
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-01T00:00:00Z',
        },
      ],
    });
    vi.spyOn(taApi, 'createComplianceTemplate').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        id: 2,
        mrfId: 1,
        documentLabel: 'Drug Test Result',
        isRequired: true,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      },
    });

    vi.spyOn(taApi, 'searchTalentPool').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockTalentPoolSearch,
    });
    vi.spyOn(taApi, 'considerCandidate').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { application: mockRankedCandidates[0] },
    });
    vi.spyOn(taApi, 'contactTalentPoolMember').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        id: 1,
        membershipId: 201,
        jobPostingId: 1,
        recruiterId: 'ta-1',
        outcome: 'INTERESTED' as any,
        contactedAt: '2026-02-12T00:00:00Z',
      },
    });

    vi.spyOn(taApi, 'checkInterviewCompliance').mockResolvedValue({
      success: true,
      message: 'OK',
      data: { compliant: true, pendingSla: 0 },
    });
    vi.spyOn(taApi, 'listApplications').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockRankedCandidates,
    });
    vi.spyOn(taApi, 'updateInterviewStatus').mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        id: 1,
        applicationId: 101,
        type: InterviewType.INITIAL_SCREENING,
        result: 'PASS',
        isActive: true,
        createdAt: '2026-02-10T00:00:00Z',
        updatedAt: '2026-02-12T00:00:00Z',
      },
    });

    vi.spyOn(taApi, 'listDeployments').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockDeployments,
    });
    vi.spyOn(taApi, 'getDeploymentStats').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockDeploymentStats,
    });
    vi.spyOn(taApi, 'updateDeploymentStatus').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockDeployments[0],
    });

    vi.spyOn(employeeApi, 'listEmployees').mockResolvedValue({
      success: true,
      message: 'OK',
      data: [mockEmployee],
    });
    vi.spyOn(employeeApi, 'getDigital201').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockDigital201,
    });
    vi.spyOn(employeeApi, 'getEmploymentHistory').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockEmploymentEvents,
    });
    vi.spyOn(employeeApi, 'updateStatus').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockEmployee,
    });

    vi.spyOn(taApi, 'getPipelineStats').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockPipelineStats,
    });
    vi.spyOn(taApi, 'getTimeToFillStats').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockTimeToFillStats,
    });
    vi.spyOn(taApi, 'getComplianceOverview').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockComplianceOverview,
    });
    vi.spyOn(taApi, 'exportPipelineReport').mockResolvedValue(new Blob(['fake-pdf'], { type: 'application/pdf' }));
    vi.spyOn(taApi, 'exportDeploymentReport').mockResolvedValue(new Blob(['fake-xlsx'], { type: 'application/vnd.ms-excel' }));
  });

  // ── 1. TAJobsPage & TAJobDetailPage ────────────────────────
  describe('1. TAJobsPage & TAJobDetailPage', () => {
    it('renders job postings list, search input, and opens Create Job modal', async () => {
      renderWithProviders(<TAJobsPage />);

      expect(await screen.findByText('Senior Logistics Coordinator')).toBeInTheDocument();
      expect(screen.getByText('Customer Service Representative')).toBeInTheDocument();

      // Open modal
      const createBtn = screen.getByTestId('create-job-btn');
      fireEvent.click(createBtn);

      expect(screen.getByText('Create New Job Posting')).toBeInTheDocument();

      // Fill in modal
      fireEvent.change(screen.getByTestId('job-title-input'), {
        target: { value: 'Inventory Warehouse Auditor' },
      });
      fireEvent.change(screen.getByTestId('job-description-input'), {
        target: { value: 'Perform monthly cycle counts and audit stock variance.' },
      });
      fireEvent.change(screen.getByTestId('job-requirements-input'), {
        target: { value: 'Degree in Accountancy or equivalent experience.' },
      });

      const submitBtn = screen.getByTestId('submit-create-job-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(taApi.createJob).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Inventory Warehouse Auditor',
          })
        );
      });
    });

    it('renders TAJobDetailPage with ranked candidates AI match and triggers re-ranking', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/ta/jobs/:id" element={<TAJobDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/jobs/1'] }
      );

      expect(await screen.findByRole('heading', { name: 'Senior Logistics Coordinator' })).toBeInTheDocument();
      expect(await screen.findByText('Alex Torres')).toBeInTheDocument();

      // Re-rank AI Match button
      const rerankBtn = screen.getByTestId('rerank-candidates-btn');
      fireEvent.click(rerankBtn);

      await waitFor(() => {
        expect(taApi.rankCandidates).toHaveBeenCalledWith(1);
      });
    });
  });

  // ── 2. TAClientsPage & TAClientDetailPage ──────────────────
  describe('2. TAClientsPage & TAClientDetailPage', () => {
    it('renders client accounts and submits Add Client modal', async () => {
      renderWithProviders(<TAClientsPage />);

      expect(await screen.findByText('Megaworld Logistics Global')).toBeInTheDocument();
      expect(screen.getByText('Prime Retail Solutions')).toBeInTheDocument();

      // Open Add Client modal
      const addBtn = screen.getByTestId('add-client-btn');
      fireEvent.click(addBtn);

      expect(screen.getByText('Register Client Account')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('client-name-input'), {
        target: { value: 'Apex Logistics Hub' },
      });
      fireEvent.change(screen.getByTestId('client-industry-input'), {
        target: { value: 'Freight Forwarding' },
      });

      const submitBtn = screen.getByTestId('submit-create-client-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(taApi.createClient).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Apex Logistics Hub',
            industry: 'Freight Forwarding',
          })
        );
      });
    });

    it('renders TAClientDetailPage with linked MRFs and deployed staff', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/ta/clients/:id" element={<TAClientDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/clients/1'] }
      );

      expect(await screen.findByRole('heading', { name: 'Megaworld Logistics Global' })).toBeInTheDocument();
      expect(await screen.findByText('Warehouse Logistics Operators')).toBeInTheDocument();
    });
  });

  // ── 3. TAMRFsPage & TAMRFDetailPage ────────────────────────
  describe('3. TAMRFsPage & TAMRFDetailPage', () => {
    it('renders MRFs with headcount fill ratio and creates new MRF', async () => {
      renderWithProviders(<TAMRFsPage />);

      expect(await screen.findByText('Warehouse Logistics Operators')).toBeInTheDocument();
      expect(screen.getByText('Customer Experience Specialists')).toBeInTheDocument();

      // Priority Filter
      const urgentTab = screen.getByTestId('tab-priority-urgent');
      fireEvent.click(urgentTab);
      expect(screen.getByText('Customer Experience Specialists')).toBeInTheDocument();

      // Open Create MRF
      const createBtn = screen.getByTestId('create-mrf-btn');
      fireEvent.click(createBtn);

      fireEvent.change(screen.getByTestId('mrf-client-select'), {
        target: { value: '1' },
      });
      fireEvent.change(screen.getByTestId('mrf-title-input'), {
        target: { value: 'Forklift Drivers Day Shift' },
      });
      fireEvent.change(screen.getByTestId('mrf-headcount-input'), {
        target: { value: '12' },
      });

      const submitBtn = screen.getByTestId('submit-create-mrf-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(taApi.createMRF).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 1,
            title: 'Forklift Drivers Day Shift',
            headcount: 12,
          })
        );
      });
    });

    it('renders TAMRFDetailPage with quota fulfillment bar and compliance templates', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/ta/mrfs/:id" element={<TAMRFDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/mrfs/1'] }
      );

      expect(await screen.findByText('Warehouse Logistics Operators')).toBeInTheDocument();
      expect(screen.getByTestId('headcount-fill-ratio')).toHaveTextContent('7 / 10 Filled (70%)');

      // Switch to Compliance Tab
      const complianceTab = screen.getByTestId('tab-mrf-compliance');
      fireEvent.click(complianceTab);

      expect(screen.getByText('NBI Clearance')).toBeInTheDocument();

      // Add Compliance Template Requirement
      const addTemplateBtn = screen.getByTestId('add-compliance-template-btn');
      fireEvent.click(addTemplateBtn);

      fireEvent.change(screen.getByTestId('template-label-input'), {
        target: { value: 'Drug Test 5-Panel' },
      });

      const submitTemplateBtn = screen.getByTestId('submit-add-template-btn');
      fireEvent.click(submitTemplateBtn);

      await waitFor(() => {
        expect(taApi.createComplianceTemplate).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            documentLabel: 'Drug Test 5-Panel',
          })
        );
      });
    });
  });

  // ── 4. TATalentPoolPage ───────────────────────────────────
  describe('4. TATalentPoolPage', () => {
    it('renders semantic search, matched skills, and considers candidate for job', async () => {
      renderWithProviders(<TATalentPoolPage />);

      expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Matched Skills:')).toBeInTheDocument();
      expect(screen.getByText('Forklift Operation')).toBeInTheDocument();

      // Perform Semantic Search
      const searchInput = screen.getByTestId('talent-pool-search-input');
      fireEvent.change(searchInput, { target: { value: 'Forklift NCII' } });
      const searchBtn = screen.getByTestId('search-talent-btn');
      fireEvent.click(searchBtn);

      await waitFor(() => {
        expect(taApi.searchTalentPool).toHaveBeenCalledWith(
          expect.objectContaining({
            query: 'Forklift NCII',
          })
        );
      });

      // Consider candidate for job
      const considerBtn = await screen.findByTestId('consider-btn-201');
      fireEvent.click(considerBtn);

      expect(screen.getByText('Consider Candidate for Open Job')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('consider-job-select'), {
        target: { value: '1' },
      });

      const submitConsiderBtn = screen.getByTestId('submit-consider-job-btn');
      fireEvent.click(submitConsiderBtn);

      await waitFor(() => {
        expect(taApi.considerCandidate).toHaveBeenCalledWith({
          membershipId: 201,
          jobPostingId: 1,
        });
      });
    });
  });

  // ── 5. TAInterviewsPage ───────────────────────────────────
  describe('5. TAInterviewsPage', () => {
    it('renders 7-Day SLA compliance banner and updates interview outcome', async () => {
      renderWithProviders(<TAInterviewsPage />);

      expect(await screen.findByTestId('sla-banner-compliant')).toBeInTheDocument();
      expect(await screen.findByText('Alex Torres')).toBeInTheDocument();

      // Update outcome modal
      const outcomeBtn = screen.getByTestId('update-result-btn-101');
      fireEvent.click(outcomeBtn);

      expect(screen.getByText('Record Interview Outcome')).toBeInTheDocument();

      const submitOutcomeBtn = screen.getByTestId('submit-interview-result-btn');
      fireEvent.click(submitOutcomeBtn);

      await waitFor(() => {
        expect(taApi.updateInterviewStatus).toHaveBeenCalled();
      });
    });
  });

  // ── 6. TADeploymentsPage ──────────────────────────────────
  describe('6. TADeploymentsPage', () => {
    it('renders deployment stats cards and updates deployment status', async () => {
      renderWithProviders(<TADeploymentsPage />);

      expect(await screen.findByTestId('deployment-stats-cards')).toBeInTheDocument();
      expect(await screen.findByText('Megaworld Logistics Hub BGC')).toBeInTheDocument();

      // Open status modal
      const statusBtn = screen.getByTestId('update-deployment-status-btn-501');
      fireEvent.click(statusBtn);

      expect(screen.getByText('Update Deployment Status')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('deployment-status-reason-input'), {
        target: { value: 'Dispatched on time' },
      });

      const submitBtn = screen.getByTestId('submit-deployment-status-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(taApi.updateDeploymentStatus).toHaveBeenCalledWith(
          501,
          expect.objectContaining({
            reason: 'Dispatched on time',
          })
        );
      });
    });
  });

  // ── 7. TAEmployeesPage & TAEmployeeDetailPage ──────────────
  describe('7. TAEmployeesPage & TAEmployeeDetailPage', () => {
    it('renders employee directory and views 201 file', async () => {
      renderWithProviders(<TAEmployeesPage />);

      expect(await screen.findByText('EMP-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Alex Torres')).toBeInTheDocument();
      expect(screen.getByTestId('view-201-1')).toBeInTheDocument();
    });

    it('renders TAEmployeeDetailPage with Government IDs and digital dossier tabs', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/ta/employees/:id" element={<TAEmployeeDetailPage />} />
        </Routes>,
        { initialEntries: ['/ta/employees/1'] }
      );

      expect(await screen.findByText('Alex Torres')).toBeInTheDocument();
      expect(screen.getByText('01-2345678-9')).toBeInTheDocument(); // SSS
      expect(screen.getByText('123-456-789-000')).toBeInTheDocument(); // TIN

      // Switch to Timeline Tab
      const timelineTab = screen.getByTestId('tab-201-timeline');
      fireEvent.click(timelineTab);

      expect(screen.getByText('Hired as Shift Supervisor for Megaworld Account')).toBeInTheDocument();
    });
  });

  // ── 8. TAAnalyticsPage ────────────────────────────────────
  describe('8. TAAnalyticsPage', () => {
    it('renders conversion funnel, time-to-fill velocity, and export buttons', async () => {
      renderWithProviders(<TAAnalyticsPage />);

      expect(await screen.findByTestId('analytics-kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('pipeline-funnel-section')).toBeInTheDocument();
      expect(screen.getByTestId('time-to-fill-section')).toBeInTheDocument();
      expect(screen.getByTestId('compliance-overview-section')).toBeInTheDocument();

      // Trigger export
      const exportPdfBtn = screen.getByTestId('export-pipeline-pdf-btn');
      fireEvent.click(exportPdfBtn);

      await waitFor(() => {
        expect(taApi.exportPipelineReport).toHaveBeenCalledWith('pdf');
      });
    });
  });
});
