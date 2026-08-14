import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminScoringPage from '../pages/admin/AdminScoringPage';
import AdminAuditLogsPage from '../pages/admin/AdminAuditLogsPage';

import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { adminApi } from '../lib/api/admin';
import {
  Role,
  CandidateScoringDimension,
  CandidateScoringConfigurationScope,
  CandidateScoringConfigurationStatus,
} from '../lib/types/enums';
import type {
  User,
  CandidateScoringConfiguration,
  ScoringQualityMetrics,
  RevalidationStatus,
  AuditLog,
} from '../lib/types/api';

// ── Mock Fixtures ──────────────────────────────────────────

const mockUsers: User[] = [
  {
    id: 'admin-1',
    email: 'admin@megs-recruitment.com',
    role: Role.ADMINISTRATOR,
    isActive: true,
    accountStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    firstName: 'Super',
    lastName: 'Admin',
  },
  {
    id: 'ta-1',
    email: 'recruiter.jane@megs-recruitment.com',
    role: Role.TALENT_ACQUISITION,
    isActive: true,
    accountStatus: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
    firstName: 'Jane',
    lastName: 'Recruiter',
  },
  {
    id: 'ta-pending',
    email: 'new.staff@megs-recruitment.com',
    role: Role.TALENT_ACQUISITION,
    isActive: false,
    accountStatus: 'PENDING_SETUP',
    mustChangePassword: true,
    invitedAt: '2026-03-01T00:00:00Z',
    firstName: 'New',
    lastName: 'Staff',
  },
  {
    id: 'app-1',
    email: 'juan.applicant@gmail.com',
    role: Role.APPLICANT,
    isActive: true,
    accountStatus: 'ACTIVE',
    createdAt: '2026-04-01T00:00:00Z',
    applicantProfile: {
      firstName: 'Juan',
      lastName: 'Dela Cruz',
    },
  },
];

const mockActiveConfig: CandidateScoringConfiguration = {
  id: 1,
  version: 1,
  revision: 0,
  scope: CandidateScoringConfigurationScope.GLOBAL,
  status: CandidateScoringConfigurationStatus.ACTIVE,
  activatedAt: '2026-08-01T00:00:00Z',
  activatedById: 'admin@megs-recruitment.com',
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

const mockHistoryConfigs: CandidateScoringConfiguration[] = [
  mockActiveConfig,
  {
    id: 2,
    version: 0,
    revision: 9,
    scope: CandidateScoringConfigurationScope.GLOBAL,
    status: CandidateScoringConfigurationStatus.SUPERSEDED,
    activatedAt: '2026-07-01T00:00:00Z',
    supersededAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-07-01T00:00:00Z',
    knnSettings: {
      defaultK: 5,
      maximumK: 15,
      minimumSimilarity: 0.65,
    },
    weights: [
      { id: 6, configurationId: 2, dimension: CandidateScoringDimension.SKILLS, weight: 35 },
      { id: 7, configurationId: 2, dimension: CandidateScoringDimension.EXPERIENCE, weight: 30 },
      { id: 8, configurationId: 2, dimension: CandidateScoringDimension.LOCATION, weight: 15 },
      { id: 9, configurationId: 2, dimension: CandidateScoringDimension.COMPLIANCE, weight: 10 },
      { id: 10, configurationId: 2, dimension: CandidateScoringDimension.EDUCATION_CERTIFICATIONS, weight: 10 },
    ],
  },
];

const mockRevalidationStatus: RevalidationStatus = {
  totalTasks: 120,
  pendingTasks: 15,
  processingTasks: 5,
  completedTasks: 100,
  failedTasks: 0,
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

const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    userId: 'admin-1',
    user: { id: 'admin-1', email: 'admin@megs-recruitment.com', role: Role.ADMINISTRATOR },
    action: 'INVITED_TA',
    entity: 'User',
    entityId: 2,
    details: 'Invited new TA recruiter recruiter.jane@megs-recruitment.com',
    createdAt: '2026-08-14T08:30:00Z',
  },
  {
    id: 2,
    userId: 'admin-1',
    user: { id: 'admin-1', email: 'admin@megs-recruitment.com', role: Role.ADMINISTRATOR },
    action: 'CONFIG_UPDATE',
    entity: 'ScoringConfiguration',
    entityId: 1,
    details: { version: 1, revision: 0, weights: { SKILLS: 40, EXPERIENCE: 25 } },
    createdAt: '2026-08-14T07:15:00Z',
  },
  {
    id: 3,
    userId: 'admin-1',
    user: { id: 'admin-1', email: 'admin@megs-recruitment.com', role: Role.ADMINISTRATOR },
    action: 'STATUS_CHANGE',
    entity: 'Application',
    entityId: 88,
    details: 'Transitioned candidate application to CLIENT_ENDORSEMENT',
    createdAt: '2026-08-14T06:00:00Z',
  },
  {
    id: 4,
    userId: 'admin-1',
    user: { id: 'admin-1', email: 'admin@megs-recruitment.com', role: Role.ADMINISTRATOR },
    action: 'LOGIN',
    entity: 'User',
    entityId: 1,
    details: 'Admin user login successful from 127.0.0.1',
    createdAt: '2026-08-14T05:00:00Z',
  },
];

