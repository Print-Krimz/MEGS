import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatSampled } from "../../lib/analytics-format";
import { adminApi } from "../../lib/api/admin.api";
import { notify } from "../../lib/feedback";
import { PageHeader, LoadingState, ErrorState } from "../../components/common";
import {
  AnalyticsFilterBar,
  ExportMenu,
  AnalyticsKpi,
  AttentionStrip,
  BackoutReasonsDonut,
  ClientReviewPanel,
  KpiGroup,
  KpiRow,
  OperationsWorkspace,
  LineChart,
  RequestProgressList,
  StagePipeline,
  StuckList,
  TeamTable,
} from "../../components/analytics";
import type { RequestHealthFilter, StuckBulkAction, StuckRowAction } from "../../components/analytics";
import {
  filtersToSearch,
  parseAdminReportSearch,
  reportReturnState,
  searchToFilters,
  type AdminReportSearch,
} from "../../lib/admin-report-search";
import type { AnalyticsFilterState, StuckCandidate } from "../../lib/types/analytics.types";
import { scrollToId } from "../../lib/scroll-to";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { BellRing, X } from "lucide-react";

const plural = (count: number, word: string) => (count === 1 ? word : `${word}s`);

const KPI_DEFINITIONS = [
  { label: "Seats filled", definition: "Seats with a worker who started, out of seats clients asked for." },
  { label: "Open requests", definition: "Requests still needing workers." },
  { label: "Client review wait", definition: "Average days candidates have been waiting for the client's answer, across all clients." },
  { label: "Days to fill", definition: "Typical days from request opened to worker start, compared with the previous dates of the same length." },
  { label: "Critical wait", definition: "Overdue by twice the days allowed or more." },
  { label: "Overdue request", definition: "Open request past its target date, or due within 7 days with too few candidates." },
];

