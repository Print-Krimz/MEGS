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
  BackoutPanel,
  KpiGroup,
  KpiRow,
  OperationsWorkspace,
  RequestProgressList,
  StagePipeline,
  StuckList,
} from "../../components/analytics";
import type { RequestHealthFilter } from "../../components/analytics";
import { filtersToSearch, parseTAReportSearch, searchToFilters, type AdminReportSearch } from "../../lib/admin-report-search";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import { formatDate } from "../../lib/utils";
import { TA_COPY } from "../../lib/ta-copy";

const plural = (count: number, word: string) => (count === 1 ? word : `${word}s`);

const KPI_DEFINITIONS = [
  { label: "Overdue candidates", definition: "Candidates past the days allowed for their stage, including ones estimated from application date." },
  { label: "Open requests", definition: "Requests still needing workers." },
  { label: "Starts", definition: "Workers who started work." },
  { label: "Days to fill", definition: "Typical days from request opened to worker start." },
  { label: "Backout rate", definition: "Workers who backed out after client review, out of those plus starts." },
];

const rangeText = (start: string, end: string) => `${formatDate(start)} to ${formatDate(end)}`;

type WorkspaceKey = "waiting" | "requests";
type WaitingFocus = { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
type RequestFocus = { health: RequestHealthFilter; nonce: number };

const scrollToWorkspace = () => setTimeout(() => document.getElementById("operations")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

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
  const [tab, setTabState] = useState<WorkspaceKey>(search.tab === "requests" ? "requests" : "waiting");
  useEffect(() => setTabState(search.tab === "requests" ? "requests" : "waiting"), [search.tab]);
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
  const label = rangeText(data.dateRange.startDate, data.dateRange.endDate);
  const isEmpty =
    kpis.activeApplicants === 0 && kpis.requisitions.total === 0 && kpis.placementsStarted === 0 && data.backouts.backouts === 0 && data.backouts.withdrawals === 0;
  const staleNote =
    kpis.staleFilledRequisitions > 0
      ? `${kpis.staleFilledRequisitions} marked filled with no placement. Left out of seat counts.`
      : undefined;

  return (
    <div className="space-y-5">
      {header}

      <AnalyticsFilterBar filters={filters} onChange={setFilters} options={data.filterOptions} showClientFilter />

      <p role="status" aria-live="polite" className="sr-only">
        {dashboardQuery.isFetching ? "Updating the numbers" : ""}
      </p>

      <div className={`space-y-5 transition-opacity ${dashboardQuery.isFetching ? "opacity-70" : ""}`}>
        <AttentionStrip
          items={[
            { key: "overdue", count: kpis.overdueTotal, label: plural(kpis.overdueTotal, "overdue candidate"), href: "#operations", onSelect: () => showWaiting({}) },
            // The Overview already lists the tasks, so this chip goes there instead of repeating them here.
            { key: "tasks", count: data.pendingActionsTotal, label: `${plural(data.pendingActionsTotal, "task")} waiting on you`, href: "/ta", onSelect: () => void navigate({ to: "/ta" }) },
            { key: "late", count: kpis.lateRequests, label: `${plural(kpis.lateRequests, "request")} overdue or at risk`, href: "#operations", onSelect: () => showRequests("LATE") },
          ]}
        />

        <section aria-label="Headline numbers">
          <h2 className="sr-only">Headline numbers</h2>
          <KpiRow definitions={KPI_DEFINITIONS}>
            <KpiGroup label="Right now">
              <AnalyticsKpi
                label="Overdue candidates"
                value={kpis.overdueTotal}
                detail={`${kpis.overdueEstimated} estimated from application date`}
                href="#operations"
                onClick={() => showWaiting({})}
              />
              {/* No link: the request list also holds filled requests, so its count would not match this tile. */}
              <AnalyticsKpi label="Open requests" value={kpis.requisitions.open} detail={`${kpis.filledSeats} of ${kpis.requestedSeats} seats filled`} />
            </KpiGroup>
            <KpiGroup label="In these dates">
              {/* No link: /ta/deployments does not accept dates or request filters. */}
              <AnalyticsKpi
                label="Starts"
                value={kpis.placementsStarted}
                detail={`Days to fill: ${formatSampled(kpis.medianDaysToFill, kpis.daysToFillSample, "days")}`}
              />
              <AnalyticsKpi
                label="Backout rate"
                value={formatSampled(kpis.backoutRate, kpis.backoutRateBase, "%")}
                detail={`${kpis.backoutsAfterClientReview} of ${kpis.backoutRateBase} backed out after client review`}
                href="#backouts"
              />
            </KpiGroup>
          </KpiRow>
        </section>

        {isEmpty ? (
          <p className="border border-slate-300 bg-white p-6 text-center text-sm font-sans text-slate-700">Nothing recorded for these dates.</p>
        ) : (
          <>
            <StagePipeline
              rows={data.stageTable}
              footer={`Client answers: ${data.clientDecisions.accepted} accepted · ${data.clientDecisions.declined} declined`}
              onSelectStage={(picked) => {
                showWaiting({ stage: picked });
                scrollToWorkspace();
              }}
            />

            <OperationsWorkspace<WorkspaceKey>
              active={tab}
              onChange={setTab}
              tabs={[
                {
                  key: "waiting",
                  label: "Overdue candidates",
                  shortLabel: "Overdue",
                  count: data.stuckTotal,
                  content: (
                    <StuckList bare viewer="ta" showRecruiter={false} title="Overdue candidates" rows={data.stuck} total={data.stuckTotal} closedOpenings={kpis.closedOpenings} focus={waitingFocus} />
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

            <BackoutPanel data={data.backouts} rangeLabel={label} />
          </>
        )}
      </div>
    </div>
  );
};
