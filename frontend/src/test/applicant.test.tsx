import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApplicantDashboardPage from '../pages/applicant/ApplicantDashboardPage';
import ApplicantProfilePage from '../pages/applicant/ApplicantProfilePage';
import ApplicantJobsPage from '../pages/applicant/ApplicantJobsPage';
import ApplicantJobDetailPage from '../pages/applicant/ApplicantJobDetailPage';
import ApplicantApplicationsPage from '../pages/applicant/ApplicantApplicationsPage';
import ApplicantApplicationDetailPage from '../pages/applicant/ApplicantApplicationDetailPage';
import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { applicantApi } from '../lib/api/applicant';
import { Role, ApplicationStatus, JobStatus, AssetVerificationState } from '../lib/types/enums';
import type { ApplicantProfile, JobPosting, Application } from '../lib/types/api';

// ── Mock Data ──────────────────────────────────────

const mockProfile: ApplicantProfile = {
  id: 1,
  userId: 'user-123',
  firstName: 'Juan',
  middleName: 'Protacio',
  lastName: 'Dela Cruz',
  mobileNumber: '09171234567',
  gender: 'Male',
  province: 'Metro Manila',
  city: 'Quezon City',
  dateOfBirth: '1995-05-15',
  birthPlace: 'Quezon City',
  nationality: 'Filipino',
  civilStatus: 'Single',
  height: 175,
  weight: 70,
  religion: 'Christian',
  address: '123 Katipunan Ave, Loyola Heights',
  preferredWorkLocations: 'Quezon City, Taguig, Makati',
  pagibig: '1234-5678-9012',
  philhealth: '12-345678901-2',
  sss: '01-2345678-9',
  tin: '123-456-789-000',
  photoUrl: 'https://example.com/photo.jpg',
  resumeUrl: 'https://example.com/resume.pdf',
  professionalSummary: 'Experienced operations and recruitment specialist with 5+ years of track record.',
  emergencyContactName: 'Maria Dela Cruz',
  emergencyContactRelationship: 'Mother',
  emergencyContactPhone: '09187654321',
  emergencyContactAddress: '123 Katipunan Ave',
  additionalNotes: 'Available for immediate placement',
  isActive: true,
  hasConsentedToAi: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  workExperiences: [
    {
      id: 101,
      applicantProfileId: 1,
      company: 'Megaworld Operations',
      roleTitle: 'Site Logistics Supervisor',
      location: 'Taguig City',
      startDate: '2023-01-01',
      endDate: null,
      isCurrent: true,
      summary: 'Supervised onsite logistics and warehouse coordination.',
    },
  ],
  educations: [
    {
      id: 201,
      applicantProfileId: 1,
      school: 'University of the Philippines Diliman',
      degree: 'Bachelor Degree',
      fieldOfStudy: 'Industrial Engineering',
      startDate: '2015-06-01',
      endDate: '2019-04-01',
      notes: 'College Scholar and Dean Lister',
    },
  ],
  skills: ['Project Management', 'Logistics', 'Quality Assurance'],
  trainings: [
    {
      id: 301,
      applicantProfileId: 1,
      title: 'Basic Occupational Safety and Health (BOSH)',
      provider: 'DOLE-OSHC',
      completionDate: '2024-02-15',
      certificateNo: 'OSH-2024-9988',
      notes: '40-hour mandatory safety certification',
    },
  ],
  characterReferences: [
    {
      id: 401,
      applicantProfileId: 1,
      name: 'Engr. Roberto Santos',
      relationship: 'Operations Director at Megaworld',
      phone: '09170001122',
      email: 'roberto@example.com',
      notes: 'Direct supervisor for 2 years',
    },
  ],
  assets: [
    {
      id: 501,
      applicantProfileId: 1,
      label: 'NBI Clearance',
      fileUrl: 'https://example.com/nbi.pdf',
      verificationState: AssetVerificationState.VERIFIED,
      notes: 'Issued January 2026',
    },
  ],
};

const mockJobs: JobPosting[] = [
  {
    id: 1,
    postedById: 'ta-1',
    title: 'Warehouse Operations Lead',
    description: 'Responsible for end-to-end warehouse coordination and logistics fulfillment.',
    requirements: 'Must have at least 2 years background in supply chain or logistics operations.',
    location: 'Taguig City',
    status: JobStatus.OPEN,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    _count: { applications: 4 },
  },
  {
    id: 2,
    postedById: 'ta-1',
    title: 'Customer Relations Associate',
    description: 'Provide customer support and resolve client queries in a timely manner.',
    requirements: 'Exceptional communication skills and customer service orientation.',
    location: 'Quezon City',
    status: JobStatus.OPEN,
    createdAt: '2026-02-05T00:00:00Z',
    updatedAt: '2026-02-05T00:00:00Z',
    _count: { applications: 8 },
  },
  {
    id: 3,
    postedById: 'ta-1',
    title: 'Junior QA Specialist',
    description: 'Perform functional testing and quality control inspections.',
    requirements: 'Degree in Engineering or Computer Science or related field.',
    location: 'Pasig City',
    status: JobStatus.OPEN,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
    _count: { applications: 2 },
  },
];

