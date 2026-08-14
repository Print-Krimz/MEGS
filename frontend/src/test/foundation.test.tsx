import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StatusBadge } from '../components/common/StatusBadge';
import { PipelineIndicator } from '../components/common/PipelineIndicator';
import { ScoreBadge } from '../components/common/ScoreBadge';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { AuthProvider } from '../providers/AuthProvider';
import { useAuth } from '../hooks/useAuth';
import { ApplicationStatus, JobStatus, DeploymentStatus } from '../lib/types/enums';

describe('MEGS Phase 2 Foundation Layer Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── 1. StatusBadge Tests ────────────────────
  describe('StatusBadge', () => {
    it('renders all standard ApplicationStatus correctly', () => {
      const statuses: ApplicationStatus[] = [
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.PARSING,
        ApplicationStatus.REVIEW,
        ApplicationStatus.NEEDS_ATTENTION,
        ApplicationStatus.MATCHED,
        ApplicationStatus.TALENT_POOL,
        ApplicationStatus.INITIAL_SCREENING,
        ApplicationStatus.CLIENT_ENDORSEMENT,
        ApplicationStatus.FINAL_INTERVIEW,
        ApplicationStatus.HIRED,
        ApplicationStatus.ONBOARDING,
        ApplicationStatus.COMPLIANCE,
        ApplicationStatus.DEPLOYED,
        ApplicationStatus.BACKOUT,
        ApplicationStatus.ARCHIVED,
      ];

      statuses.forEach((status) => {
        const { unmount } = render(<StatusBadge status={status} />);
        const badge = screen.getByTestId('status-badge');
        expect(badge).toBeInTheDocument();
        unmount();
      });
    });

    it('renders JobStatus correctly', () => {
      const { unmount: unmount1 } = render(<StatusBadge status={JobStatus.OPEN} />);
      expect(screen.getByText('Open')).toBeInTheDocument();
      unmount1();

      const { unmount: unmount2 } = render(<StatusBadge status={JobStatus.DRAFT} />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
      unmount2();

      const { unmount: unmount3 } = render(<StatusBadge status={JobStatus.CLOSED} />);
      expect(screen.getByText('Closed')).toBeInTheDocument();
      unmount3();
    });

    it('renders DeploymentStatus correctly', () => {
      render(<StatusBadge status={DeploymentStatus.PENDING_ORIENTATION} />);
      expect(screen.getByText('Pending Orientation')).toBeInTheDocument();
    });

    it('supports customLabel and showDot=false', () => {
      render(<StatusBadge status={ApplicationStatus.SUBMITTED} customLabel="Application Received" showDot={false} />);
      expect(screen.getByText('Application Received')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge').querySelector('.rounded-full.flex-shrink-0')).toBeNull();
    });
  });

  // ── 2. PipelineIndicator Tests ──────────────
  describe('PipelineIndicator', () => {
    it('renders canonical stages and highlights the current stage', () => {
      render(<PipelineIndicator currentStatus={ApplicationStatus.INITIAL_SCREENING} />);
      expect(screen.getByTestId('pipeline-indicator')).toBeInTheDocument();

      // Check screening step
      const screeningStep = screen.getByTestId('pipeline-step-initial_screening');
      expect(screeningStep).toBeInTheDocument();
      expect(screeningStep).toHaveTextContent('Screening');
      expect(screeningStep).toHaveTextContent('Current');

      // Submitted step should be passed
      const submittedStep = screen.getByTestId('pipeline-step-submitted');
      expect(submittedStep).toHaveTextContent('Submitted');
    });

    it('renders off-ramp alert when status is TALENT_POOL', () => {
      render(<PipelineIndicator currentStatus={ApplicationStatus.TALENT_POOL} />);
      expect(screen.getByText(/Talent Pool/i)).toBeInTheDocument();
    });

    it('renders off-ramp alert when status is ARCHIVED', () => {
      render(<PipelineIndicator currentStatus={ApplicationStatus.ARCHIVED} />);
      expect(screen.getByText(/Archived/i)).toBeInTheDocument();
    });

    it('renders condensed variant without crashing', () => {
      render(<PipelineIndicator currentStatus={ApplicationStatus.REVIEW} variant="condensed" />);
      expect(screen.getByTestId('pipeline-indicator-condensed')).toBeInTheDocument();
    });
  });

  // ── 3. ScoreBadge Tests ────────────────────
  describe('ScoreBadge', () => {
    it('formats high scores (>= 85) with emerald styling', () => {
      render(<ScoreBadge score={92} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveTextContent('92%');
      expect(badge.className).toContain('text-emerald-700');
    });

    it('formats good scores (>= 70) with teal styling', () => {
      render(<ScoreBadge score={78} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveTextContent('78%');
      expect(badge.className).toContain('text-teal-700');
    });

    it('formats moderate scores (>= 50) with amber styling', () => {
      render(<ScoreBadge score={62} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveTextContent('62%');
      expect(badge.className).toContain('text-amber-700');
    });

    it('formats low scores (< 50) with rose styling', () => {
      render(<ScoreBadge score={35} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveTextContent('35%');
      expect(badge.className).toContain('text-rose-700');
    });

    it('handles null, undefined, or NaN as N/A', () => {
      const { unmount: u1 } = render(<ScoreBadge score={null} />);
      expect(screen.getByTestId('score-badge-na')).toHaveTextContent('N/A');
      u1();

      const { unmount: u2 } = render(<ScoreBadge score={undefined} />);
      expect(screen.getByTestId('score-badge-na')).toHaveTextContent('N/A');
      u2();

      const { unmount: u3 } = render(<ScoreBadge score={NaN} />);
      expect(screen.getByTestId('score-badge-na')).toHaveTextContent('N/A');
      u3();
    });
  });

  // ── 4. Common UI Components Tests ───────────
  describe('PageHeader, EmptyState, ErrorState, ConfirmDialog', () => {
    it('renders PageHeader with breadcrumbs and title', () => {
      render(
        <BrowserRouter>
          <PageHeader
            title="Applications Queue"
            description="Manage all candidate submissions"
            breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Applications' }]}
          />
        </BrowserRouter>
      );
      expect(screen.getByRole('heading', { name: 'Applications Queue' })).toBeInTheDocument();
      expect(screen.getByText('Manage all candidate submissions')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
    });

    it('renders EmptyState with action button', () => {
      render(
        <EmptyState
          title="No candidates found"
          description="Try modifying your search criteria."
          action={<button>Create Job</button>}
        />
      );
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No candidates found')).toBeInTheDocument();
      expect(screen.getByText('Create Job')).toBeInTheDocument();
    });

    it('renders ErrorState and triggers retry', () => {
      const retrySpy = vi.fn();
      render(
        <ErrorState
          title="Database error"
          message="Could not load records"
          onRetry={retrySpy}
        />
      );
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Database error')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryBtn);
      expect(retrySpy).toHaveBeenCalledTimes(1);
    });

    it('renders ConfirmDialog and responds to confirm/cancel', () => {
      const confirmSpy = vi.fn();
      const cancelSpy = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Archive Candidate"
          description="Are you sure you want to archive this candidate?"
          confirmText="Yes, Archive"
          variant="danger"
          onConfirm={confirmSpy}
          onCancel={cancelSpy}
        />
      );

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('Archive Candidate')).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /yes, archive/i });
      fireEvent.click(confirmBtn);
      expect(confirmSpy).toHaveBeenCalledTimes(1);

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. AuthProvider Tests ───────────────────
  describe('AuthProvider', () => {
    function TestConsumer() {
      const { isAuthenticated, isLoading, user, role } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
          <span data-testid="loading-status">{isLoading ? 'loading' : 'ready'}</span>
          <span data-testid="user-email">{user?.email ?? 'none'}</span>
          <span data-testid="user-role">{role ?? 'none'}</span>
        </div>
      );
    }

    it('exposes correct initial context state', async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
      expect(screen.getByTestId('user-role')).toHaveTextContent('none');
    });

    it('throws error when useAuth is called outside AuthProvider', () => {
      // Suppress expected console.error during throw test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestConsumer />)).toThrowError(
        'useAuth must be used within an AuthProvider'
      );
      consoleSpy.mockRestore();
    });
  });
});
