import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  search: { token: "tok-123" } as { token?: string },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ code: "WLK-2026-0042" }),
  useSearch: () => mocks.search,
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("../../lib/api/public.api", () => ({
  publicApi: {
    getTracking: vi.fn(),
  },
}));

// The live stream is faked: tests push `ready` and `changed` through the captured handlers.
const stream = vi.hoisted(() => ({ calls: [] as { url: string; opts: any }[] }));
vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: (url: string, opts: any) =>
    new Promise<void>((resolve) => {
      stream.calls.push({ url, opts });
      opts.signal?.addEventListener("abort", () => resolve());
    }),
}));
const pushEvent = (event: string) => act(() => stream.calls[stream.calls.length - 1].opts.onmessage({ event, data: "{}", id: "", retry: undefined }));

import { publicApi } from "../../lib/api/public.api";
import { ApiError } from "../../lib/api/client";
import { TrackPage } from "../../pages/public/TrackPage";

const getTracking = publicApi.getTracking as unknown as ReturnType<typeof vi.fn>;

const tracking = {
  trackingCode: "WLK-2026-0042",
  applicantName: "Juan D.",
  jobTitle: "Warehouse Associate",
  clientName: "Star Meg",
  status: "SUBMITTED",
  appliedAt: "2026-10-20T03:00:00.000Z",
  nextInterview: { type: "FINAL_INTERVIEW", scheduledAt: "2026-10-30T02:00:00.000Z" },
  venue: "Makati Branch, 2F",
  updatedAt: "2026-10-21T04:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TrackPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("TrackPage (/t/:code)", () => {
  beforeEach(() => {
    getTracking.mockReset();
    stream.calls.length = 0;
    mocks.search = { token: "tok-123" };
  });

  it("shows the bad-link copy when the API rejects the link with 404", async () => {
    getTracking.mockRejectedValue(new ApiError(404, "Not found"));

    renderPage();

    expect(
      await screen.findByText("This link no longer works. Ask your MEGS recruiter for a new slip."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Application progress" })).not.toBeInTheDocument();
  });

  it("shows the bad-link copy without calling the API when the token is missing", async () => {
    mocks.search = {};

    renderPage();

    expect(
      await screen.findByText("This link no longer works. Ask your MEGS recruiter for a new slip."),
    ).toBeInTheDocument();
    expect(getTracking).not.toHaveBeenCalled();
  });

  it("shows the pipeline, next interview and venue when the API resolves", async () => {
    getTracking.mockResolvedValue(tracking);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Warehouse Associate" })).toBeInTheDocument();
    expect(screen.getByText(/Juan D\./)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Application progress" })).toBeInTheDocument();
    const nextInterview = screen.getByRole("region", { name: "Next interview" });
    expect(within(nextInterview).getByText("Final interview")).toBeInTheDocument();
    expect(within(nextInterview).getByText("Makati Branch, 2F")).toBeInTheDocument();
    expect(screen.getByText("WLK-2026-0042")).toBeInTheDocument();
    expect(getTracking).toHaveBeenCalledWith("WLK-2026-0042", "tok-123", expect.any(Object));
  });

  it("explains that no interview is set when nextInterview is null", async () => {
    getTracking.mockResolvedValue({ ...tracking, nextInterview: null, venue: null });

    renderPage();

    expect(
      await screen.findByText("No interview is scheduled yet. Your recruiter will contact you when one is set."),
    ).toBeInTheDocument();
  });

  it("offers a retry, not the bad-link copy, when the server fails", async () => {
    getTracking.mockRejectedValue(new ApiError(500, "Server error"));

    renderPage();

    expect(await screen.findByText("Can't load this page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(
      screen.queryByText("This link no longer works. Ask your MEGS recruiter for a new slip."),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(getTracking).toHaveBeenCalled());
  });
  it("follows the recruiter's updates without a manual refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getTracking
        .mockResolvedValueOnce({ ...tracking, status: "INITIAL_SCREENING" })
        .mockResolvedValue({ ...tracking, status: "FINAL_INTERVIEW", nextInterview: null, venue: null });

      renderPage();
      await screen.findByRole("heading", { name: "Warehouse Associate" });
      expect(getTracking).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(21_000);

      await waitFor(() => expect(getTracking).toHaveBeenCalledTimes(2));
      expect(
        await screen.findByText("No interview is scheduled yet. Your recruiter will contact you when one is set."),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the stream with the tracking header and refetches on a change without waiting for the timer", async () => {
    getTracking
      .mockResolvedValueOnce({ ...tracking, status: "INITIAL_SCREENING" })
      .mockResolvedValue({ ...tracking, status: "FINAL_INTERVIEW", nextInterview: null, venue: null });

    renderPage();
    await screen.findByRole("heading", { name: "Warehouse Associate" });
    await waitFor(() => expect(stream.calls).toHaveLength(1));
    expect(stream.calls[0].url).toContain("/api/public/track/WLK-2026-0042/stream");
    expect(stream.calls[0].url).not.toContain("tok-123");
    expect(stream.calls[0].opts.headers).toEqual({ "x-tracking-token": "tok-123" });

    pushEvent("changed");

    expect(
      await screen.findByText("No interview is scheduled yet. Your recruiter will contact you when one is set."),
    ).toBeInTheDocument();
    expect(getTracking).toHaveBeenCalledTimes(2);
  });

  it("slows the poll to 60 seconds while the stream is connected", async () => {
    getTracking.mockResolvedValue(tracking);
    const queryClient = renderPage();
    await screen.findByRole("heading", { name: "Warehouse Associate" });
    const query = queryClient.getQueryCache().find({ queryKey: ["public", "track", "WLK-2026-0042", "tok-123"] }) as any;
    expect(query.options.refetchInterval(query)).toBe(20_000);

    await waitFor(() => expect(stream.calls).toHaveLength(1));
    pushEvent("ready");

    await waitFor(() => {
      const q = queryClient.getQueryCache().find({ queryKey: ["public", "track", "WLK-2026-0042", "tok-123"] }) as any;
      expect(q.options.refetchInterval(q)).toBe(60_000);
    });
  });

  it("stops polling once the application is deployed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getTracking.mockResolvedValue({ ...tracking, status: "DEPLOYED", nextInterview: null });

      renderPage();
      await screen.findByRole("heading", { name: "Warehouse Associate" });
      await vi.advanceTimersByTimeAsync(60_000);

      expect(getTracking).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
