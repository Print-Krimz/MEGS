import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  search: { token: "tok-offer" } as { token?: string },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "7" }),
  useSearch: () => mocks.search,
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("../../lib/api/public.api", () => ({
  publicApi: {
    getOffer: vi.fn(),
    respondOffer: vi.fn(),
  },
}));

import { publicApi } from "../../lib/api/public.api";
import { ApiError } from "../../lib/api/client";
import { OfferPage } from "../../pages/public/OfferPage";

const getOffer = publicApi.getOffer as unknown as ReturnType<typeof vi.fn>;
const respondOffer = publicApi.respondOffer as unknown as ReturnType<typeof vi.fn>;

const pendingOffer = {
  invitationId: 7,
  status: "PENDING",
  applicantFirstName: "Juan",
  jobTitle: "Warehouse Associate",
  clientName: "Star Meg",
  location: "Valenzuela",
  message: null,
  expiresAt: "2026-10-30T00:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OfferPage />
    </QueryClientProvider>,
  );
}

describe("OfferPage (/offer/:id)", () => {
  beforeEach(() => {
    getOffer.mockReset();
    respondOffer.mockReset();
    mocks.search = { token: "tok-offer" };
  });

  it("does not call respondOffer when Accept is pressed; it asks for confirmation first", async () => {
    getOffer.mockResolvedValue(pendingOffer);
    respondOffer.mockResolvedValue({ status: "ACCEPTED", applicationId: 99 });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

    expect(await screen.findByRole("heading", { name: "Accept this offer?" })).toBeInTheDocument();
    expect(respondOffer).not.toHaveBeenCalled();
  });

  it("returns to the offer without responding when the confirmation is cancelled", async () => {
    getOffer.mockResolvedValue(pendingOffer);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("heading", { name: "Accept this offer?" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(respondOffer).not.toHaveBeenCalled();
  });

  it("sends ACCEPT only after the applicant confirms, then shows the done state", async () => {
    getOffer.mockResolvedValue(pendingOffer);
    respondOffer.mockResolvedValue({ status: "ACCEPTED", applicationId: 99 });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, accept" }));

    await waitFor(() => expect(respondOffer).toHaveBeenCalledTimes(1));
    expect(respondOffer).toHaveBeenCalledWith("7", { token: "tok-offer", decision: "ACCEPT", declineReason: undefined });
    expect(await screen.findByRole("heading", { name: "You accepted this offer" })).toBeInTheDocument();
  });

  it("sends DECLINE with the chosen reason", async () => {
    getOffer.mockResolvedValue(pendingOffer);
    respondOffer.mockResolvedValue({ status: "DECLINED" });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Pay does not match" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline offer" }));

    await waitFor(() => expect(respondOffer).toHaveBeenCalledTimes(1));
    expect(respondOffer).toHaveBeenCalledWith("7", {
      token: "tok-offer",
      decision: "DECLINE",
      declineReason: "SALARY_MISMATCH",
    });
  });

  it("shows the bad-link copy when the offer link is rejected with 404", async () => {
    getOffer.mockRejectedValue(new ApiError(404, "Not found"));

    renderPage();

    expect(
      await screen.findByText("This link no longer works. Ask your MEGS recruiter to send a new one."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });
});
