import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { ApplicationsPage } from "../ApplicationsPage";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    listClients: vi.fn().mockResolvedValue([]),
    listJobs: vi.fn().mockResolvedValue([]),
    listApplicationsPage: vi.fn(),
    countApplications: vi.fn(),
    archiveApplication: vi.fn(),
    restoreApplication: vi.fn(),
  },
}));

const urlListeners = vi.hoisted(() => new Set<() => void>());

/** Stands in for the router: a navigate call rewrites the URL and tells subscribers, as a real commit would. */
const commitNavigation = (opts: { search?: Record<string, unknown> }) => {
  const params = new URLSearchParams();
  Object.entries(opts.search ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== false && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  window.history.replaceState({}, "", `/ta/applications${qs ? `?${qs}` : ""}`);
  urlListeners.forEach((fn) => fn());
};

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
  useSearch: () => {
    React.useSyncExternalStore(
      (fn) => {
        urlListeners.add(fn);
        return () => urlListeners.delete(fn);
      },
      () => window.location.search,
    );
    return {};
  },
  Link: ({ children, to, params, search: _search, ...props }: any) => (
    <a href={String(to).replace("$applicationId", params?.applicationId ?? "")} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
  };
});

const app = (id: number, first: string, daysInStage: number) => ({
  id,
  status: "INITIAL_SCREENING",
  isArchived: false,
  createdAt: "2026-08-01T00:00:00Z",
  daysInStage,
  stageEnteredAt: "2026-08-02T00:00:00Z",
  interviewCount: 0,
  recruiterDecisionCount: 0,
  user: { id: `u${id}`, email: `${first.toLowerCase()}@example.com`, applicantProfile: { firstName: first, lastName: "Tester" } },
  jobPosting: { id: 10, title: "Electrician", mrf: { client: { id: 1, name: "Acme" } } },
});

const page = (items: any[]) => ({ items, total: items.length, page: 1, pageSize: 10, totalPages: 1 });

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ApplicationsPage />
    </QueryClientProvider>,
  );

