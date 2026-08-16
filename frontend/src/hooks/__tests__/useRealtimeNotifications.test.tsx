import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useRealtimeNotifications } from "../useRealtimeNotifications";

vi.mock("../useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "candidate@megs.ph", role: "APPLICANT" },
    isAuthenticated: true,
  }),
}));

vi.mock("../../lib/api/notification.api", () => ({
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ count: 3 }),
    getNotifications: vi.fn().mockResolvedValue([
      {
        id: 1,
        title: "Interview Scheduled",
        message: "Your interview with HR has been confirmed for tomorrow at 10 AM.",
        isRead: false,
        createdAt: "2026-08-14T00:00:00Z",
      },
    ]),
    markAsRead: vi.fn().mockResolvedValue({ id: 1, isRead: true }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

let mockFetchEventSourceOnMessage: ((event: any) => void) | null = null;

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn((_url: string, options: any) => {
    mockFetchEventSourceOnMessage = options.onmessage;
    return Promise.resolve();
  }),
}));

describe("useRealtimeNotifications Hook Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEventSourceOnMessage = null;
    localStorage.setItem("access_token", "fake-token");
  });

  it("fetches unread count and notification list on mount", async () => {
    const { result } = renderHook(() => useRealtimeNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.unreadCount).toBeDefined();
    expect(result.current.notifications).toBeDefined();
    expect(typeof result.current.markAsRead).toBe("function");
    expect(typeof result.current.dismissToast).toBe("function");
  });

  it("receives real-time SSE notification event and populates active toasts", async () => {
    const { result } = renderHook(() => useRealtimeNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.activeToasts).toEqual([]);

    // Simulate incoming SSE event wrapped in act
    act(() => {
      if (mockFetchEventSourceOnMessage) {
        mockFetchEventSourceOnMessage({
          data: JSON.stringify({
            id: 101,
            title: "Endorsement Update",
            message: "Your application was endorsed to Client A.",
            createdAt: "2026-08-16T00:00:00Z",
          }),
        });
      }
    });

    expect(result.current.activeToasts.length).toBe(1);
    expect(result.current.activeToasts[0].title).toBe("Endorsement Update");
    expect(result.current.activeToasts[0].id).toBe(101);

    // Test dismiss toast
    act(() => {
      result.current.dismissToast(101);
    });
    expect(result.current.activeToasts).toEqual([]);
  });

  it("ignores CONNECTED or invalid SSE messages", async () => {
    const { result } = renderHook(() => useRealtimeNotifications(), {
      wrapper: createWrapper(),
    });

    act(() => {
      if (mockFetchEventSourceOnMessage) {
        mockFetchEventSourceOnMessage({
          data: JSON.stringify({ type: "CONNECTED" }),
        });
        mockFetchEventSourceOnMessage({
          data: "invalid json string",
        });
      }
    });

    expect(result.current.activeToasts).toEqual([]);
  });
});