const mockApplications: Application[] = [
  {
    id: 10,
    userId: 'user-123',
    jobPostingId: 1,
    status: ApplicationStatus.INITIAL_SCREENING,
    resumeUrl: 'https://example.com/resume.pdf',
    isArchived: false,
    createdAt: '2026-02-02T10:00:00Z',
    updatedAt: '2026-02-03T10:00:00Z',
    jobPosting: mockJobs[0],
    user: {
      id: 'user-123',
      email: 'juan@example.com',
      applicantProfile: mockProfile,
    },
  },
  {
    id: 11,
    userId: 'user-123',
    jobPostingId: 2,
    status: ApplicationStatus.COMPLIANCE,
    resumeUrl: 'https://example.com/resume.pdf',
    isArchived: false,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-01-25T10:00:00Z',
    jobPosting: mockJobs[1],
    user: {
      id: 'user-123',
      email: 'juan@example.com',
      applicantProfile: mockProfile,
    },
  },
];

// Helper to render with Auth, QueryClient, and Router
function renderApplicantView(
  ui: React.ReactElement,
  {
    initialEntries = ['/'],
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
      id: 'user-123',
      email: 'juan@example.com',
      role: Role.APPLICANT,
      accountStatus: 'ACTIVE',
    },
    role: Role.APPLICANT,
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

describe('MEGS Phase 4: Applicant Interface Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default API mocks
    vi.spyOn(applicantApi, 'getProfile').mockResolvedValue({
      success: true,
      message: 'Profile retrieved',
      data: mockProfile,
    });

    vi.spyOn(applicantApi, 'getMyApplications').mockResolvedValue({
      success: true,
      message: 'Applications retrieved',
      data: mockApplications,
    });

    vi.spyOn(applicantApi, 'getOpenJobs').mockResolvedValue({
      success: true,
      message: 'Jobs retrieved',
      data: mockJobs,
    });

    vi.spyOn(applicantApi, 'getJobDetails').mockImplementation(async (id: number) => {
      const job = mockJobs.find((j) => j.id === id) || mockJobs[0];
      return {
        success: true,
        message: 'Job details retrieved',
        data: { ...job, alreadyApplied: id === 1 || id === 2 },
      };
    });
  });

  // ── 1. Dashboard Page Tests ──────────────────────────────
  describe('ApplicantDashboardPage', () => {
    it('renders welcome banner with applicant name and stats', async () => {
      renderApplicantView(<ApplicantDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Juan Dela Cruz/i)).toBeInTheDocument();
      });

      // Profile completeness widget
      expect(screen.getByTestId('profile-completion-widget')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();

      // Quick action buttons
      expect(screen.getByTestId('quick-action-jobs')).toBeInTheDocument();
      expect(screen.getByTestId('quick-action-profile')).toBeInTheDocument();
      expect(screen.getByTestId('quick-action-applications')).toBeInTheDocument();

      // Stat cards
      expect(screen.getByTestId('application-stats')).toBeInTheDocument();
      expect(screen.getByText('Active Submissions')).toBeInTheDocument();

      // Recent applications item
      expect(screen.getByTestId('dashboard-app-item-10')).toBeInTheDocument();

      // Available open jobs
      expect(screen.getByTestId('dashboard-job-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-job-card-2')).toBeInTheDocument();
    });

    it('renders missing profile checklist when profile is incomplete', async () => {
      const incompleteProfile: ApplicantProfile = {
        ...mockProfile,
        resumeUrl: null,
        hasConsentedToAi: false,
        workExperiences: [],
      };

      vi.spyOn(applicantApi, 'getProfile').mockResolvedValueOnce({
        success: true,
        message: 'Profile retrieved',
        data: incompleteProfile,
      });

      renderApplicantView(<ApplicantDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Missing sections to complete your profile/i)).toBeInTheDocument();
      });

      expect(screen.getByText('PDF Resume Attached')).toBeInTheDocument();
      expect(screen.getByText('AI Matching Consent')).toBeInTheDocument();
      expect(screen.getByText('Work Experience')).toBeInTheDocument();
    });
  });

  // ── 2. Profile Page & Subcomponents Tests ─────────────────
  describe('ApplicantProfilePage & Tabs', () => {
    it('renders all tab triggers and allows switching active tabs', async () => {
      renderApplicantView(<ApplicantProfilePage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Personal Details/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /Resume & AI Consent/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Work Experience/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Education/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Skills/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Certifications/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /References/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Compliance Documents/i })).toBeInTheDocument();

      // Switch to Resume tab
      fireEvent.click(screen.getByRole('tab', { name: /Resume & AI Consent/i }));
      expect(screen.getByTestId('resume-section')).toBeInTheDocument();

      // Switch to Work Experience tab
      fireEvent.click(screen.getByRole('tab', { name: /Work Experience/i }));
      expect(screen.getByTestId('work-experience-section')).toBeInTheDocument();

      // Switch to Skills tab
      fireEvent.click(screen.getByRole('tab', { name: /Skills/i }));
      expect(screen.getByTestId('skills-section')).toBeInTheDocument();
    });

    it('submits personal profile updates via upsertProfile', async () => {
      const upsertSpy = vi.spyOn(applicantApi, 'upsertProfile').mockResolvedValueOnce({
        success: true,
        message: 'Profile updated',
        data: mockProfile,
      });

      renderApplicantView(<ApplicantProfilePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
      });

      const firstNameInput = screen.getByLabelText(/First Name/i);
      fireEvent.change(firstNameInput, { target: { value: 'Juan Carlos' } });

      const saveBtn = screen.getByRole('button', { name: /Save Profile/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(upsertSpy).toHaveBeenCalled();
      });
    });

    it('toggles AI consent in ResumeSection', async () => {
      const consentSpy = vi.spyOn(applicantApi, 'setAiConsent').mockResolvedValueOnce({
        success: true,
        message: 'AI consent updated',
        data: { hasConsentedToAi: false },
      });

      renderApplicantView(<ApplicantProfilePage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Resume & AI Consent/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: /Resume & AI Consent/i }));

      const toggle = screen.getByTestId('ai-consent-toggle');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(consentSpy).toHaveBeenCalledWith(false);
      });
    });

    it('allows adding and deleting work experience entries', async () => {
      const addExpSpy = vi.spyOn(applicantApi, 'addWorkExperience').mockResolvedValueOnce({
        success: true,
        message: 'Experience added',
        data: {
          id: 102,
          applicantProfileId: 1,
          company: 'Ayala Land',
          roleTitle: 'Operations Associate',
          startDate: '2021-01-01',
          isCurrent: false,
        },
      });

      const deleteExpSpy = vi.spyOn(applicantApi, 'deleteWorkExperience').mockResolvedValueOnce({
        success: true,
        message: 'Experience deleted',
        data: null,
      });

      renderApplicantView(<ApplicantProfilePage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Work Experience/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('tab', { name: /Work Experience/i }));

      // Add Experience Modal
      const addBtn = screen.getByTestId('add-experience-btn');
      fireEvent.click(addBtn);

      expect(screen.getByTestId('experience-form')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Company \/ Employer Name/i), {
        target: { value: 'Ayala Land' },
      });
      fireEvent.change(screen.getByLabelText(/Job Title \/ Role/i), {
        target: { value: 'Operations Associate' },
      });
      fireEvent.change(screen.getByLabelText(/Start Date/i), {
        target: { value: '2021-01-01' },
      });

      const saveModalBtn = screen.getByRole('button', { name: /Save Experience/i });
      fireEvent.click(saveModalBtn);

      await waitFor(() => {
        expect(addExpSpy).toHaveBeenCalled();
      });

      // Delete existing experience
      const deleteBtn = screen.getByTestId('delete-experience-101');
      fireEvent.click(deleteBtn);

      // Confirm Dialog
      const dialog = screen.getByTestId('confirm-dialog');
      expect(dialog).toBeInTheDocument();
      const confirmDeleteBtn = dialog.querySelector('button.bg-rose-600') as HTMLButtonElement;
      expect(confirmDeleteBtn).not.toBeNull();
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(deleteExpSpy).toHaveBeenCalledWith(101);
      });
    });

    it('allows adding and removing skills in SkillsSection', async () => {
      const updateSkillsSpy = vi.spyOn(applicantApi, 'updateSkills').mockResolvedValueOnce({
        success: true,
        message: 'Skills updated',
        data: ['Project Management', 'Logistics', 'Quality Assurance', 'Customer Service'],
      });

      renderApplicantView(<ApplicantProfilePage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Skills/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('tab', { name: /Skills/i }));

      expect(screen.getByTestId('skills-section')).toBeInTheDocument();
      expect(screen.getByText('Project Management')).toBeInTheDocument();

      // Add skill via suggestion button
      const customerServiceBtn = screen.getByRole('button', { name: /Customer Service/i });
      fireEvent.click(customerServiceBtn);

      await waitFor(() => {
        expect(updateSkillsSpy).toHaveBeenCalledWith(
          expect.arrayContaining(['Customer Service'])
        );
      });

      // Remove skill
      const removeBtn = screen.getByLabelText(/Remove Logistics/i);
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(updateSkillsSpy).toHaveBeenCalled();
      });
    });
  });

  // ── 3. Jobs Page & Job Detail Page Tests ──────────────────
  describe('ApplicantJobsPage & JobDetailPage', () => {
    it('renders open jobs list and filters by search keyword', async () => {
      renderApplicantView(<ApplicantJobsPage />);

      await waitFor(() => {
        expect(screen.getByText('Warehouse Operations Lead')).toBeInTheDocument();
        expect(screen.getByText('Customer Relations Associate')).toBeInTheDocument();
      });

      // Search filtering
      const searchInput = screen.getByTestId('job-search-input');
      fireEvent.change(searchInput, { target: { value: 'Warehouse' } });

      expect(screen.getByText('Warehouse Operations Lead')).toBeInTheDocument();
      expect(screen.queryByText('Customer Relations Associate')).toBeNull();
    });

    it('renders JobDetailPage and submits application via modal', async () => {
      const applySpy = vi.spyOn(applicantApi, 'applyToJob').mockResolvedValueOnce({
        success: true,
        message: 'Application submitted',
        data: mockApplications[0],
      });

      renderApplicantView(
        <Routes>
          <Route path="/app/jobs/:id" element={<ApplicantJobDetailPage />} />
          <Route path="/app/applications" element={<div>Applications Page Route</div>} />
        </Routes>,
        { initialEntries: ['/app/jobs/3'] }
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Junior QA Specialist' })).toBeInTheDocument();
      });

      expect(screen.getByText(/Job Description & Responsibilities/i)).toBeInTheDocument();
      expect(screen.getByText(/Qualifications & Requirements/i)).toBeInTheDocument();

      // Open apply modal
      const applyBtn = screen.getByTestId('apply-for-job-btn');
      fireEvent.click(applyBtn);

      expect(screen.getByTestId('apply-job-form')).toBeInTheDocument();

      // Select submit application
      const submitBtn = screen.getByTestId('submit-application-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(applySpy).toHaveBeenCalledWith(3, undefined);
      });
    });

    it('shows already applied banner when applicant previously submitted', async () => {
      renderApplicantView(
        <Routes>
          <Route path="/app/jobs/:id" element={<ApplicantJobDetailPage />} />
        </Routes>,
        { initialEntries: ['/app/jobs/1'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('already-applied-banner')).toBeInTheDocument();
      });

      expect(screen.getByText(/You submitted an application for this role/i)).toBeInTheDocument();
      expect(screen.queryByTestId('apply-for-job-btn')).toBeNull();
    });
  });

  // ── 4. Applications Page & Detail Page Tests ───────────────
  describe('ApplicantApplicationsPage & ApplicationDetailPage', () => {
    it('renders applications list and filters by status tabs', async () => {
      renderApplicantView(<ApplicantApplicationsPage />);

      await waitFor(() => {
        expect(screen.getByText('Warehouse Operations Lead')).toBeInTheDocument();
        expect(screen.getByText('Customer Relations Associate')).toBeInTheDocument();
      });

      // Filter by Hired tab
      const hiredTab = screen.getByRole('button', { name: /Hired \/ Placed/i });
      fireEvent.click(hiredTab);

      // Customer Relations is in COMPLIANCE status (mapped to HIRED tab)
      expect(screen.getByText('Customer Relations Associate')).toBeInTheDocument();
    });

    it('renders ApplicationDetailPage with PipelineIndicator and stage guidance', async () => {
      renderApplicantView(
        <Routes>
          <Route path="/app/applications/:id" element={<ApplicantApplicationDetailPage />} />
        </Routes>,
        { initialEntries: ['/app/applications/10'] }
      );

      await waitFor(() => {
        expect(screen.getByTestId('applicant-application-detail-page')).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: 'Warehouse Operations Lead' })).toBeInTheDocument();
      expect(screen.getByTestId('pipeline-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('stage-guidance-banner')).toBeInTheDocument();
      expect(screen.getByText(/Initial Screening Stage/i)).toBeInTheDocument();

      // Interview & compliance cards
      expect(screen.getByTestId('interview-details-card')).toBeInTheDocument();
      expect(screen.getByTestId('compliance-checklist-card')).toBeInTheDocument();
      expect(screen.getByTestId('download-submitted-resume')).toBeInTheDocument();
    });
  });
});
