import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Public self check-in page (/check-in and /check-in/$publicId). Router hooks, the API, the CAPTCHA widget and
// the toaster are mocked; the page, the tracker and the form are real.
const routeState = vi.hoisted(() => ({
  params: {} as Record<string, string | undefined>,
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routeState.navigate,
  useParams: () => routeState.params,
  useSearch: () => routeState.search,
  useBlocker: () => ({ status: "idle" }),
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("../../lib/api/public.api", () => ({
  publicApi: {
    getCheckInJobs: vi.fn(),
    submitCheckIn: vi.fn(),
    getCheckInStatus: vi.fn(),
  },
}));

vi.mock("../../hooks/useSecurityControls", () => ({
  useSecurityControls: () => ({ data: undefined, isError: false }),
}));

// No Cloudflare script in tests. The page only needs the ref's reset().
vi.mock("../../components/common/TurnstileWidget", async () => {
  const ReactModule = await import("react");
  return { TurnstileWidget: ReactModule.forwardRef(() => null) };
});

vi.mock("../../lib/feedback", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { publicApi } from "../../lib/api/public.api";
import { ApiError } from "../../lib/api/client";
import { notify } from "../../lib/feedback";
import { CheckInPage } from "../../pages/public/CheckInPage";
import { yearsAgo } from "../../lib/walk-in-age";

const getCheckInJobs = publicApi.getCheckInJobs as unknown as ReturnType<typeof vi.fn>;
const submitCheckIn = publicApi.submitCheckIn as unknown as ReturnType<typeof vi.fn>;
const getCheckInStatus = publicApi.getCheckInStatus as unknown as ReturnType<typeof vi.fn>;

const forklift = { id: 5, title: "Forklift Operator", clientName: "Acme Logistics", location: "Cebu City" };
const submitted = { publicId: "pub-1", viewToken: "tok-1", queueNumber: "A-017", statusPath: "/check-in/pub-1?token=tok-1" };

const inFifteenMinutes = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();
const pendingStatus = (over: Record<string, unknown> = {}) => ({
  queueNumber: "A-017",
  status: "PENDING",
  firstName: "Juan",
  jobTitle: "Forklift Operator",
  createdAt: new Date().toISOString(),
  expiresAt: inFifteenMinutes(),
  tracking: null,
  ...over,
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CheckInPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

function fillDetails({ first = "Juan", last = "Dela Cruz", birth = "1995-06-15" }: { first?: string; last?: string; birth?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: first } });
  fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: last } });
  fireEvent.change(screen.getByLabelText(/Birth date/i), { target: { value: birth } });
}

const submitButton = () => screen.getByRole("button", { name: "Get my number" });

beforeEach(() => {
  vi.clearAllMocks();
  routeState.params = {};
  routeState.search = {};
  getCheckInJobs.mockResolvedValue({ jobs: [forklift] });
  submitCheckIn.mockResolvedValue(submitted);
  getCheckInStatus.mockResolvedValue(pendingStatus());
});

describe("CheckInPage: job list", () => {
  it("lists the open jobs and offers a search", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /Forklift Operator/ })).toBeInTheDocument();
    expect(screen.getByText("Acme Logistics · Cebu City")).toBeInTheDocument();
    expect(screen.getByLabelText("Search jobs")).toBeInTheDocument();
    expect(getCheckInJobs).toHaveBeenCalledWith("", expect.anything());
  });

  it("sends the search term once it settles", async () => {
    renderPage();
    await screen.findByRole("button", { name: /Forklift Operator/ });
    fireEvent.change(screen.getByLabelText("Search jobs"), { target: { value: "Fork" } });
    await waitFor(() => expect(getCheckInJobs).toHaveBeenLastCalledWith("Fork", expect.anything()));
  });

  it("says what to do when no job is open", async () => {
    getCheckInJobs.mockResolvedValue({ jobs: [] });
    renderPage();
    expect(await screen.findByText("There are no open jobs right now. Ask the recruiter at the desk.")).toBeInTheDocument();
  });

  it("says no job matches a search with no results", async () => {
    getCheckInJobs.mockResolvedValueOnce({ jobs: [forklift] }).mockResolvedValue({ jobs: [] });
    renderPage();
    await screen.findByRole("button", { name: /Forklift Operator/ });
    fireEvent.change(screen.getByLabelText("Search jobs"), { target: { value: "Zzz" } });
    expect(await screen.findByText("No jobs match your search. Try a different word.")).toBeInTheDocument();
  });

  it("shows a connection problem with a retry when the job list fails", async () => {
    getCheckInJobs.mockRejectedValue(new ApiError(500, "The request could not be completed."));
    renderPage();
    expect(await screen.findByText("Can't load this page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("CheckInPage: details form", () => {
  const chooseJob = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /Forklift Operator/ }));
    expect(await screen.findByText("Applying for")).toBeInTheDocument();
  };

  it("submits the details for the chosen job and moves to the queue number link", async () => {
    renderPage();
    await chooseJob();
    fillDetails();
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(submitCheckIn).toHaveBeenCalledWith({
        jobPostingId: 5,
        firstName: "Juan",
        lastName: "Dela Cruz",
        birthDate: "1995-06-15",
        turnstileToken: "",
      }),
    );
    await waitFor(() =>
      expect(routeState.navigate).toHaveBeenCalledWith({
        to: "/check-in/$publicId",
        params: { publicId: "pub-1" },
        search: { token: "tok-1" },
        replace: true,
      }),
    );
  });

  it("sends an optional biodata file with the details", async () => {
    renderPage();
    await chooseJob();
    fillDetails();
    const file = new File(["%PDF-1.4"], "biodata.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Biodata photo or PDF/i), { target: { files: [file] } });
    expect(screen.getByText("biodata.pdf")).toBeInTheDocument();
    fireEvent.click(submitButton());
    await waitFor(() => expect(submitCheckIn).toHaveBeenCalledWith(expect.objectContaining({ file })));
  });

  it("lets the applicant remove the chosen file and still submit", async () => {
    renderPage();
    await chooseJob();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/Biodata photo or PDF/i), {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
    fireEvent.click(submitButton());
    await waitFor(() => expect(submitCheckIn).toHaveBeenCalledTimes(1));
    expect(submitCheckIn.mock.calls[0][0].file).toBeUndefined();
  });

  it("refuses a file that is not a photo or PDF and sends nothing", async () => {
    renderPage();
    await chooseJob();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/Biodata photo or PDF/i), {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    fireEvent.click(submitButton());
    expect(await screen.findByText("Use a JPEG, PNG or WEBP photo, or a PDF.")).toBeInTheDocument();
    expect(submitCheckIn).not.toHaveBeenCalled();
  });

  it("refuses a file over 5 MB and sends nothing", async () => {
    renderPage();
    await chooseJob();
    fillDetails();
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/Biodata photo or PDF/i), { target: { files: [big] } });
    fireEvent.click(submitButton());
    expect(await screen.findByText("The file is over 5 MB. Retake the photo or use a smaller file.")).toBeInTheDocument();
    expect(submitCheckIn).not.toHaveBeenCalled();
  });

  it("asks for the required names and birth date and sends nothing", async () => {
    renderPage();
    await chooseJob();
    fireEvent.click(submitButton());
    expect(await screen.findByText("Enter your first name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your last name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your birth date.")).toBeInTheDocument();
    expect(submitCheckIn).not.toHaveBeenCalled();
  });

  it.each([
    ["17 years old", () => yearsAgo(17), false],
    ["66 years old", () => yearsAgo(66), false],
    ["18 years old (lower limit)", () => yearsAgo(18), true],
    ["65 years old (upper limit)", () => yearsAgo(65), true],
  ])("for a birth date that makes the applicant %s, blocks or accepts as the rule says", async (_label, birth, accepted) => {
    renderPage();
    await chooseJob();
    fillDetails({ birth: birth() });
    fireEvent.click(submitButton());
    if (accepted) {
      await waitFor(() => expect(submitCheckIn).toHaveBeenCalledTimes(1));
      expect(screen.queryByText("You must be 18 to 65 years old to apply.")).not.toBeInTheDocument();
    } else {
      expect(await screen.findByText("You must be 18 to 65 years old to apply.")).toBeInTheDocument();
      expect(submitCheckIn).not.toHaveBeenCalled();
    }
  });

  it("blocks a typed mobile number that is not a complete 09 number", async () => {
    renderPage();
    await chooseJob();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "123" } });
    fireEvent.click(submitButton());
    expect(await screen.findByText("Enter an 11-digit mobile number starting with 09, or leave it blank.")).toBeInTheDocument();
    expect(submitCheckIn).not.toHaveBeenCalled();
  });

  it("keeps the applicant on the form and shows the field message when the server rejects a field", async () => {
    submitCheckIn.mockRejectedValue(
      new ApiError(400, "The request could not be completed.", { errors: [{ field: "birthDate", message: "Applicant must be between 18 and 65 years old." }] }),
    );
    renderPage();
    await chooseJob();
    fillDetails();
    fireEvent.click(submitButton());
    expect(await screen.findByText("Applicant must be between 18 and 65 years old.")).toBeInTheDocument();
    expect(routeState.navigate).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("shows a toast when the server rejects the check-in without a field to point at", async () => {
    submitCheckIn.mockRejectedValue(new ApiError(400, "This job is no longer accepting applications"));
    renderPage();
    await chooseJob();
    fillDetails();
    fireEvent.click(submitButton());
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Could not check you in", expect.any(ApiError)));
  });
});

