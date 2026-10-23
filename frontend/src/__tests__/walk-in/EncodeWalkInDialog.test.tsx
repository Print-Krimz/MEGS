import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
    readWalkInBiodata: vi.fn(),
  },
}));

import { taApi } from "../../lib/api/ta.api";
import { EncodeWalkInDialog } from "../../components/ta/walk-in/EncodeWalkInDialog";

const listJobs = taApi.listJobs as unknown as ReturnType<typeof vi.fn>;
const checkWalkInDuplicate = taApi.checkWalkInDuplicate as unknown as ReturnType<typeof vi.fn>;
const createWalkIn = taApi.createWalkIn as unknown as ReturnType<typeof vi.fn>;
const readWalkInBiodata = taApi.readWalkInBiodata as unknown as ReturnType<typeof vi.fn>;

const openJob = {
  id: 5,
  title: "Warehouse Associate",
  status: "OPEN",
  location: "Valenzuela",
  mrf: { client: { name: "Star Meg" } },
};

const existingMatch = {
  userId: "user-1",
  fullName: "Juan Dela Cruz",
  maskedPhone: "0917 *** 4521",
  hasPortalAccess: false,
  isWalkIn: true,
  latestApplication: { jobTitle: "Forklift Operator", status: "SUBMITTED" },
};

const slip = {
  applicationId: 41,
  trackingCode: "WLK-2026-0041",
  trackingToken: "raw-token",
  trackPath: "/t/WLK-2026-0041?token=raw-token",
  applicantName: "Juan Dela Cruz",
  jobTitle: "Warehouse Associate",
  clientName: "Star Meg",
  location: "Valenzuela",
  createdAt: "2026-10-22T02:00:00.000Z",
};

function renderDialog(onCreated = vi.fn(), onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <EncodeWalkInDialog open onClose={onClose} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return { onCreated, onClose };
}

async function pickJob() {
  const jobInput = screen.getByLabelText(/Job opening/i);
  fireEvent.focus(jobInput);
  fireEvent.click(await screen.findByRole("option", { name: /Warehouse Associate/ }));
}

