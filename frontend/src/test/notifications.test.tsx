import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NotificationBell, formatRelativeTime } from '../components/common/NotificationBell';
import { useNotificationStream } from '../hooks/useNotificationStream';
import { notificationApi, notificationsApi } from '../lib/api/notifications';
import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { Role } from '../lib/types/enums';
import type { Notification } from '../lib/types/api';

// ── Mock Sonner ─────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock EventSource ────────────────────────────────────────────────────────
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((ev: any) => any) | null = null;
  onmessage: ((ev: any) => any) | null = null;
  onerror: ((ev: any) => any) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen({} as any);
    }, 0);
  }

  emitMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({
        data: typeof data === 'string' ? data : JSON.stringify(data),
      } as MessageEvent);
    }
  }

  emitError() {
    this.readyState = 2; // CLOSED
    if (this.onerror) {
      this.onerror({} as any);
    }
  }

  close() {
    this.readyState = 2;
  }
}

// ── Mock Notification Data ──────────────────────────────────────────────────
const mockNotifications: Notification[] = [
  {
    id: 1,
    userId: 'user-123',
    title: 'Application Advanced',
    message: 'Your application for Warehouse Operations Lead moved to Initial Screening.',
    type: 'INFO',
    isRead: false,
    link: '/app/applications/10',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
  },
  {
    id: 2,
    userId: 'user-123',
    title: 'Document Approved',
    message: 'Your NBI Clearance has been verified by the Compliance team.',
    type: 'SUCCESS',
    isRead: false,
    link: '/app/profile',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: 3,
    userId: 'user-123',
    title: 'Requirement Expiring Soon',
    message: 'Please renew your Medical Exam certificate within 7 days.',
    type: 'WARNING',
    isRead: true,
    link: '/app/profile',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: 4,
    userId: 'user-123',
    title: 'Interview Rescheduled',
    message: 'Your client final interview was rescheduled by the hiring manager.',
    type: 'ERROR',
    isRead: true,
    link: null,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  },
];

// Helper to render NotificationBell with providers
function renderNotificationBell({
  isAuthenticated = true,
  unreadCount = 2,
  notifications = mockNotifications,
  initialEntries = ['/app/dashboard'],
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  }),
}: {
  isAuthenticated?: boolean;
  unreadCount?: number;
  notifications?: Notification[];
  initialEntries?: string[];
  queryClient?: QueryClient;
} = {}) {
  // Mock API responses
  vi.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue({
    success: true,
    message: 'Unread count retrieved',
    data: { unreadCount, count: unreadCount },
  });

  vi.spyOn(notificationApi, 'listNotifications').mockResolvedValue({
    success: true,
    message: 'Notifications retrieved',
    data: notifications,
  });

  vi.spyOn(notificationApi, 'markAsRead').mockImplementation(async (id: number) => {
    const notif = notifications.find((n) => n.id === id) || mockNotifications[0];
    return {
      success: true,
      message: 'Marked as read',
      data: { ...notif, isRead: true },
    };
  });

  vi.spyOn(notificationApi, 'markAllAsRead').mockResolvedValue({
    success: true,
    message: 'All notifications marked as read',
    data: { count: unreadCount },
  });

  const authValue: AuthContextType = {
    user: isAuthenticated
      ? {
          id: 'user-123',
          email: 'applicant@example.com',
          role: Role.APPLICANT,
          accountStatus: 'ACTIVE',
        }
      : null,
    role: isAuthenticated ? Role.APPLICANT : null,
    session: null,
    isAuthenticated,
    isLoading: false,
    mustChangePassword: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    setSession: vi.fn(),
  };

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="*" element={<NotificationBell />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  };
}

