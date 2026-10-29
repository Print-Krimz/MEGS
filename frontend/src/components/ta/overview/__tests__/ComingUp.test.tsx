import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { taApi } from "../../../../lib/api/ta.api";
import { employeesApi } from "../../../../lib/api/employees.api";
import { addManilaCalendarDays, getManilaToday } from "../../../../lib/field-limits";
import { ComingUp } from "../ComingUp";

vi.mock("../../../../lib/api/ta.api", () => ({ taApi: { listInterviewCompliancePage: vi.fn() } }));
vi.mock("../../../../lib/api/employees.api", () => ({ employeesApi: { getCredentialAlerts: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: any) => <a href={String(to)} {...rest}>{children}</a>,
}));

const deployments = (data: unknown[]) => ({ data, isPending: false, isError: false, isFetching: false } as unknown as UseQueryResult<any>);

const renderComingUp = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ComingUp deploymentsQuery={deployments([])} />
    </QueryClientProvider>,
  );

const emptyPage = { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1, summary: { total: 0, breached: 0, warning: 0, healthy: 0 }, positions: [] };

describe("ComingUp interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeesApi.getCredentialAlerts).mockResolvedValue([]);
    vi.mocked(taApi.listInterviewCompliancePage).mockResolvedValue(emptyPage as any);
  });

  it("asks the server for scheduled interviews in a seven-day Manila window", async () => {
    renderComingUp();
    await waitFor(() => expect(taApi.listInterviewCompliancePage).toHaveBeenCalled());
    const today = getManilaToday();
    expect(vi.mocked(taApi.listInterviewCompliancePage).mock.calls[0][0]).toMatchObject({
      scheduledOnly: true,
      from: today,
      to: addManilaCalendarDays(today, 6),
      sortField: "scheduledAt",
      sortDirection: "asc",
    });
  });

  it("labels the section with the window it shows", async () => {
    vi.mocked(taApi.listInterviewCompliancePage).mockResolvedValue({
      ...emptyPage,
      items: [{ interviewId: 5, applicationId: 1, candidateName: "Ana Cruz", jobTitle: "Welder", scheduledAt: new Date().toISOString() }],
    } as any);
    renderComingUp();
    expect(await screen.findByText("Interviews in the next 7 days")).toBeDefined();
    expect(screen.getByText("Ana Cruz")).toBeDefined();
  });

  it("shows the neutral empty text when nothing is in the periods shown", async () => {
    renderComingUp();
    expect(await screen.findByText("No upcoming items in the periods shown.")).toBeDefined();
    expect(screen.queryByText(/next 30 days/)).toBeNull();
  });
});
