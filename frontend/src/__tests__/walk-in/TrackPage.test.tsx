import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  return render(
    <QueryClientProvider client={queryClient}>
      <TrackPage />
    </QueryClientProvider>,
  );
}

describe("TrackPage (/t/:code)", () => {
  beforeEach(() => {
    getTracking.mockReset();
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