// ── Test Wrapper Setup ─────────────────────────────────────

const mockAdminUser: User = {
  id: 'admin-1',
  email: 'admin@megs-recruitment.com',
  role: Role.ADMINISTRATOR,
  accountStatus: 'ACTIVE',
  isActive: true,
};

const mockAuthContextValue: AuthContextType = {
  user: mockAdminUser,
  session: null,
  role: Role.ADMINISTRATOR,
  isAuthenticated: true,
  isLoading: false,
  mustChangePassword: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
  setSession: vi.fn(),
};

function renderWithProviders(_ui?: React.ReactElement, { route = '/admin/dashboard' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContextValue}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/scoring" element={<AdminScoringPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

// ── Test Suites ────────────────────────────────────────────

describe('Phase 7: Administrator Interface Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default API mocks
    vi.spyOn(adminApi, 'listUsers').mockResolvedValue({
      success: true,
      message: 'Users retrieved',
      data: mockUsers,
    });

    vi.spyOn(adminApi, 'getActiveScoringConfiguration').mockResolvedValue({
      success: true,
      message: 'Active scoring configuration retrieved',
      data: mockActiveConfig,
    });

    vi.spyOn(adminApi, 'getConfigurationHistory').mockResolvedValue({
      success: true,
      message: 'Scoring configuration history retrieved',
      data: mockHistoryConfigs,
    });

    vi.spyOn(adminApi, 'listScoringConfigurations').mockResolvedValue({
      success: true,
      message: 'Scoring configuration history retrieved',
      data: mockHistoryConfigs,
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

    vi.spyOn(adminApi, 'inviteUser').mockResolvedValue({
      success: true,
      message: 'Talent Acquisition invitation sent successfully',
      data: {
        user: {
          id: 'ta-new',
          email: 'invited@megs.ph',
          role: Role.TALENT_ACQUISITION,
          accountStatus: 'INVITED',
        },
        invitationLink: 'https://megs.ph/setup-account?token=test-token',
      },
    });

    vi.spyOn(adminApi, 'toggleUserStatus').mockResolvedValue({
      success: true,
      message: 'User status updated',
      data: {
        id: 'ta-1',
        email: 'recruiter.jane@megs-recruitment.com',
        role: Role.TALENT_ACQUISITION,
        accountStatus: 'DEACTIVATED',
        isActive: false,
      },
    });

    vi.spyOn(adminApi, 'resendInvite').mockResolvedValue({
      success: true,
      message: 'Invitation resent successfully',
      data: { success: true, message: 'Invitation resent' },
    });

    vi.spyOn(adminApi, 'createScoringConfiguration').mockResolvedValue({
      success: true,
      message: 'Configuration activated',
      data: {
        ...mockActiveConfig,
        revision: 1,
      },
    });

    vi.spyOn(adminApi, 'restoreDefaults').mockResolvedValue({
      success: true,
      message: 'Defaults restored',
      data: mockActiveConfig,
    });

    vi.spyOn(adminApi, 'triggerRevalidation').mockResolvedValue({
      success: true,
      message: 'Score revalidation queued across active pipeline',
      data: { message: 'Revalidation queued', queued: 120 },
    });
  });

  // ────────────────────────────────────────────────────────
  // 1. AdminDashboardPage
  // ────────────────────────────────────────────────────────
  describe('1. AdminDashboardPage', () => {
    it('renders metrics cards, system health monitor, quick navigation, and recent audit table', async () => {
      renderWithProviders(<AdminDashboardPage />, { route: '/admin/dashboard' });

      // Check header
      expect(await screen.findByText('System Administration Console')).toBeInTheDocument();

      // Check 4 metric cards
      expect(screen.getByTestId('stat-total-users')).toHaveTextContent('4');
      expect(screen.getByTestId('stat-ta-staff')).toHaveTextContent('2');
      expect(screen.getByTestId('stat-scoring-version')).toHaveTextContent('v1.0');
      expect(screen.getByTestId('stat-audit-events')).toBeInTheDocument();

      // Check System Health Card
      expect(screen.getByTestId('system-health-card')).toBeInTheDocument();
      expect(screen.getByText('All Services Operational')).toBeInTheDocument();
      expect(screen.getByText('Postgres Database')).toBeInTheDocument();
      expect(screen.getByText('Supabase Auth')).toBeInTheDocument();
      expect(screen.getByText('Gemini AI Matcher')).toBeInTheDocument();
      expect(screen.getByText('Score Revalidation')).toBeInTheDocument();

      // Check Shortcuts
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Candidate Scoring Weights')).toBeInTheDocument();
      expect(screen.getByText('Audit Trail')).toBeInTheDocument();

      // Check Recent Audit Activity table
      expect(screen.getByTestId('recent-audit-table')).toBeInTheDocument();
      expect(screen.getByText('INVITED_TA')).toBeInTheDocument();
      expect(screen.getByText('CONFIG_UPDATE')).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────
  // 2. AdminUsersPage
  // ────────────────────────────────────────────────────────
  describe('2. AdminUsersPage', () => {
    it('renders users list and filters by role tab, status select, and keyword search', async () => {
      renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });

      expect(await screen.findByText('User & Access Control Management')).toBeInTheDocument();

      // Verify all users are rendered initially
      expect(screen.getByText('admin@megs-recruitment.com')).toBeInTheDocument();
      expect(screen.getByText('recruiter.jane@megs-recruitment.com')).toBeInTheDocument();
      expect(screen.getByText('new.staff@megs-recruitment.com')).toBeInTheDocument();
      expect(screen.getByText('juan.applicant@gmail.com')).toBeInTheDocument();

      // Filter by Talent Acquisition role tab
      const taTab = screen.getByTestId('role-tab-talent_acquisition');
      fireEvent.click(taTab);

      // Now only TA recruiters should be visible
      expect(screen.getByText('recruiter.jane@megs-recruitment.com')).toBeInTheDocument();
      expect(screen.getByText('new.staff@megs-recruitment.com')).toBeInTheDocument();
      expect(screen.queryByText('juan.applicant@gmail.com')).not.toBeInTheDocument();
      expect(screen.queryByText('admin@megs-recruitment.com')).not.toBeInTheDocument();

      // Reset to All Users
      const allTab = screen.getByTestId('role-tab-all');
      fireEvent.click(allTab);
      expect(screen.getByText('juan.applicant@gmail.com')).toBeInTheDocument();

      // Filter by Status dropdown
      const statusSelect = screen.getByTestId('status-filter-select');
      fireEvent.change(statusSelect, { target: { value: 'PENDING_SETUP' } });

      expect(screen.getByText('new.staff@megs-recruitment.com')).toBeInTheDocument();
      expect(screen.queryByText('recruiter.jane@megs-recruitment.com')).not.toBeInTheDocument();

      // Reset Status
      fireEvent.change(statusSelect, { target: { value: 'ALL' } });

      // Search by keyword
      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'Juan' } });
      expect(screen.getByText('juan.applicant@gmail.com')).toBeInTheDocument();
      expect(screen.queryByText('admin@megs-recruitment.com')).not.toBeInTheDocument();
    });

    it('opens Invite TA Staff modal, validates inputs, and submits invitation', async () => {
      renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });

      expect(await screen.findByText('User & Access Control Management')).toBeInTheDocument();

      const inviteButton = screen.getByTestId('invite-ta-button');
      fireEvent.click(inviteButton);

      // Modal appears
      expect(screen.getByTestId('invite-ta-modal')).toBeInTheDocument();
      expect(screen.getByText('Invite Talent Acquisition Staff')).toBeInTheDocument();

      // Fill in modal form
      const emailInput = screen.getByTestId('invite-email-input');
      const firstNameInput = screen.getByTestId('invite-firstname-input');
      const lastNameInput = screen.getByTestId('invite-lastname-input');

      fireEvent.change(emailInput, { target: { value: 'maria.recruiter@megs.ph' } });
      fireEvent.change(firstNameInput, { target: { value: 'Maria' } });
      fireEvent.change(lastNameInput, { target: { value: 'Santos' } });

      const submitButton = screen.getByTestId('invite-submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(adminApi.inviteUser).toHaveBeenCalledWith({
          email: 'maria.recruiter@megs.ph',
          firstName: 'Maria',
          lastName: 'Santos',
          role: Role.TALENT_ACQUISITION,
        });
      });
    });

    it('triggers deactivate toggle with ConfirmDialog and resend invite for pending users', async () => {
      renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });

      expect(await screen.findByText('User & Access Control Management')).toBeInTheDocument();

      // 1. Resend Invite test
      const resendBtn = screen.getByTestId('resend-invite-btn');
      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(adminApi.resendInvite).toHaveBeenCalledWith('ta-pending');
      });

      // 2. Deactivate toggle test
      const toggleButtons = screen.getAllByTestId('toggle-status-btn');
      // Click toggle on the active TA user
      fireEvent.click(toggleButtons[0]);

      // ConfirmDialog should open
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('Deactivate User Account')).toBeInTheDocument();

      // Confirm action
      const confirmButton = within(screen.getByTestId('confirm-dialog')).getByText('Deactivate Account');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(adminApi.toggleUserStatus).toHaveBeenCalled();
      });
    });
  });

  // ────────────────────────────────────────────────────────
  // 3. AdminScoringPage
  // ────────────────────────────────────────────────────────
  describe('3. AdminScoringPage', () => {
    it('displays active configuration version, scope, weights, and metrics', async () => {
      renderWithProviders(<AdminScoringPage />, { route: '/admin/scoring' });

      expect(await screen.findByText('Candidate Scoring Configuration')).toBeInTheDocument();

      // Check Active Config Card
      expect(screen.getByTestId('active-config-card')).toBeInTheDocument();
      expect(screen.getByText(/Active Configuration Version v1\.0/i)).toBeInTheDocument();
      expect(screen.getByText('GLOBAL SCOPE')).toBeInTheDocument();

      // Check Weights Sum Indicator
      const sumIndicator = screen.getByTestId('weights-sum-indicator');
      expect(sumIndicator).toHaveTextContent('Weights Balanced: 100%');

      // Check Revalidation status card
      expect(screen.getByTestId('revalidation-status-card')).toBeInTheDocument();
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();

      // Check Scoring Quality Metrics
      expect(screen.getByTestId('quality-metrics-card')).toBeInTheDocument();
      expect(screen.getByText('Total Calculations')).toBeInTheDocument();
      expect(screen.getByText('Average Fit Score')).toBeInTheDocument();

      // Check Version History List
      expect(screen.getByTestId('config-history-list')).toBeInTheDocument();
      expect(screen.getByText('Version 1 (Revision 0)')).toBeInTheDocument();
      expect(screen.getByText('Version 0 (Revision 9)')).toBeInTheDocument();
    });

    it('validates 100% weight sum and blocks saving when unbalanced', async () => {
      renderWithProviders(<AdminScoringPage />, { route: '/admin/scoring' });

      expect(await screen.findByText('Candidate Scoring Configuration')).toBeInTheDocument();

      // Change Skills Match Weight from 40 to 60 (Sum becomes 120%)
      const skillsInput = screen.getByTestId('weight-input-skills');
      fireEvent.change(skillsInput, { target: { value: '60' } });

      const sumIndicator = screen.getByTestId('weights-sum-indicator');
      expect(sumIndicator).toHaveTextContent('Sum: 120% (Must equal 100%)');

      // Save button should be disabled
      const saveButton = screen.getByTestId('save-config-button');
      expect(saveButton).toBeDisabled();

      // Adjust Experience Weight from 25 to 5 (Sum becomes 60 + 5 + 15 + 10 + 10 = 100%)
      const expInput = screen.getByTestId('weight-input-experience');
      fireEvent.change(expInput, { target: { value: '5' } });

      expect(sumIndicator).toHaveTextContent('Weights Balanced: 100%');
      expect(saveButton).not.toBeDisabled();

      // Click save
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(adminApi.createScoringConfiguration).toHaveBeenCalled();
      });
    });

    it('triggers batch score revalidation and restore defaults dialog', async () => {
      renderWithProviders(<AdminScoringPage />, { route: '/admin/scoring' });

      expect(await screen.findByText('Candidate Scoring Configuration')).toBeInTheDocument();

      // Trigger revalidation
      const revalidationBtn = screen.getByTestId('trigger-revalidation-button');
      fireEvent.click(revalidationBtn);

      await waitFor(() => {
        expect(adminApi.triggerRevalidation).toHaveBeenCalled();
      });

      // Restore defaults
      const restoreBtn = screen.getByTestId('restore-defaults-button');
      fireEvent.click(restoreBtn);

      // Confirm dialog opens
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('Restore Default Scoring Configuration')).toBeInTheDocument();

      const confirmRestore = within(screen.getByTestId('confirm-dialog')).getByText('Restore Defaults');
      fireEvent.click(confirmRestore);

      await waitFor(() => {
        expect(adminApi.restoreDefaults).toHaveBeenCalled();
      });
    });
  });

  // ────────────────────────────────────────────────────────
  // 4. AdminAuditLogsPage
  // ────────────────────────────────────────────────────────
  describe('4. AdminAuditLogsPage', () => {
    it('renders audit logs table, filters by entity and action, and opens raw JSON modal', async () => {
      renderWithProviders(<AdminAuditLogsPage />, { route: '/admin/audit-logs' });

      expect(await screen.findByText('Immutable Audit Trail')).toBeInTheDocument();

      // Verify audit logs rendered in table
      expect(screen.getByText('INVITED_TA')).toBeInTheDocument();
      expect(screen.getByText('CONFIG_UPDATE')).toBeInTheDocument();
      expect(screen.getByText('STATUS_CHANGE')).toBeInTheDocument();
      expect(screen.getByText('LOGIN')).toBeInTheDocument();

      // Filter by Entity (e.g. SCORING_CONFIG)
      const entityFilter = screen.getByTestId('audit-entity-filter');
      fireEvent.change(entityFilter, { target: { value: 'SCORING_CONFIG' } });

      expect(screen.getByText('CONFIG_UPDATE')).toBeInTheDocument();
      expect(screen.queryByText('INVITED_TA')).not.toBeInTheDocument();

      // Reset Entity filter
      fireEvent.change(entityFilter, { target: { value: 'ALL' } });
      expect(screen.getByText('INVITED_TA')).toBeInTheDocument();

      // Filter by Action (e.g. INVITED_TA)
      const actionFilter = screen.getByTestId('audit-action-filter');
      fireEvent.change(actionFilter, { target: { value: 'INVITED_TA' } });

      expect(screen.getByText('INVITED_TA')).toBeInTheDocument();
      expect(screen.queryByText('STATUS_CHANGE')).not.toBeInTheDocument();

      // Reset Action filter
      fireEvent.change(actionFilter, { target: { value: 'ALL' } });

      // Open JSON Payload Modal
      const viewDetailsButtons = screen.getAllByTestId('audit-view-details-btn');
      fireEvent.click(viewDetailsButtons[0]);

      // Modal appears
      expect(screen.getByTestId('audit-details-modal')).toBeInTheDocument();
      expect(screen.getByText('Raw JSON Event Record')).toBeInTheDocument();
      expect(screen.getByTestId('audit-json-payload')).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByTestId('close-audit-details-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('audit-details-modal')).not.toBeInTheDocument();
    });
  });
});
