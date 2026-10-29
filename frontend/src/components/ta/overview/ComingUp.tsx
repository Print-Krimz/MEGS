import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { taApi } from "../../../lib/api/ta.api";
import { employeesApi } from "../../../lib/api/employees.api";
import { addManilaCalendarDays, getManilaToday, toManilaDateInput } from "../../../lib/field-limits";
import { formatDate } from "../../../lib/utils";
import { Button } from "../../ui";
import type { Deployment } from "../../../lib/types/employee.types";

const QUERY = { retry: 1, retryDelay: 800 } as const;
const MAX_ROWS = 3;

interface LinkTarget {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
}

interface Item {
  key: string;
  title: string;
  detail?: string;
  when: string;
  target: LinkTarget;
}

interface Section {
  key: string;
  label: string;
  items: Item[];
  seeAll: LinkTarget;
}

const linkProps = (t: LinkTarget) => ({ to: t.to, params: t.params as never, search: t.search as never });

const workerName = (dep: Deployment): string => {
  const profile = dep.employee?.user?.applicantProfile ?? dep.application?.user?.applicantProfile;
  const name = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
  return name || dep.employee?.employeeNumber || "Worker";
};

const deploymentTarget = (dep: Deployment): LinkTarget => ({
  to: "/ta/deployments/$deploymentId",
  params: { deploymentId: String(dep.id) },
});

const WORKFORCE_DEPLOYMENTS: LinkTarget = { to: "/ta/workforce", search: { tab: "deployments" } };

/** Deployments whose date (such as contract end) is a Manila day inside [from, to], earliest first. */
function deploymentsBetween(deployments: Deployment[], pick: (d: Deployment) => string | null | undefined, from: string, to: string) {
  return deployments
    .map((dep) => ({ dep, day: pick(dep) ? toManilaDateInput(pick(dep)) : "" }))
    .filter(({ day }) => day !== "" && day >= from && day <= to)
    .sort((a, b) => a.day.localeCompare(b.day) || a.dep.id - b.dep.id);
}