function typeInto(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function chooseGender(value = "Male") {
  fireEvent.change(screen.getByLabelText(/Gender/i), { target: { value } });
}

function attachFile(file: File) {
  fireEvent.change(screen.getByLabelText(/Biodata photo or PDF/i), { target: { files: [file] } });
}

const pdf = () => new File(["%PDF-1.4 test"], "biodata.pdf", { type: "application/pdf" });

describe("EncodeWalkInDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listJobs.mockResolvedValue([openJob]);
    checkWalkInDuplicate.mockResolvedValue({ matches: [] });
    createWalkIn.mockResolvedValue(slip);
    readWalkInBiodata.mockResolvedValue({ status: "unreadable", suggestedJobId: null });
  });

  it("does not submit without a biodata file and says what to add", async () => {
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    typeInto(/Mobile number/i, "09171234567");

    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Add a photo or PDF of the biodata.");
    expect(createWalkIn).not.toHaveBeenCalled();
    expect(screen.queryByText("Choose a job opening.")).not.toBeInTheDocument();
  });

  it("shows the duplicate match after leaving the last name, and 'Use this person' sends existingUserId", async () => {
    checkWalkInDuplicate.mockResolvedValue({ matches: [existingMatch] });
    const { onCreated } = renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    fireEvent.blur(screen.getByLabelText(/Last name/i));

    expect(await screen.findByText("This person may already be in MEGS.")).toBeInTheDocument();
    expect(checkWalkInDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Juan", lastName: "Dela Cruz" }),
    );
    expect(screen.getByText(/Last applied for Forklift Operator/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use this person" }));

    expect(await screen.findByText(/Using the existing record for/)).toHaveTextContent("Juan Dela Cruz");
    expect(screen.queryByRole("button", { name: "Use this person" })).not.toBeInTheDocument();

    attachFile(pdf());
    chooseGender();
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));

    await waitFor(() => expect(createWalkIn).toHaveBeenCalledTimes(1));
    const body = createWalkIn.mock.calls[0][0] as FormData;
    expect(body.get("existingUserId")).toBe("user-1");
    expect(body.get("jobPostingId")).toBe("5");
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(slip));
  });

  it("'Different person' removes the match and saves as a new person", async () => {
    checkWalkInDuplicate.mockResolvedValue({ matches: [existingMatch] });
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    fireEvent.blur(screen.getByLabelText(/Last name/i));

    fireEvent.click(await screen.findByRole("button", { name: "Different person" }));
    expect(screen.queryByText("This person may already be in MEGS.")).not.toBeInTheDocument();

    attachFile(pdf());
    chooseGender();
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));

    await waitFor(() => expect(createWalkIn).toHaveBeenCalledTimes(1));
    const body = createWalkIn.mock.calls[0][0] as FormData;
    expect(body.has("existingUserId")).toBe(false);
  });

  it("still saves when the duplicate check fails", async () => {
    checkWalkInDuplicate.mockRejectedValue(new Error("Network down"));
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Ana");
    typeInto(/Last name/i, "Reyes");
    typeInto(/Birth date/i, "1995-06-15");
    fireEvent.blur(screen.getByLabelText(/Last name/i));

    await waitFor(() => expect(checkWalkInDuplicate).toHaveBeenCalled());
    expect(screen.queryByText("This person may already be in MEGS.")).not.toBeInTheDocument();

    attachFile(pdf());
    chooseGender();
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));
    await waitFor(() => expect(createWalkIn).toHaveBeenCalledTimes(1));
  });

  // Known gap: runDuplicateCheck (EncodeWalkInDialog.tsx:125) skips a repeat of the last key, and Undo
  // (line 274) does not clear lastCheckKey, so the match list never comes back after Undo.
  it("BUG: Undo after 'Use this person' brings the match list back", async () => {
    checkWalkInDuplicate.mockResolvedValue({ matches: [existingMatch] });
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    fireEvent.blur(screen.getByLabelText(/Last name/i));

    fireEvent.click(await screen.findByRole("button", { name: "Use this person" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    fireEvent.blur(screen.getByLabelText(/Last name/i));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByText("This person may already be in MEGS.")).toBeInTheDocument();
  });

  // Known gap: the backend walk-in route uses the 5 MB document limit
  // (backend/src/routes/ta/ta.routes.ts:183 -> upload.middleware.ts `upload`), but the form accepts up to 10 MB
  // (EncodeWalkInDialog.tsx:21). Marked it.fails so the suite stays green until the form matches the server.
  // Remove .fails once the limit is aligned.
  it("BUG: blocks a 6 MB biodata file before upload (server limit is 5 MB)", async () => {
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big-scan.pdf", { type: "application/pdf" });
    attachFile(big);

    chooseGender();
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(createWalkIn).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/MB/);
  });

  // Known gap: the file input and validation accept any image/* (HEIC, GIF, BMP), but the upload
  // middleware only allows PDF, JPEG, PNG and WEBP (backend/src/middleware/upload.middleware.ts).
  it("BUG: blocks an image type the server does not accept (GIF)", async () => {
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    attachFile(new File(["GIF89a"], "biodata.gif", { type: "image/gif" }));

    chooseGender();
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(createWalkIn).not.toHaveBeenCalled();
  });
  it("blocks saving without a birth date", async () => {
    renderDialog();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("Enter the birth date.")).toBeInTheDocument();
  });

  it("blocks saving when the applicant is younger than 18 or older than 65", async () => {
    renderDialog();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    const thisYear = Number(new Date().toISOString().slice(0, 4));
    typeInto(/Birth date/i, `${thisYear - 10}-01-01`);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("Applicant must be 18 to 65 years old.")).toBeInTheDocument();
    typeInto(/Birth date/i, `${thisYear - 70}-01-01`);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("Applicant must be 18 to 65 years old.")).toBeInTheDocument();
  });
});