describe("CheckInPage: queue number screen", () => {
  beforeEach(() => {
    routeState.params = { publicId: "pub-1" };
    routeState.search = { token: "tok-1" };
  });

  it("shows the queue number and the desk instruction", async () => {
    renderPage();
    expect(await screen.findByText("A-017")).toBeInTheDocument();
    expect(screen.getByText("Show this number at the desk")).toBeInTheDocument();
    expect(screen.getByText("Forklift Operator")).toBeInTheDocument();
    expect(getCheckInStatus).toHaveBeenCalledWith("pub-1", "tok-1", expect.anything());
  });

  it("keeps polling every 15 seconds while the check-in is pending, and stops after confirmation", async () => {
    const queryClient = renderPage();
    await screen.findByText("A-017");
    const query = queryClient.getQueryCache().find({ queryKey: ["public", "check-in", "status", "pub-1", "tok-1"] }) as any;
    expect(query.options.refetchInterval(query)).toBe(15_000);

    query.setState({ ...query.state, data: pendingStatus({ status: "CONFIRMED" }) });
    expect(query.options.refetchInterval(query)).toBe(false);
  });

  it("turns into the tracker once a recruiter confirms the check-in", async () => {
    getCheckInStatus.mockResolvedValue(
      pendingStatus({
        status: "CONFIRMED",
        tracking: {
          trackingCode: "WLK-2026-0042",
          applicantName: "Juan D.",
          jobTitle: "Forklift Operator",
          clientName: "Acme Logistics",
          status: "SUBMITTED",
          appliedAt: "2026-10-22T02:00:00.000Z",
          nextInterview: null,
          venue: "Cebu City",
          updatedAt: "2026-10-22T02:00:00.000Z",
        },
      }),
    );
    renderPage();
    expect(await screen.findByText("Application for")).toBeInTheDocument();
    expect(screen.getByText("WLK-2026-0042", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Show this number at the desk")).not.toBeInTheDocument();
  });

  it("shows the closed copy for a dismissed check-in", async () => {
    getCheckInStatus.mockResolvedValue(pendingStatus({ status: "DISMISSED" }));
    renderPage();
    expect(await screen.findByText("This check-in is closed. Ask the recruiter at the desk.")).toBeInTheDocument();
    expect(screen.queryByText("A-017")).not.toBeInTheDocument();
  });

  it("shows the same closed copy for a wrong, used or expired link (404)", async () => {
    getCheckInStatus.mockRejectedValue(new ApiError(404, "This link no longer works"));
    renderPage();
    expect(await screen.findByText("This check-in is closed. Ask the recruiter at the desk.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows the closed copy once a pending check-in has passed its three days", async () => {
    getCheckInStatus.mockResolvedValue(pendingStatus({ expiresAt: new Date(Date.now() - 60_000).toISOString() }));
    renderPage();
    expect(await screen.findByText("This check-in is closed. Ask the recruiter at the desk.")).toBeInTheDocument();
  });

  it("does not ask the server at all when the address has no token", async () => {
    routeState.search = {};
    renderPage();
    expect(await screen.findByText("This check-in is closed. Ask the recruiter at the desk.")).toBeInTheDocument();
    expect(getCheckInStatus).not.toHaveBeenCalled();
  });

  it("shows a connection problem, not the closed copy, when the status request fails for another reason", async () => {
    getCheckInStatus.mockRejectedValue(new ApiError(500, "The request could not be completed."));
    renderPage();
    expect(await screen.findByText("Can't load this page")).toBeInTheDocument();
    expect(screen.queryByText("This check-in is closed. Ask the recruiter at the desk.")).not.toBeInTheDocument();
  });
});
