import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { formatSampled } from "../../lib/analytics-format";
import { PageHeader, LoadingState, ErrorState } from "../../components/common";
import {
  AnalyticsFilterBar,
  ExportMenu,
  AnalyticsKpi,
  AttentionStrip,
  ActionItemsList,
  BackoutReasonsDonut,
  DueSoonList,
  KpiGroup,
  KpiRow,
  LineChart,
  OperationsWorkspace,
  RequestProgressList,
  StagePipeline,
  StuckList,
} from "../../components/analytics";
import type { RequestHealthFilter } from "../../components/analytics";
import { filtersToSearch, parseTAReportSearch, searchToFilters, type AdminReportSearch } from "../../lib/admin-report-search";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import { scrollToId } from "../../lib/scroll-to";
import { TA_COPY } from "../../lib/ta-copy";

const plural = (count: number, word: string) => (count === 1 ? word : `${word}s`);

const KPI_DEFINITIONS = [
  { label: "Overdue candidates", definition: "Candidates past the days allowed for their stage, including ones estimated from application date." },
  { label: "Open requests", definition: "Requests still needing workers." },
  { label: "Starts", definition: "Workers who started work, compared with the previous dates of the same length." },
  { label: "Backout rate", definition: "Workers who backed out after client review, out of those plus starts, compared with the previous dates of the same length." },
];

