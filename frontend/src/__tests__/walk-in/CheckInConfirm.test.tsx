import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// EncodeWalkInDialog in check-in mode: the applicant's details arrive from the queue, the job is locked, the biodata
// file is still required, and Save becomes "Confirm and print slip" (taApi.confirmCheckIn instead of createWalkIn).
vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => ({ status: "idle" }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("../../lib/api/ta.api", () => ({
  taApi: {
    listJobs: vi.fn(),
    checkWalkInDuplicate: vi.fn(),
    createWalkIn: vi.fn(),
    confirmCheckIn: vi.fn(),
    getCheckInBiodata: vi.fn(),
    readWalkInBiodata: vi.fn(),
  },
}));

vi.mock("../../lib/feedback", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { taApi } from "../../lib/api/ta.api";
import { notify } from "../../lib/feedback";
import { EncodeWalkInDialog } from "../../components/ta/walk-in/EncodeWalkInDialog";
import { yearsAgo } from "../../lib/walk-in-age";
import type { CheckInDetail } from "../../lib/types/application.types";

const listJobs = taApi.listJobs as unknown as ReturnType<typeof vi.fn>;
const checkWalkInDuplicate = taApi.checkWalkInDuplicate as unknown as ReturnType<typeof vi.fn>;
const createWalkIn = taApi.createWalkIn as unknown as ReturnType<typeof vi.fn>;
const confirmCheckIn = taApi.confirmCheckIn as unknown as ReturnType<typeof vi.fn>;
const readWalkInBiodata = taApi.readWalkInBiodata as unknown as ReturnType<typeof vi.fn>;

const queued: CheckInDetail = {
  id: 9,
  queueNumber: "A-017",
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  jobPostingId: 5,
  jobTitle: "Forklift Operator",
  clientName: "Acme Logistics",
  createdAt: "2026-10-22T01:30:00.000Z",
  mobileNumber: "09171234567",
  birthDate: "1990-05-09",
  jobOwnerId: "ta-maria",
  jobOwnerName: "Maria Reyes",
  biodata: null,
};

const withBiodata: CheckInDetail = {
  ...queued,
  biodata: { fileName: "juan-biodata.pdf", mimeType: "application/pdf", sizeBytes: 250 * 1024 },
};

const slip = {
  applicationId: 42,
  trackingCode: "WLK-2026-0042",
  trackingToken: "raw-token",
  trackPath: "/t/WLK-2026-0042?token=raw-token",
  applicantName: "Juan Santos Dela Cruz",
  jobTitle: "Forklift Operator",
  clientName: "Acme Logistics",
  location: "Cebu City",
  createdAt: "2026-10-22T02:00:00.000Z",
};

const pdf = () => new File(["%PDF-1.4 biodata"], "biodata.pdf", { type: "application/pdf" });

function renderConfirm(checkIn: CheckInDetail | null = queued) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <EncodeWalkInDialog open checkIn={checkIn} onClose={onClose} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return { onClose, onCreated };
}

const attachFile = (file: File) => fireEvent.change(screen.getByLabelText(/Resume photo or PDF/i), { target: { files: [file] } });
const chooseGender = (value = "Female") => fireEvent.change(screen.getByLabelText(/Gender/i), { target: { value } });
const confirmButton = () => screen.getByRole("button", { name: "Confirm and print slip" });

beforeEach(() => {
  vi.clearAllMocks();
  listJobs.mockResolvedValue([]);
  checkWalkInDuplicate.mockResolvedValue({ matches: [] });
  confirmCheckIn.mockResolvedValue(slip);
  createWalkIn.mockResolvedValue(slip);
  readWalkInBiodata.mockResolvedValue({ status: "unreadable", suggestedJobId: null });
});

describe("EncodeWalkInDialog in check-in mode: layout", () => {
  it("names the check-in and says what to check at the desk", () => {
    renderConfirm();
    expect(screen.getByText("Confirm check-in A-017")).toBeInTheDocument();
    expect(screen.getByText("Check their ID, correct any detail, then photograph the resume.")).toBeInTheDocument();
  });

  it("locks the job: no job picker, the job's title shown, and the job list is never loaded", () => {
    renderConfirm();
    expect(screen.queryByLabelText(/Job opening/i)).not.toBeInTheDocument();
    expect(screen.getByText("Forklift Operator")).toBeInTheDocument();
    expect(screen.getByText("Goes to Maria Reyes's list after you confirm.")).toBeInTheDocument();
    expect(listJobs).not.toHaveBeenCalled();
  });

  it("shows the client name and the owner note", () => {
    renderConfirm();
    expect(screen.getByText("Acme Logistics")).toBeInTheDocument();
    expect(screen.getByText(/Maria Reyes's list/)).toBeInTheDocument();
  });

  it("does not show a broken character in the job line (expected to fail: see report)", () => {
    renderConfirm();
    expect(document.body.textContent ?? "").not.toContain("�");
  });

  it("prefills the applicant's details from the queue", () => {
    renderConfirm();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Juan");
    expect(screen.getByLabelText(/Middle name/i)).toHaveValue("Santos");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Dela Cruz");
    expect(screen.getByLabelText(/Mobile number/i)).toHaveValue("09171234567");
    expect(screen.getByLabelText(/Birth date/i)).toHaveValue("1990-05-09");
  });
});

describe("EncodeWalkInDialog in check-in mode: applicant attached biodata", () => {
  it("shows the attached file and makes a new file optional", () => {
    renderConfirm(withBiodata);
    expect(screen.getByText("juan-biodata.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Applicant attached:/)).toHaveTextContent("(250 KB)");
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Replace resume \(optional\)/i)).toBeInTheDocument();
  });

  it("confirms without attaching a file", async () => {
    renderConfirm(withBiodata);
    chooseGender();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(confirmCheckIn).toHaveBeenCalledTimes(1));
    expect((confirmCheckIn.mock.calls[0][1] as FormData).get("file")).toBeNull();
    // The confirm schema is strict: the form must not send a job id (the check-in names its job).
    expect((confirmCheckIn.mock.calls[0][1] as FormData).has("jobPostingId")).toBe(false);
  });

  it("still sends a replacement file when the TA attaches one", async () => {
    renderConfirm(withBiodata);
    fireEvent.change(screen.getByLabelText(/Replace resume/i), { target: { files: [pdf()] } });
    chooseGender();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(confirmCheckIn).toHaveBeenCalledTimes(1));
    expect((confirmCheckIn.mock.calls[0][1] as FormData).get("file")).toBeInstanceOf(File);
  });
});

describe("EncodeWalkInDialog in check-in mode: biodata and submit", () => {
  it("does not confirm without the biodata file and says what to add", async () => {
    renderConfirm();
    chooseGender();
    fireEvent.click(confirmButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a photo or PDF of the resume.");
    expect(confirmCheckIn).not.toHaveBeenCalled();
    expect(createWalkIn).not.toHaveBeenCalled();
  });

  it("refuses a file type that is not a photo or PDF", async () => {
    renderConfirm();
    attachFile(new File(["notes"], "notes.txt", { type: "text/plain" }));
    chooseGender();
    fireEvent.click(confirmButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPEG, PNG or WEBP photo, or a PDF.");
    expect(confirmCheckIn).not.toHaveBeenCalled();
  });

  it("sends the check-in id and the biodata, but no job id, then reports the slip", async () => {
    const { onClose, onCreated } = renderConfirm();
    attachFile(pdf());
    chooseGender();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(confirmCheckIn).toHaveBeenCalledTimes(1));
    const [id, body] = confirmCheckIn.mock.calls[0] as [number, FormData];
    expect(id).toBe(9);
    expect(body.has("jobPostingId")).toBe(false);
    expect(body.get("firstName")).toBe("Juan");
    expect(body.get("middleName")).toBe("Santos");
    expect(body.get("lastName")).toBe("Dela Cruz");
    expect(body.get("mobileNumber")).toBe("09171234567");
    expect(body.get("birthDate")).toBe("1990-05-09");
    expect(body.get("gender")).toBe("Female");
    expect(body.get("existingUserId")).toBeNull();
    expect(body.get("file")).toBeInstanceOf(File);
    expect(createWalkIn).not.toHaveBeenCalled();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(slip));
    expect(onClose).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith("Walk-in saved", "Juan Santos Dela Cruz is now in the pipeline.");
  });

  it("lets the TA correct a detail before confirming, and sends the corrected value", async () => {
    renderConfirm();
    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: "Juan Miguel" } });
    attachFile(pdf());
    chooseGender();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(confirmCheckIn).toHaveBeenCalledTimes(1));
    expect((confirmCheckIn.mock.calls[0][1] as FormData).get("firstName")).toBe("Juan Miguel");
  });

  it("applies the 18 to 65 rule here too, so a 17-year-old cannot be confirmed from the queue", async () => {
    renderConfirm();
    fireEvent.change(screen.getByLabelText(/Birth date/i), { target: { value: yearsAgo(17) } });
    attachFile(pdf());
    chooseGender();
    fireEvent.click(confirmButton());
    expect(await screen.findByText("Applicant must be 18 to 65 years old.")).toBeInTheDocument();
    expect(confirmCheckIn).not.toHaveBeenCalled();
  });

  it("keeps the entered values and reports the error when the server refuses the check-in", async () => {
    confirmCheckIn.mockRejectedValue(new Error("Attach the biodata photo or PDF"));
    const { onCreated } = renderConfirm();
    attachFile(pdf());
    chooseGender();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Could not save the walk-in", expect.any(Error)));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Juan");
  });
});