type WorkspaceKey = "waiting" | "requests" | "recruiters";
type WaitingFocus = { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
type RequestFocus = { health: RequestHealthFilter; nonce: number };

/** Asks the recruiters who hold these candidates to follow up. Throws after telling the person, so the list keeps its selection. */
const remindRecruiters = async (picked: StuckCandidate[]) => {
  const ids = picked.map((r) => r.applicationId);
  let reminded = 0;
  let candidates = 0;
  let skipped = 0;
  try {
    // The server takes at most 100 ids per call.
    for (let i = 0; i < ids.length; i += 100) {
      const result = await adminApi.remindRecruiters(ids.slice(i, i + 100));
      reminded += result.reminded;
      candidates += result.candidates;
      skipped += result.skipped;
    }
  } catch (error) {
    notify.error("The reminder was not sent. Try again.", error);
    throw error;
  }
  if (reminded === 0) {
    notify.error("No one was reminded. These candidates have no recruiter.");
    throw new Error("No recruiter to remind");
  }
  const noOwner = skipped > 0 ? ` ${skipped} ${plural(skipped, "candidate")} with no recruiter left out.` : "";
  notify.success(`Reminded ${reminded} ${plural(reminded, "recruiter")} about ${candidates} ${plural(candidates, "candidate")}.${noOwner}`);
};
const BULK_ACTIONS: StuckBulkAction[] = [{ key: "remind", label: "Remind recruiters", icon: BellRing, run: remindRecruiters }];

const scrollToWorkspace = () => setTimeout(() => scrollToId("operations"), 0);

export const AdminAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => parseAdminReportSearch(rawSearch), [rawSearch]);
  // Keyed on the filter fields only, so a tab or focus change does not hand every chart a new filters object.
  const { range, startDate, endDate, clientId, mrfId, jobPostingId, recruiterId } = search;
  const filters = useMemo(
    () => searchToFilters({ range, startDate, endDate, clientId, mrfId, jobPostingId, recruiterId }),
    [range, startDate, endDate, clientId, mrfId, jobPostingId, recruiterId],
  );
  // Tab switches paint from local state at once; the URL catches up after that paint.
  const urlTab: WorkspaceKey = search.tab === undefined || search.tab === "actions" ? "waiting" : search.tab;
  const [tab, setTabState] = useState<WorkspaceKey>(urlTab);
  useEffect(() => setTabState(urlTab), [urlTab]);
  // The nonce makes a second click on the same tile re-apply its filter after the list was changed by hand.
  const [nonce, setNonce] = useState(0);
  // After a chip or tile opens a tab, focus moves to that panel's heading so a keyboard or screen reader user lands on the list.
  const [focusRequest, setFocusRequest] = useState<{ tab: WorkspaceKey; id: number } | null>(null);
  useEffect(() => {
    if (!focusRequest) return;
    document.getElementById(`operations-panel-${focusRequest.tab}`)?.focus({ preventScroll: true });
  }, [focusRequest]);
  const { urgency, stage, health } = search;
  // Memoized so a tab switch does not re-render the 1,000-row lists through new prop objects.
  const waitingFocus = useMemo<WaitingFocus | undefined>(
    () => (urgency || stage ? { urgency, stage, nonce } : undefined),
    [urgency, stage, nonce],
  );
  const requestFocus = useMemo<RequestFocus | undefined>(() => (health ? { health, nonce } : undefined), [health, nonce]);
  // Each list returns to its own tab, so the return state ignores the open tab and survives tab switches unchanged.
  const { tab: _openTab, ...searchWithoutTab } = search;
  const returnKey = JSON.stringify(searchWithoutTab);
  const waitingReturn = useMemo(() => reportReturnState({ ...JSON.parse(returnKey), tab: "waiting" }), [returnKey]);
  const requestsReturn = useMemo(() => reportReturnState({ ...JSON.parse(returnKey), tab: "requests" }), [returnKey]);
  const searchRef = useRef(search);
  searchRef.current = search;

  /** Writes the report state to the URL. Filter changes drop any list focus, as before. */
  const update = useCallback(
    (patch: Partial<AdminReportSearch>, replace = false) => {
      void navigate({
        to: "/admin/analytics",
        search: parseAdminReportSearch({ ...searchRef.current, ...patch }) as never,
        replace,
        // Report state lives in the URL; a chip, tile or tab click must not jump the page back to the top.
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setFilters = (next: AnalyticsFilterState) => update({ ...filtersToSearch(next), health: undefined, urgency: undefined, stage: undefined });
  const setTab = (key: WorkspaceKey) => {
    setTabState(key);
    // A router navigation re-renders the whole layout; running it after the next paint keeps the click responsive.
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (window.location.pathname === "/admin/analytics") update({ tab: key }, true);
      }, 0),
    );
  };

  const dashboardQuery = useQuery({
    queryKey: ["admin", "analytics", "dashboard", filters],
    queryFn: ({ signal }) => adminApi.getDashboardSummary(filters, signal),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
  // Every request is listed, including ones with no recruiter, so the list, the Seats filled tile and the export agree.
  const requests = dashboardQuery.data?.requests ?? [];

  const selectRecruiter = useCallback((recruiterId: string | undefined) => update({ recruiterId }), [update]);
  // Stable between renders, so a tab switch does not re-render the overdue list.
  const rowActions = useMemo<StuckRowAction[]>(
    () => [
      { key: "remind", label: "Remind", run: (r) => remindRecruiters([r]) },
      ...(recruiterId ? [] : [{ key: "filter", label: "Filter by recruiter", run: (r: StuckCandidate) => selectRecruiter(r.recruiterId) }]),
    ],
    [recruiterId, selectRecruiter],
  );

  /** Open the waiting list with a filter applied. */
  const showWaiting = (focus: Omit<WaitingFocus, "nonce">) => {
    setNonce((n) => n + 1);
    setTabState("waiting");
    setFocusRequest({ tab: "waiting", id: nonce + 1 });
    update({ tab: "waiting", urgency: focus.urgency, stage: focus.stage, health: undefined });
  };
  /** Open the client requests with a status filter applied. */
  const showRequests = (health: RequestHealthFilter) => {
    setNonce((n) => n + 1);
    setTabState("requests");
    setFocusRequest({ tab: "requests", id: nonce + 1 });
    update({ tab: "requests", health, urgency: undefined, stage: undefined });
  };

  const asOf = dashboardQuery.dataUpdatedAt
    ? `As of ${new Date(dashboardQuery.dataUpdatedAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}`
    : undefined;

  const header = (
    <PageHeader
      title="Reports"
      description={asOf}
      flush
      breadcrumbs={[{ label: "Administration", href: "/admin" }, { label: "Reports" }]}
      actions={
        <ExportMenu
          fileNamePrefix="MEGS_Admin"
          onExport={(report, format) =>
            report === "pipeline" ? adminApi.exportPipelineReport(format, filters) : adminApi.exportDeploymentReport(format, filters)
          }
        />
      }
    />
  );

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-5">
        {header}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} showClientFilter showRecruiterFilter />
        <div className="h-11 animate-pulse border border-slate-300 bg-white" aria-hidden="true" />
        <LoadingState variant="cards" rows={4} className="lg:grid-cols-4" />
        <div className="h-60 animate-pulse border border-slate-300 bg-white" aria-hidden="true" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="space-y-5">
        {header}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} showClientFilter showRecruiterFilter />
        <ErrorState compact subject="the reports" error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      </div>
    );
  }

  const data = dashboardQuery.data;
  const { kpis } = data;
  const recruiterName = filters.recruiterId
    ? formatRecruiterName(
        data.filterOptions.recruiters.find((r) => r.id === filters.recruiterId)?.name ||
          data.team.find((t) => t.recruiterId === filters.recruiterId)?.name ||
          data.filterOptions.recruiters.find((r) => r.id === filters.recruiterId)?.email
      ).label
    : "";
  // Each count uses the same predicate and the same rows as the list it opens, so N here is N rows there.
  const isEmpty =
    kpis.activeApplicants === 0 && kpis.requisitions.total === 0 && kpis.placementsStarted === 0 && data.backouts.backouts === 0 && data.backouts.withdrawals === 0;
  const clientsOverLimit = data.clientReview.clients.filter((c) => c.avgDays !== null && c.avgDays > c.limitDays).length;
  const staleNote =
    kpis.staleFilledRequisitions > 0
      ? `${kpis.staleFilledRequisitions} marked filled with no start. Left out of seat counts.`
      : undefined;

  return (
    <div className="space-y-5">
      {header}

      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        options={data.filterOptions}
        showClientFilter
        showRecruiterFilter
        footer={
          <AttentionStrip
            embedded
            items={[
              { key: "critical", count: kpis.criticalCandidates, label: plural(kpis.criticalCandidates, "critical wait"), href: "#operations", onSelect: () => showWaiting({ urgency: "critical" }) },
              { key: "late", count: kpis.lateRequests, label: `overdue or at-risk ${plural(kpis.lateRequests, "request")}`, href: "#operations", onSelect: () => showRequests("LATE") },
              { key: "review", count: clientsOverLimit, label: `${plural(clientsOverLimit, "client")} past the review limit`, href: "#client-review" },
              { key: "stale", count: kpis.staleFilledRequisitions, label: `${plural(kpis.staleFilledRequisitions, "request")} filled with no start`, href: "#requests-note", tone: "watch", onSelect: () => showRequests("ALL") },
            ]}
          />
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {dashboardQuery.isPlaceholderData ? "Updating the numbers" : ""}
      </p>

      {/* Dim only while a filter change loads (old numbers on screen), not on a quiet background refresh. */}
      <div className={`space-y-5 transition-opacity ${dashboardQuery.isPlaceholderData ? "opacity-70" : ""}`}>
      {isEmpty ? (
        <div className="border border-slate-300 bg-white p-6 text-center text-sm font-sans text-slate-700">
          <p>Nothing recorded for these dates. Try a longer range.</p>
          {filters.range === "7d" && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, range: "30d" })}
              className="mt-3 inline-flex min-h-11 items-center border border-navy px-3 text-xs font-semibold text-navy hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
            >
              Last 30 days
            </button>
          )}
        </div>
      ) : (
        <>

          <section aria-label="Headline numbers">
            <h2 className="sr-only">Headline numbers</h2>
            <KpiRow definitions={KPI_DEFINITIONS}>
              <KpiGroup label="Right now">
                <AnalyticsKpi
                  label="Seats filled"
                  value={kpis.requestedSeats === 0 ? "No seats" : formatSampled(kpis.fillRate, kpis.requestedSeats, "%")}
                  detail={kpis.requestedSeats === 0 ? "No open requests" : `${kpis.filledSeats} of ${kpis.requestedSeats} filled · ${kpis.openSeats} open`}
                  href="#operations"
                  onClick={() => showRequests("ALL")}
                />
                {/* No link: the request list also holds filled requests, so its count would not match this tile. */}
                <AnalyticsKpi label="Open requests" value={kpis.requisitions.open} detail={`${kpis.lateRequests} overdue or at risk`} />
                <AnalyticsKpi
                  label="Client review wait"
                  value={formatSampled(data.clientReview.avgDays, data.clientReview.sample, "days")}
                  detail={clientsOverLimit > 0 ? `${clientsOverLimit} ${plural(clientsOverLimit, "client")} past their limit` : "Average across clients in review"}
                  tone={clientsOverLimit > 0 ? "alert" : "default"}
                  href="#client-review"
                />
              </KpiGroup>
              <KpiGroup label="In these dates">
                <AnalyticsKpi
                  label="Days to fill"
                  value={formatSampled(kpis.medianDaysToFill, kpis.daysToFillSample, "days")}
                  detail={kpis.daysToFillSample === 0 ? "No starts" : `Typical, from ${kpis.daysToFillSample} ${kpis.daysToFillSample === 1 ? "start" : "starts"}`}
                  delta={{ current: kpis.medianDaysToFill, previous: data.previousPeriod.medianDaysToFill, unit: "days", better: "down", periodLabel: `previous ${data.dateRange.days} days` }}
                />
              </KpiGroup>
            </KpiRow>
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* The trend sits under the stages and takes the rest of the column. LineChart is h-full, so it needs a sized
                wrapper; without one it took the whole row height and ran over the worklist below. */}
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
              <StagePipeline
                rows={data.stageTable}
                footer={`Client answers: ${data.clientDecisions.accepted} accepted, ${data.clientDecisions.declined} declined`}
                onSelectStage={(stage) => {
                  showWaiting({ stage });
                  scrollToWorkspace();
                }}
              />
              <div className="flex-1">
              <LineChart
                id="trend"
                title="Results over time"
                subtitle={`${data.trend.granularity === "day" ? "Daily" : data.trend.granularity === "week" ? "Weekly" : "Monthly"}. Backouts are people who left after the client reviewed them.`}
                points={data.trend.points.map((p) => ({ label: p.label, values: { starts: p.starts, backouts: p.backouts } }))}
                series={[{ key: "starts", label: "Starts" }, { key: "backouts", label: "Backed out" }]}
                emptyText="No starts or backouts in these dates."
              />
              </div>
            </div>
            {/* Both side panels grow so the column ends level with the stages and trend on the left. */}
            <div className="flex min-w-0 flex-col gap-5">
              <ClientReviewPanel data={data.clientReview} className="flex-1" />
              <BackoutReasonsDonut data={data.backouts} className="flex-1" />
            </div>
          </div>

          <OperationsWorkspace<WorkspaceKey>
            banner={
              filters.recruiterId ? (
                <div role="status" className="flex items-center justify-between gap-3 border-b border-navy-line bg-navy-soft px-3 py-2 text-xs text-slate-800">
                  <span>
                    Filtered by recruiter: <strong>{recruiterName}</strong>
                  </span>
                  <button
                    type="button"
                    aria-label="Clear recruiter filter"
                    onClick={() => selectRecruiter(undefined)}
                    className="inline-flex min-h-11 items-center gap-1 px-2 font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
                  >
                    <X size={14} aria-hidden="true" />
                    Clear
                  </button>
                </div>
              ) : undefined
            }
            active={tab}
            onChange={setTab}
            tabs={[
              {
                key: "waiting",
                label: "Overdue candidates",
                shortLabel: "Overdue",
                count: data.stuckTotal,
                content: <StuckList bare title="Overdue candidates" rows={data.stuck} total={data.stuckTotal} closedOpenings={kpis.closedOpenings} focus={waitingFocus} linkState={waitingReturn} selectable bulkActions={BULK_ACTIONS} rowActions={rowActions} />,
              },
              {
                key: "requests",
                label: "Client requests",
                shortLabel: "Requests",
                count: requests.length,
                content: <RequestProgressList bare rows={requests} linkTo="/admin/mrfs/$mrfId" note={staleNote} focus={requestFocus} linkState={requestsReturn} />,
              },
              {
                key: "recruiters",
                label: "Recruiters",
                shortLabel: "Recruiters",
                count: data.team.length,
                content: <TeamTable bare rows={data.team} selectedRecruiterId={filters.recruiterId} onSelectRecruiter={selectRecruiter} />,
              },
            ]}
          />
        </>
      )}
      </div>
    </div>
  );
};