type WorkspaceKey = "waiting" | "requests" | "actions";
type WaitingFocus = { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
type RequestFocus = { health: RequestHealthFilter; nonce: number };

const scrollToWorkspace = () => setTimeout(() => scrollToId("operations"), 0);

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  // recruiterId and the Recruiters tab are dropped here: this page is always the signed-in recruiter's own work.
  const search = useMemo(() => parseTAReportSearch(rawSearch), [rawSearch]);
  const { range, startDate, endDate, clientId, mrfId, jobPostingId } = search;
  const filters = useMemo(
    () => searchToFilters({ range, startDate, endDate, clientId, mrfId, jobPostingId }),
    [range, startDate, endDate, clientId, mrfId, jobPostingId],
  );
  const urlTab: WorkspaceKey = search.tab === "requests" || search.tab === "actions" ? search.tab : "waiting";
  const [tab, setTabState] = useState<WorkspaceKey>(urlTab);
  useEffect(() => setTabState(urlTab), [urlTab]);
  const [nonce, setNonce] = useState(0);
  // After a chip or tile opens a tab, focus moves to that panel so a keyboard or screen reader user lands on the list.
  const [focusRequest, setFocusRequest] = useState<{ tab: WorkspaceKey; id: number } | null>(null);
  useEffect(() => {
    if (!focusRequest) return;
    document.getElementById(`operations-panel-${focusRequest.tab}`)?.focus({ preventScroll: true });
  }, [focusRequest]);
  const { urgency, stage, health } = search;
  const waitingFocus = useMemo<WaitingFocus | undefined>(() => (urgency || stage ? { urgency, stage, nonce } : undefined), [urgency, stage, nonce]);
  const requestFocus = useMemo<RequestFocus | undefined>(() => (health ? { health, nonce } : undefined), [health, nonce]);
  const searchRef = useRef(search);
  searchRef.current = search;

  const update = useCallback(
    (patch: Partial<AdminReportSearch>, replace = false) => {
      void navigate({
        to: "/ta/analytics",
        search: parseTAReportSearch({ ...searchRef.current, ...patch }) as never,
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
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (window.location.pathname === "/ta/analytics") update({ tab: key }, true);
      }, 0),
    );
  };

  const dashboardQuery = useQuery({
    queryKey: ["ta", "analytics", "dashboard", filters],
    queryFn: ({ signal }) => taApi.getDashboardSummary(filters, signal),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const showWaiting = (focus: Omit<WaitingFocus, "nonce">) => {
    setNonce((n) => n + 1);
    setTabState("waiting");
    setFocusRequest({ tab: "waiting", id: nonce + 1 });
    update({ tab: "waiting", urgency: focus.urgency, stage: focus.stage, health: undefined });
  };
  const showActions = () => {
    // With nothing in these dates the tabs are not on the page, so the chip goes to the Overview task list instead.
    if (isEmpty) {
      void navigate({ to: "/ta" });
      return;
    }
    setNonce((n) => n + 1);
    setTabState("actions");
    setFocusRequest({ tab: "actions", id: nonce + 1 });
    update({ tab: "actions", health: undefined, urgency: undefined, stage: undefined });
  };
  const showRequests = (next: RequestHealthFilter) => {
    setNonce((n) => n + 1);
    setTabState("requests");
    setFocusRequest({ tab: "requests", id: nonce + 1 });
    update({ tab: "requests", health: next, urgency: undefined, stage: undefined });
  };

  const asOf = dashboardQuery.dataUpdatedAt
    ? `As of ${new Date(dashboardQuery.dataUpdatedAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}`
    : undefined;

  const header = (
    <PageHeader
      title={TA_COPY.pageTitles.reports}
      description={asOf}
      breadcrumbs={[{ label: TA_COPY.navigation.overview, href: "/ta" }, { label: TA_COPY.navigation.reports }]}
      actions={
        <ExportMenu
          fileNamePrefix="MEGS_TA"
          onExport={(report, format) =>
            report === "pipeline" ? taApi.exportPipelineReport(format, filters) : taApi.exportDeploymentReport(format, filters)
          }
        />
      }
    />
  );

  // The filter bar stays on screen while loading or after an error so the filters can be changed to recover.
  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-5">
        {header}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} showClientFilter />
        <div className="h-11 animate-pulse border border-slate-300 bg-white" aria-hidden="true" />
        <LoadingState variant="cards" rows={4} className="lg:grid-cols-4" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="space-y-5">
        {header}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} showClientFilter />
        <ErrorState compact subject="the reports" error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      </div>
    );
  }

  const data = dashboardQuery.data;
  const { kpis } = data;
  const previousLabel = `previous ${data.dateRange.days} days`;
  const isEmpty =
    kpis.activeApplicants === 0 && kpis.requisitions.total === 0 && kpis.placementsStarted === 0 && data.backouts.backouts === 0 && data.backouts.withdrawals === 0;
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
        footer={
          <AttentionStrip
            embedded
            items={[
              { key: "overdue", count: kpis.overdueTotal, label: plural(kpis.overdueTotal, "overdue candidate"), href: "#operations", onSelect: () => showWaiting({ urgency: "ALL" }) },
              { key: "tasks", count: data.pendingActionsTotal, label: `${plural(data.pendingActionsTotal, "task")} waiting on you`, href: "#operations", tone: "watch", onSelect: showActions },
              { key: "late", count: kpis.lateRequests, label: `overdue or at-risk ${plural(kpis.lateRequests, "request")}`, href: "#operations", onSelect: () => showRequests("LATE") },
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
                    label="Overdue candidates"
                    value={kpis.overdueTotal}
                    detail={`${kpis.overdueEstimated} estimated from application date`}
                    href="#operations"
                    onClick={() => showWaiting({ urgency: "ALL" })}
                  />
                  {/* No link: the request list also holds filled requests, so its count would not match this tile. */}
                  <AnalyticsKpi label="Open requests" value={kpis.requisitions.open} detail={`${kpis.filledSeats} of ${kpis.requestedSeats} seats filled`} />
                </KpiGroup>
                <KpiGroup label="In these dates">
                  {/* No link: /ta/deployments does not accept dates or request filters. */}
                  <AnalyticsKpi
                    label="Starts"
                    value={kpis.placementsStarted}
                    detail={`${kpis.newStarts} new · ${kpis.redeployStarts} redeployed`}
                    delta={{ current: kpis.placementsStarted, previous: data.previousPeriod.placementsStarted, better: "up", periodLabel: previousLabel }}
                  />
                  <AnalyticsKpi
                    label="Backout rate"
                    value={formatSampled(kpis.backoutRate, kpis.backoutRateBase, "%")}
                    detail={`${kpis.backoutsAfterClientReview} of ${kpis.backoutRateBase} backed out after client review`}
                    delta={{ current: kpis.backoutRate, previous: data.previousPeriod.backoutRate, unit: "%", better: "down", periodLabel: previousLabel }}
                    href="#backout-reasons"
                  />
                </KpiGroup>
              </KpiRow>
            </section>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {/* Every panel in this row stretches to the row height so the three columns end on one line. */}
              <div className="min-w-0 md:col-span-2 lg:col-span-1">
                <StagePipeline
                  className="h-full"
                  rows={data.stageTable}
                  footer={`Client answers: ${data.clientDecisions.accepted} accepted, ${data.clientDecisions.declined} declined`}
                  onSelectStage={(picked) => {
                    showWaiting({ stage: picked });
                    scrollToWorkspace();
                  }}
                />
              </div>
              <div className="min-w-0">
                <LineChart
                  id="trend"
                  title="Starts and backouts"
                  subtitle={`${data.trend.granularity === "day" ? "Daily" : data.trend.granularity === "week" ? "Weekly" : "Monthly"}. Backouts are people who left after the client reviewed them.`}
                  points={data.trend.points.map((p) => ({ label: p.label, values: { starts: p.starts, backouts: p.backouts } }))}
                  series={[{ key: "starts", label: "Starts" }, { key: "backouts", label: "Backed out" }]}
                  emptyText="No starts or backouts in these dates."
                />
              </div>
              <div className="flex min-w-0 flex-col gap-5">
                <BackoutReasonsDonut data={data.backouts} />
                <DueSoonList rows={data.dueSoon} total={data.dueSoonTotal} viewer="ta" className="flex-1" />
              </div>
            </div>

            <OperationsWorkspace<WorkspaceKey>
              active={tab}
              onChange={setTab}
              tabs={[
                {
                  key: "actions",
                  label: "Action items",
                  shortLabel: "Tasks",
                  count: data.pendingActionsTotal,
                  content: <ActionItemsList bare rows={data.pendingActions} total={data.pendingActionsTotal} />,
                },
                {
                  key: "waiting",
                  label: "Overdue candidates",
                  shortLabel: "Overdue",
                  count: data.stuckTotal,
                  content: (
                    <StuckList bare viewer="ta" showRecruiter={false} title="Overdue candidates" rows={data.stuck} total={data.stuckTotal} closedOpenings={kpis.closedOpenings} focus={waitingFocus} selectable />
                  ),
                },
                {
                  key: "requests",
                  label: "Client requests",
                  shortLabel: "Requests",
                  count: data.requests.length,
                  content: <RequestProgressList bare rows={data.requests} linkTo="/ta/mrfs/$mrfId" showOwner={false} note={staleNote} focus={requestFocus} />,
                },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
};