describe("TA applications list controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockImplementation(commitNavigation);
    window.history.replaceState({}, "", "/ta/applications");
    vi.mocked(taApi.listApplicationsPage).mockResolvedValue(page([app(7, "Maria", 12), app(8, "Pedro", 0)]) as any);
    vi.mocked(taApi.countApplications).mockResolvedValue({ total: 5, byStatus: { SUBMITTED: 3, COMPLIANCE: 2 } });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("asks for the list once and the stage counts once, instead of one list per stage", async () => {
    renderPage();
    await screen.findAllByRole("link", { name: "View application for Maria Tester" });
    await waitFor(() => expect(taApi.countApplications).toHaveBeenCalledTimes(1));
    expect(taApi.listApplicationsPage).toHaveBeenCalledTimes(1);
    expect(taApi.listApplicationsPage).not.toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }), expect.anything());
  });

  it("sends every filter, including the archived view, to the counts request", async () => {
    window.history.replaceState({}, "", "/ta/applications?archived=true&source=WALK_IN&needsAction=true&q=ana");
    renderPage();
    await waitFor(() =>
      expect(taApi.countApplications).toHaveBeenCalledWith(
        expect.objectContaining({ isArchived: true, source: "WALK_IN", needsAction: true, search: "ana" }),
        expect.anything(),
      ),
    );
    const sent = vi.mocked(taApi.countApplications).mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("status");
  });

  it("links each row to the application and shows days in stage", async () => {
    renderPage();
    const view = (await screen.findAllByRole("link", { name: "View application for Maria Tester" }))[0];
    expect(view.getAttribute("href")).toBe("/ta/applications/7");
    expect((await screen.findAllByText("12 days")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "More actions for Maria Tester" }).length).toBeGreaterThan(0);
  });

  it("leaves deployed workers out of select all, so Reject stays available", async () => {
    vi.mocked(taApi.listApplicationsPage).mockResolvedValue(
      page([app(7, "Maria", 2), { ...app(8, "Pedro", 5), status: "DEPLOYED" }]) as any,
    );
    renderPage();
    const pedro = (await screen.findAllByLabelText("Select Pedro Tester"))[0] as HTMLInputElement;
    expect(pedro.disabled).toBe(true);

    fireEvent.click(screen.getAllByLabelText("Select all rows on this page")[0]);

    expect(((await screen.findAllByLabelText("Select Maria Tester"))[0] as HTMLInputElement).checked).toBe(true);
    expect(pedro.checked).toBe(false);
    expect(screen.getAllByText("1 selected").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Reject" }).length).toBeGreaterThan(0);
  });

  it("offers open job opening and copy email in the row menu", async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "More actions for Maria Tester" }))[0]);
    expect(await screen.findByRole("menuitem", { name: "Open job opening" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Copy email" })).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Archive" })).toBeNull();
  });

  it("reads sort and needs action from the URL and sends them to the list request", async () => {
    window.history.replaceState({}, "", "/ta/applications?sort=waiting&needsAction=true");
    renderPage();
    await waitFor(() =>
      expect(taApi.listApplicationsPage).toHaveBeenCalledWith(
        expect.objectContaining({ sort: "waiting", needsAction: true }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole("button", { name: "Needs action" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Clear filters \(1\)/ })).toBeDefined();
  });

  it("writes needs action to the URL when toggled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Needs action" }));
    expect(navigateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ needsAction: true }) }),
    );
    await waitFor(() =>
      expect(taApi.listApplicationsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ needsAction: true }),
        expect.anything(),
      ),
    );
  });

  it("hides Clear filters at defaults and resets sort and needs action when used", async () => {
    window.history.replaceState({}, "", "/ta/applications?sort=oldest&needsAction=1");
    renderPage();
    expect(screen.queryByRole("button", { name: /Clear filters/ })).not.toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /Clear filters \(1\)/ }));
    expect(navigateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ sort: undefined, needsAction: undefined, q: undefined, stage: undefined }),
      }),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull());
    expect(screen.getByRole("button", { name: "Needs action" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("says no applications need action when only that filter hides everything", async () => {
    window.history.replaceState({}, "", "/ta/applications?needsAction=true");
    vi.mocked(taApi.listApplicationsPage).mockResolvedValue(page([]) as any);
    renderPage();
    expect(await screen.findByText("No applications need action")).toBeDefined();
  });

  describe("filters", () => {
    const store = new Map<string, string>();
    const openQueue = () => store.set("megs_ta_applications_layout", "queue");
    beforeEach(() => {
      store.clear();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("opens, applies and clears filters from the Filters button in Queue layout", async () => {
      openQueue();
      renderPage();
      const toggle = await screen.findByRole("button", { name: "Filters" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("button", { name: "Needs action" })).toBeNull();

      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Needs action" }));
      expect(window.location.search).toContain("needsAction=true");
      await waitFor(() =>
        expect(taApi.listApplicationsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ needsAction: true }),
          expect.anything(),
        ),
      );
      expect(screen.getByRole("button", { name: "Filters (1 active)" })).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: /Clear filters \(1\)/ }));
      expect(window.location.search).toBe("");
      await waitFor(() => expect(screen.getByRole("button", { name: "Filters" })).toBeDefined());
    });

    it("does not count the sort as an active filter", async () => {
      openQueue();
      window.history.replaceState({}, "", "/ta/applications?sort=newest");
      renderPage();
      expect(await screen.findByRole("button", { name: "Filters" })).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
      expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
    });

    it("asks for archived rows when the Archived stage is chosen", async () => {
      window.history.replaceState({}, "", "/ta/applications?stage=ARCHIVED");
      renderPage();
      await waitFor(() =>
        expect(taApi.listApplicationsPage).toHaveBeenCalledWith(
          expect.objectContaining({ status: "ARCHIVED", isArchived: true }),
          expect.anything(),
        ),
      );
    });

    it("keeps a closed stage visible in Queue layout instead of filtering to open work", async () => {
      openQueue();
      window.history.replaceState({}, "", "/ta/applications?stage=REJECTED");
      renderPage();
      await waitFor(() =>
        expect(taApi.listApplicationsPage).toHaveBeenCalledWith(
          expect.objectContaining({ status: "REJECTED", openOnly: undefined }),
          expect.anything(),
        ),
      );
    });

    it("keeps typed search text when the URL catches up, and follows outside URL changes", async () => {
      renderPage();
      const box = (await screen.findByPlaceholderText("Search candidate, email or job")) as HTMLInputElement;
      fireEvent.change(box, { target: { value: "ma" } });
      await waitFor(() => expect(window.location.search).toContain("q=ma"));
      fireEvent.change(box, { target: { value: "mar" } });
      expect(box.value).toBe("mar");
      await waitFor(() => expect(window.location.search).toContain("q=mar"));
      expect(box.value).toBe("mar");
      await waitFor(() =>
        expect(taApi.listApplicationsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "mar" }),
          expect.anything(),
        ),
      );

      act(() => {
        window.history.replaceState({}, "", "/ta/applications?q=pedro");
        urlListeners.forEach((fn) => fn());
      });
      await waitFor(() => expect(box.value).toBe("pedro"));
    });
  });
});