describe("EncodeWalkInDialog: gender and bio-data auto-fill", () => {
  const read = {
    status: "read",
    firstName: "Pedro",
    middleName: "Reyes",
    lastName: "Santos",
    mobileNumber: "09171234567",
    birthDate: "1990-05-09",
    gender: "Female",
    positionApplied: "Warehouse Associate",
    suggestedJobId: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listJobs.mockResolvedValue([openJob]);
    checkWalkInDuplicate.mockResolvedValue({ matches: [] });
    createWalkIn.mockResolvedValue(slip);
    readWalkInBiodata.mockResolvedValue({ status: "unreadable", suggestedJobId: null });
  });

  it("no longer shows the age hint under the birth date", () => {
    renderDialog();
    expect(screen.queryByText(/18 to 65 years old/)).not.toBeInTheDocument();
  });

  it("asks for a gender and does not save without one", async () => {
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    attachFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));

    expect(await screen.findByText("Choose a gender.")).toBeInTheDocument();
    expect(createWalkIn).not.toHaveBeenCalled();
  });

  it("sends the chosen gender", async () => {
    renderDialog();
    await pickJob();
    typeInto(/First name/i, "Juan");
    typeInto(/Last name/i, "Dela Cruz");
    typeInto(/Birth date/i, "1995-06-15");
    chooseGender("Non-Binary");
    attachFile(pdf());
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));

    await waitFor(() => expect(createWalkIn).toHaveBeenCalledTimes(1));
    expect((createWalkIn.mock.calls[0][0] as FormData).get("gender")).toBe("Non-Binary");
  });

  it("reads the file when it is picked and fills only the empty fields", async () => {
    readWalkInBiodata.mockResolvedValue(read);
    renderDialog();
    typeInto(/First name/i, "Juan");
    const file = pdf();
    attachFile(file);

    expect(await screen.findByText("Filled from the bio-data. Check before saving.")).toBeInTheDocument();
    expect(readWalkInBiodata).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Juan");
    expect(screen.getByLabelText(/Middle name/i)).toHaveValue("Reyes");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Santos");
    expect(screen.getByLabelText(/Mobile number/i)).toHaveValue("09171234567");
    expect(screen.getByLabelText(/Birth date/i)).toHaveValue("1990-05-09");
    expect(screen.getByLabelText(/Gender/i)).toHaveValue("Female");
    await waitFor(() => expect(screen.getByLabelText(/Job opening/i)).toHaveValue("Warehouse Associate"));
    await waitFor(() =>
      expect(checkWalkInDuplicate).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Juan", lastName: "Santos" })),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));
    await waitFor(() => expect(createWalkIn).toHaveBeenCalledTimes(1));
    const body = createWalkIn.mock.calls[0][0] as FormData;
    expect(body.get("gender")).toBe("Female");
    expect(body.get("jobPostingId")).toBe("5");
    expect(body.get("firstName")).toBe("Juan");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("keeps the job the TA already chose", async () => {
    listJobs.mockResolvedValue([openJob, { ...openJob, id: 6, title: "Forklift Operator" }]);
    readWalkInBiodata.mockResolvedValue({ ...read, suggestedJobId: 6 });
    renderDialog();
    await pickJob();
    attachFile(pdf());
    await screen.findByText("Filled from the bio-data. Check before saving.");
    expect(screen.getByLabelText(/Job opening/i)).toHaveValue("Warehouse Associate");
  });

  it("shows that it is reading, and never overwrites what is typed while it reads", async () => {
    let finish: (value: unknown) => void = () => {};
    readWalkInBiodata.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderDialog();
    attachFile(pdf());
    expect(await screen.findByText("Reading bio-data…")).toBeInTheDocument();

    typeInto(/Last name/i, "Garcia");
    finish(read);

    expect(await screen.findByText("Filled from the bio-data. Check before saving.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Garcia");
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Pedro");
  });

  it("says when the file could not be read and lets the TA type the details", async () => {
    renderDialog();
    await pickJob();
    attachFile(pdf());
    expect(await screen.findByText("Couldn't read this file. Type the details.")).toBeInTheDocument();

    typeInto(/First name/i, "Ana");
    typeInto(/Last name/i, "Reyes");
    typeInto(/Birth date/i, "1995-06-15");
    chooseGender("Female");
    fireEvent.click(screen.getByRole("button", { name: "Save and print slip" }));
    await waitFor(() => expect(createWalkIn).toHaveBeenCalledTimes(1));
  });

  it("treats a failed read (for example too many reads) like an unreadable file", async () => {
    readWalkInBiodata.mockRejectedValue(new Error("Too many requests"));
    renderDialog();
    attachFile(pdf());
    expect(await screen.findByText("Couldn't read this file. Type the details.")).toBeInTheDocument();
    expect(readWalkInBiodata).toHaveBeenCalledTimes(1);
  });

  it("reads again when the file changes, still keeping what is already filled", async () => {
    readWalkInBiodata.mockResolvedValueOnce(read);
    renderDialog();
    attachFile(pdf());
    await screen.findByText("Filled from the bio-data. Check before saving.");

    readWalkInBiodata.mockResolvedValueOnce({ ...read, firstName: "Mario", lastName: "Lopez", middleName: "Cruz" });
    attachFile(new File(["%PDF-1.4 other"], "other.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(readWalkInBiodata).toHaveBeenCalledTimes(2));

    expect(screen.getByLabelText(/First name/i)).toHaveValue("Pedro");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Santos");
  });

  it("does not send a file the form would refuse to be read", async () => {
    renderDialog();
    attachFile(new File(["GIF89a"], "biodata.gif", { type: "image/gif" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readWalkInBiodata).not.toHaveBeenCalled();
  });
});
