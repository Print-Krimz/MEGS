import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The Check-ins tab on the Applications page. The API and toaster are mocked. The Encode dialog is stubbed here
// (its own behaviour is covered in CheckInConfirm.test.tsx), so this file only checks what the panel hands it.
vi.mock("../../lib/api/ta.api", () => ({
  taApi: {
    listCheckIns: vi.fn(),
    getCheckIn: vi.fn(),
    dismissCheckIn: vi.fn(),
  },
}));

vi.mock("../../lib/feedback", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../components/ta/walk-in/EncodeWalkInDialog", () => ({
  EncodeWalkInDialog: ({ open, checkIn }: { open: boolean; checkIn: { queueNumber: string } | null }) =>
    open ? <div role="dialog" aria-label="Encode stub">{checkIn?.queueNumber}</div> : null,
}));

import { taApi } from "../../lib/api/ta.api";
import { notify } from "../../lib/feedback";
import { CheckInsPanel, formatWaiting } from "../../components/ta/walk-in/CheckInsPanel";

const listCheckIns = taApi.listCheckIns as unknown as ReturnType<typeof vi.fn>;
const getCheckIn = taApi.getCheckIn as unknown as ReturnType<typeof vi.fn>;
const dismissCheckIn = taApi.dismissCheckIn as unknown as ReturnType<typeof vi.fn>;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const juan = {
  id: 9,
  queueNumber: "A-001",
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  jobPostingId: 5,
  jobTitle: "Forklift Operator",
  clientName: "Acme Logistics",
  createdAt: minutesAgo(30),
};

function renderPanel(onConfirmed = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CheckInsPanel onConfirmed={onConfirmed} />
    </QueryClientProvider>,
  );
  return { onConfirmed, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  listCheckIns.mockResolvedValue({ items: [juan] });
  dismissCheckIn.mockResolvedValue({ ok: true });
});

describe("formatWaiting", () => {
  const now = Date.parse("2026-10-22T04:00:00Z");
  const since = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  it("reads the waiting time in plain words", () => {
    expect(formatWaiting(since(0), now)).toBe("just now");
    expect(formatWaiting(since(12), now)).toBe("12 min");
    expect(formatWaiting(since(60), now)).toBe("1 h");
    expect(formatWaiting(since(65), now)).toBe("1 h 5 min");
  });
});

describe("CheckInsPanel: list", () => {
  it("says no one is waiting when the list is empty", async () => {
    listCheckIns.mockResolvedValue({ items: [] });
    renderPanel();
    expect(await screen.findByText("No one is waiting.")).toBeInTheDocument();
    expect(screen.getByText("Applicants who scan the poster appear here.")).toBeInTheDocument();
  });

  it("shows the number, name, job, client and waiting time for each person", async () => {
    renderPanel();
    const list = await screen.findByRole("list", { name: "Waiting check-ins" });
    expect(list).toHaveTextContent("A-001");
    expect(list).toHaveTextContent("Juan Santos Dela Cruz");
    expect(list).toHaveTextContent("Forklift Operator · Acme Logistics");
    expect(list).toHaveTextContent("30 min");
  });

  it("gives the Dismiss and Confirm buttons a name that says who they act on (expected to fail: see report)", async () => {
    renderPanel();
    await screen.findByRole("list", { name: "Waiting check-ins" });
    expect(screen.getByRole("button", { name: /Dismiss.*A-001/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm.*A-001/ })).toBeInTheDocument();
  });
});

describe("CheckInsPanel: dismiss", () => {
  const openDismiss = async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /^Dismiss A-001/ }));
    expect(await screen.findByText("Dismiss check-in A-001")).toBeInTheDocument();
  };

  it("asks for a reason and does not dismiss without one", async () => {
    await openDismiss();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss check-in" }));
    expect(await screen.findByText("Enter a reason.")).toBeInTheDocument();
    expect(dismissCheckIn).not.toHaveBeenCalled();
  });

  it("refuses a reason that is only spaces", async () => {
    await openDismiss();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "    " } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss check-in" }));
    expect(await screen.findByText("Enter a reason.")).toBeInTheDocument();
    expect(dismissCheckIn).not.toHaveBeenCalled();
  });

  it("dismisses with the trimmed reason, confirms it, and removes the dialog", async () => {
    await openDismiss();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "  Left before the call  " } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss check-in" }));

    await waitFor(() => expect(dismissCheckIn).toHaveBeenCalledWith(9, "Left before the call"));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Check-in dismissed", "Juan Santos Dela Cruz was removed from the list."));
    await waitFor(() => expect(screen.queryByText("Dismiss check-in A-001")).not.toBeInTheDocument());
  });

  it("keeps the dialog open with a message when the dismissal fails", async () => {
    dismissCheckIn.mockRejectedValue(new Error("The request could not be completed."));
    await openDismiss();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Left" } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss check-in" }));
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Could not dismiss the check-in", expect.any(Error)));
    expect(screen.getByText("Dismiss check-in A-001")).toBeInTheDocument();
  });
});

describe("CheckInsPanel: confirm", () => {
  it("loads the full check-in and hands it to the Encode dialog", async () => {
    getCheckIn.mockResolvedValue({ ...juan, mobileNumber: "09171234567", birthDate: "1990-05-09", jobOwnerId: "ta-maria", jobOwnerName: "Maria Reyes" });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /^Confirm A-001/ }));

    await waitFor(() => expect(getCheckIn).toHaveBeenCalledWith(9));
    expect(await screen.findByRole("dialog", { name: "Encode stub" })).toHaveTextContent("A-001");
  });

  it("says so when the check-in cannot be opened, and refreshes the list", async () => {
    getCheckIn.mockRejectedValue(new Error("Check-in not found"));
    const { queryClient } = renderPanel();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(await screen.findByRole("button", { name: /^Confirm A-001/ }));

    await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Could not open the check-in", expect.any(Error)));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ta", "check-ins"] });
    expect(screen.queryByRole("dialog", { name: "Encode stub" })).not.toBeInTheDocument();
  });
});