const SectionBlock: React.FC<{ section: Section }> = ({ section }) => {
  const shown = section.items.slice(0, MAX_ROWS);
  const more = section.items.length - shown.length;
  return (
    <div>
      <h3 className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700">
        {section.label}
        <span className="tabular-nums text-slate-500">{section.items.length}</span>
      </h3>
      <ul className="divide-y divide-slate-200 border-b border-slate-200">
        {shown.map((item) => (
          <li key={item.key}>
            <Link
              {...linkProps(item.target)}
              className="focus-ring-inset flex min-h-11 items-center justify-between gap-3 px-3.5 py-1.5 hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-950">{item.title}</span>
                {item.detail && <span className="block truncate text-xs text-slate-600">{item.detail}</span>}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-slate-700">{item.when}</span>
            </Link>
          </li>
        ))}
        {more > 0 && (
          <li>
            <Link
              {...linkProps(section.seeAll)}
              className="focus-ring-inset flex min-h-11 items-center justify-between gap-3 px-3.5 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50 hover:underline"
            >
              See all {section.items.length}
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
};

/** What is scheduled soon, so the recruiter can plan the week. Each section is hidden when it has nothing. */
export const ComingUp: React.FC<{ deploymentsQuery: UseQueryResult<Deployment[]> }> = ({ deploymentsQuery }) => {
  const today = getManilaToday();
  // Today plus the next six Manila days: seven calendar days, both ends inclusive.
  const weekEnd = addManilaCalendarDays(today, 6);
  const monthEnd = addManilaCalendarDays(today, 30);

  const interviewsQuery = useQuery({
    queryKey: ["ta", "compliance", "interviews", "upcoming", today, weekEnd],
    // The server keeps only interviews scheduled inside the window, so older or unscheduled rows cannot crowd them out.
    queryFn: ({ signal }) =>
      taApi.listInterviewCompliancePage(
        { page: 1, pageSize: 50, scheduledOnly: true, from: today, to: weekEnd, sortField: "scheduledAt", sortDirection: "asc" },
        { signal },
      ),
    staleTime: 60_000,
    ...QUERY,
  });

  const alertsQuery = useQuery({
    queryKey: ["ta", "employee-credential-alerts"],
    queryFn: employeesApi.getCredentialAlerts,
    staleTime: 60_000,
    ...QUERY,
  });

  const sources = [interviewsQuery, alertsQuery, deploymentsQuery] as UseQueryResult<unknown>[];
  const loading = sources.some((q) => q.isPending && !q.isError);
  const failed = sources.filter((q) => q.isError && !q.isFetching);

  const deployments = deploymentsQuery.data ?? [];
  const sections: Section[] = [];

  const interviews = (interviewsQuery.data?.items ?? [])
    // Only rows with a scheduled interview have a real interview date.
    .filter((row) => row.interviewId != null)
    .map((row) => ({ row, day: toManilaDateInput(row.scheduledAt) }))
    .filter(({ day }) => day >= today && day <= weekEnd)
    .sort((a, b) => a.row.scheduledAt.localeCompare(b.row.scheduledAt));
  sections.push({
    key: "interviews",
    label: "Interviews in the next 7 days",
    seeAll: { to: "/ta/interviews" },
    items: interviews.map(({ row }) => ({
      key: `i-${row.interviewId}`,
      title: row.candidateName,
      detail: row.jobTitle,
      when: formatDate(row.scheduledAt),
      target: { to: "/ta/interviews" },
    })),
  });

  sections.push({
    key: "contracts",
    label: "Contracts ending in 30 days",
    seeAll: WORKFORCE_DEPLOYMENTS,
    items: deploymentsBetween(deployments, (d) => d.contractEnd, today, monthEnd).map(({ dep }) => ({
      key: `e-${dep.id}`,
      title: workerName(dep),
      detail: dep.client?.name,
      when: formatDate(dep.contractEnd),
      target: deploymentTarget(dep),
    })),
  });

  // The document alerts page has no route of its own, so rows open the employee record.
  sections.push({
    key: "documents",
    label: "Documents to renew",
    seeAll: { to: "/ta/workforce", search: { tab: "employees" } },
    items: (alertsQuery.data ?? [])
      .filter((a) => (a.alertType === "EXPIRED" || a.alertType === "EXPIRING_SOON") && a.expiresAt)
      .sort((a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)))
      .map((a) => ({
        key: `d-${a.requirementId}`,
        title: a.employeeName,
        detail: a.documentLabel,
        when: `${a.alertType === "EXPIRED" ? "Expired" : "Expires"} ${formatDate(a.expiresAt)}`,
        target: { to: "/ta/employees/$employeeId", params: { employeeId: String(a.employeeId) } },
      })),
  });

  const visible = sections.filter((s) => s.items.length > 0);

  return (
    <section aria-label="Coming up" className="overflow-hidden rounded-md border border-slate-300 bg-white">
      <div className="flex min-h-12 items-center border-b border-slate-300 bg-slate-100 px-3.5 py-1.5">
        <h2 className="text-sm font-semibold text-slate-950">Coming up</h2>
      </div>
      {loading ? (
        <div role="status" aria-label="Loading section" className="divide-y divide-slate-200 motion-safe:animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 space-y-1.5 px-3.5 py-2.5">
              <div className="h-3.5 w-1/3 bg-slate-200" />
            </div>
          ))}
          <span className="sr-only">Loading information</span>
        </div>
      ) : (
        <>
          {failed.length > 0 && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950">
              <span>Some items could not be loaded, so this list may be incomplete.</span>
              <Button variant="outline" size="sm" onClick={() => failed.forEach((q) => { void q.refetch(); })}>
                Try again
              </Button>
            </div>
          )}
          {visible.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:[&>*:nth-child(odd)]:border-r lg:[&>*:nth-child(odd)]:border-slate-200">
              {visible.map((section) => <SectionBlock key={section.key} section={section} />)}
            </div>
          )}
          {visible.length === 0 && failed.length === 0 && (
            <p className="px-3.5 py-4 text-sm text-slate-600">
              No upcoming items in the periods shown.
            </p>
          )}
        </>
      )}
    </section>
  );
};