describe('MEGS Phase 8: Notification System & Real-Time SSE Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('megs_access_token', 'mock-jwt-token');
    vi.clearAllMocks();
    MockEventSource.instances = [];
    (window as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Unread Count Badge & Bell Trigger ──────────────────────────────────
  describe('NotificationBell - Badge & Trigger', () => {
    it('renders the bell button with accessible label and unread badge count', async () => {
      renderNotificationBell({ unreadCount: 3 });

      const badge = await screen.findByTestId('notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
      expect(badge).toHaveClass('animate-pulse');

      const bellButton = screen.getByTestId('notification-bell-btn');
      expect(bellButton).toBeInTheDocument();
      expect(bellButton).toHaveAttribute('aria-label', 'Notifications (3 unread)');
    });

    it('formats unread count over 99 as "99+"', async () => {
      renderNotificationBell({ unreadCount: 150 });

      const badge = await screen.findByTestId('notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('99+');
    });

    it('does not render badge when unread count is 0', async () => {
      renderNotificationBell({ unreadCount: 0 });

      await screen.findByTestId('notification-bell-btn');
      expect(screen.queryByTestId('notification-badge')).toBeNull();
    });

    it('renders null when user is unauthenticated', () => {
      const { container } = renderNotificationBell({ isAuthenticated: false });
      expect(container.firstChild).toBeNull();
    });
  });

  // ── 2. Interactive Dropdown Popover ───────────────────────────────────────
  describe('NotificationBell - Popover Interaction', () => {
    it('toggles dropdown popover on bell click and closes on second click', async () => {
      renderNotificationBell({ unreadCount: 2 });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();

      // Click to open
      fireEvent.click(bellButton);
      expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count-header')).toHaveTextContent('2 unread');

      // Click to close
      fireEvent.click(bellButton);
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();
    });

    it('closes popover on Escape key press', async () => {
      renderNotificationBell({ unreadCount: 2 });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);
      expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();
    });

    it('closes popover when clicking outside', async () => {
      renderNotificationBell({ unreadCount: 2 });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);
      expect(await screen.findByTestId('notification-dropdown')).toBeInTheDocument();

      // Click outside on body
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();
    });
  });

  // ── 3. Notification List Items & Type Icons ───────────────────────────────
  describe('NotificationBell - Items & Type Icons', () => {
    it('renders notification items with proper type icons, titles, messages, and unread dots', async () => {
      renderNotificationBell({ unreadCount: 2, notifications: mockNotifications });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);

      // Verify notification 1 (INFO)
      expect(await screen.findByText('Application Advanced')).toBeInTheDocument();
      expect(
        screen.getByText(/Your application for Warehouse Operations Lead moved to Initial Screening/i)
      ).toBeInTheDocument();
      expect(screen.getByTestId('icon-info')).toBeInTheDocument();

      // Verify notification 2 (SUCCESS)
      expect(screen.getByText('Document Approved')).toBeInTheDocument();
      expect(
        screen.getByText(/Your NBI Clearance has been verified by the Compliance team/i)
      ).toBeInTheDocument();
      expect(screen.getByTestId('icon-success')).toBeInTheDocument();

      // Verify notification 3 (WARNING)
      expect(screen.getByText('Requirement Expiring Soon')).toBeInTheDocument();
      expect(screen.getByTestId('icon-warning')).toBeInTheDocument();

      // Verify notification 4 (ERROR)
      expect(screen.getByText('Interview Rescheduled')).toBeInTheDocument();
      expect(screen.getByTestId('icon-error')).toBeInTheDocument();

      // Verify unread indicator dots (notifications 1 and 2 are unread)
      const unreadDots = screen.getAllByTestId('unread-dot');
      expect(unreadDots.length).toBe(2);
    });

    it('renders empty state when there are no notifications', async () => {
      renderNotificationBell({ unreadCount: 0, notifications: [] });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);

      const emptyState = await screen.findByTestId('notification-empty-state');
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
      expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    });
  });

  // ── 4. Mark As Read & Mark All As Read Actions ───────────────────────────
  describe('NotificationBell - Mark Read Workflows', () => {
    it('clicking "Mark all as read" calls markAllAsRead and updates UI', async () => {
      renderNotificationBell({ unreadCount: 2, notifications: mockNotifications });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);

      const markAllBtn = await screen.findByTestId('mark-all-read-btn');
      expect(markAllBtn).toBeInTheDocument();

      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(notificationApi.markAllAsRead).toHaveBeenCalled();
      });
    });

    it('clicking a notification item calls markAsRead(id) and closes popover', async () => {
      renderNotificationBell({ unreadCount: 2, notifications: mockNotifications });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);

      const notifItem = await screen.findByTestId('notification-item-1');
      fireEvent.click(notifItem);

      await waitFor(() => {
        expect(notificationApi.markAsRead).toHaveBeenCalledWith(1);
      });

      // Dropdown closes after click
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();
    });

    it('clicking item-level check button marks single item as read without closing dropdown', async () => {
      renderNotificationBell({ unreadCount: 2, notifications: mockNotifications });

      const bellButton = await screen.findByTestId('notification-bell-btn');
      fireEvent.click(bellButton);

      const markReadBtn = await screen.findByTestId('mark-read-btn-1');
      fireEvent.click(markReadBtn);

      await waitFor(() => {
        expect(notificationApi.markAsRead).toHaveBeenCalledWith(1);
      });

      // Dropdown remains open
      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });
  });

  // ── 5. Real-Time SSE Stream Integration ──────────────────────────────────
  describe('Real-Time SSE Stream & Toast Integration', () => {
    it('creates EventSource on mount and handles incoming notification SSE events', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });

      renderNotificationBell({ unreadCount: 1, notifications: [mockNotifications[0]], queryClient });

      await screen.findByTestId('notification-bell-btn');

      // Check that MockEventSource was instantiated
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
      const activeEs = MockEventSource.instances[0];
      expect(activeEs.url).toContain('/api/notifications/stream?token=');

      // Simulate incoming SSE message event for a SUCCESS notification
      const incomingNotification: Notification = {
        id: 99,
        userId: 'user-123',
        title: 'Application Accepted',
        message: 'Congratulations! You have been accepted for the role.',
        type: 'SUCCESS',
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      act(() => {
        activeEs.emitMessage(incomingNotification);
      });

      // Verify Sonner toast was triggered with matching type and message
      expect(toast.success).toHaveBeenCalledWith(
        'Application Accepted',
        expect.objectContaining({
          description: 'Congratulations! You have been accepted for the role.',
        })
      );
    });

    it('triggers appropriate toast method for INFO, WARNING, and ERROR types', async () => {
      renderNotificationBell({ unreadCount: 0, notifications: [] });
      await screen.findByTestId('notification-bell-btn');

      const es = MockEventSource.instances[0];

      // Test INFO
      act(() => {
        es.emitMessage({
          id: 101,
          title: 'System Notice',
          message: 'System maintenance at midnight',
          type: 'INFO',
          isRead: false,
        });
      });
      expect(toast.info).toHaveBeenCalledWith('System Notice', {
        description: 'System maintenance at midnight',
      });

      // Test WARNING
      act(() => {
        es.emitMessage({
          id: 102,
          title: 'Deadline Warning',
          message: 'Offer expires tomorrow',
          type: 'WARNING',
          isRead: false,
        });
      });
      expect(toast.warning).toHaveBeenCalledWith('Deadline Warning', {
        description: 'Offer expires tomorrow',
      });

      // Test ERROR
      act(() => {
        es.emitMessage({
          id: 103,
          title: 'Verification Failed',
          message: 'NBI document was rejected',
          type: 'ERROR',
          isRead: false,
        });
      });
      expect(toast.error).toHaveBeenCalledWith('Verification Failed', {
        description: 'NBI document was rejected',
      });
    });

    it('ignores CONNECTED and KEEP_ALIVE SSE messages without firing toasts', async () => {
      renderNotificationBell({ unreadCount: 0, notifications: [] });
      await screen.findByTestId('notification-bell-btn');

      const es = MockEventSource.instances[0];

      act(() => {
        es.emitMessage({ type: 'CONNECTED' });
        es.emitMessage({ type: 'KEEP_ALIVE' });
        es.emitMessage('keep-alive');
      });

      expect(toast.info).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('handles SSE disconnect with auto-reconnect backoff', async () => {
      vi.useFakeTimers();

      const TestStreamComponent = () => {
        useNotificationStream({ enabled: true });
        return <div>Stream Active</div>;
      };

      const queryClient = new QueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <TestStreamComponent />
        </QueryClientProvider>
      );

      const initialCount = MockEventSource.instances.length;
      expect(initialCount).toBeGreaterThanOrEqual(1);

      const es = MockEventSource.instances[initialCount - 1];

      // Simulate connection error
      act(() => {
        es.emitError();
      });

      // Fast forward backoff delay (1000ms)
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      // A new EventSource should have been created
      expect(MockEventSource.instances.length).toBeGreaterThan(initialCount);

      vi.useRealTimers();
    });
  });

  // ── 6. Relative Time Formatter Unit Tests ─────────────────────────────────
  describe('formatRelativeTime helper', () => {
    it('formats less than 45 seconds as "Just now"', () => {
      const now = new Date();
      expect(formatRelativeTime(now.toISOString())).toBe('Just now');
    });

    it('formats 1 minute as "1 min ago"', () => {
      const date = new Date(Date.now() - 65 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe('1 min ago');
    });

    it('formats multiple minutes as "N mins ago"', () => {
      const date = new Date(Date.now() - 15 * 60 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe('15 mins ago');
    });

    it('formats 1 hour as "1 hour ago"', () => {
      const date = new Date(Date.now() - 65 * 60 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe('1 hour ago');
    });

    it('formats multiple hours as "N hours ago"', () => {
      const date = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe('5 hours ago');
    });

    it('formats 1 day as "Yesterday"', () => {
      const date = new Date(Date.now() - 25 * 60 * 60 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe('Yesterday');
    });

    it('formats multiple days as "N days ago"', () => {
      const date = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe('4 days ago');
    });

    it('safely handles invalid, null, or undefined dates', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(undefined)).toBe('');
      expect(formatRelativeTime('invalid-date')).toBe('invalid-date');
    });
  });

  // ── 7. Notification API Service & Alias Tests ─────────────────────────────
  describe('notificationsApi Service & Exports', () => {
    it('exports both notificationApi and notificationsApi with matching methods', () => {
      expect(notificationsApi).toBe(notificationApi);
      expect(typeof notificationApi.listNotifications).toBe('function');
      expect(typeof notificationApi.getUnreadCount).toBe('function');
      expect(typeof notificationApi.markAsRead).toBe('function');
      expect(typeof notificationApi.markAllAsRead).toBe('function');
      expect(typeof notificationApi.createEventSource).toBe('function');
    });

    it('createEventSource returns EventSource instance with token when available', () => {
      localStorage.setItem('megs_access_token', 'test-token-xyz');
      const es = notificationApi.createEventSource();
      expect(es).not.toBeNull();
      expect((es as any).url).toContain('token=test-token-xyz');
    });

    it('createEventSource returns null when no token is present', () => {
      localStorage.removeItem('megs_access_token');
      const es = notificationApi.createEventSource('');
      expect(es).toBeNull();
    });
  });
});
