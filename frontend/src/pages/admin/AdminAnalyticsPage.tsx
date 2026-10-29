import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { PageHeader, LoadingState, ErrorState } from "../../components/common";
import { AnalyticsFilterBar, ExportMenu } from "../../components/analytics";
// Admin Reports uses its own status-first versions; the TA Reports page keeps the originals.
import {
  AnalyticsKpi,
  AttentionStrip,
  BackoutPanel,
  KpiRow,
  OperationsWorkspace,
  PlacementTrendChart,
  RequestProgressList,
  StagePipeline,
  StuckList,
  TeamTable,
  TeamWorkloadChart,
} from "../../components/analytics/admin";
import type { RequestHealthFilter } from "../../components/analytics/admin";
import {
  filtersToSearch,
  hasNoOpening,
  isLateRequest,
  parseAdminReportSearch,
  reportReturnState,
  searchToFilters,
  type AdminReportSearch,
} from "../../lib/admin-report-search";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import { formatDate } from "../../lib/utils";

const rangeText = (start: string, end: string) => `${formatDate(start)} to ${formatDate(end)}`;

type WorkspaceKey = "waiting" | "requests" | "recruiters";
type WaitingFocus = { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
type RequestFocus = { health: RequestHealthFilter; nonce: number };

const scrollToWorkspace = () => setTimeout(() => document.getElementById("operations")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

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
  const [tab, setTabState] = useState<WorkspaceKey>(search.tab ?? "waiting");
  useEffect(() => setTabState(search.tab ?? "waiting"), [search.tab]);
  // The nonce makes a second click on the same tile re-apply its filter after the list was changed by hand.
  const [nonce, setNonce] = useState(0);
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
  const allRequests = dashboardQuery.data?.requests;
  // A request with no recruiter is not listed. Nobody is working it, so there is nothing to follow up.
  const requests = useMemo(() => (allRequests ?? []).filter((r) => r.ownerId !== null), [allRequests]);

  const selectRecruiter = useCallback((recruiterId: string | undefined) => update({ recruiterId }), [update]);

  /** Open the waiting list with a filter applied. */
  const showWaiting = (focus: Omit<WaitingFocus, "nonce">) => {
    setNonce((n) => n + 1);
    update({ tab: "waiting", urgency: focus.urgency, stage: focus.stage, health: undefined });
  };
  /** Open the client requests with a status filter applied. */
  const showRequests = (health: RequestHealthFilter) => {
    setNonce((n) => n + 1);
    update({ tab: "requests", health, urgency: undefined, stage: undefined });
  };

  const header = (
    <PageHeader
      title="Reports"
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
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="space-y-5">
        {header}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} showClientFilter showRecruiterFilter />
        <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      </div>
    );
  }

  const data = dashboardQuery.data;
  const { kpis } = data;
  const label = rangeText(data.dateRange.startDate, data.dateRange.endDate);
  // Each count uses the same predicate and the same rows as the list it opens, so N here is N rows there.
  const overdueRequests = requests.filter((r) => r.health === "OVERDUE").length;
  const atRiskRequests = requests.filter((r) => r.health === "AT_RISK").length;
  const lateRequests = requests.filter(isLateRequest).length;
  const noOpening = requests.filter(hasNoOpening).length;
  const staleNote =
    kpis.staleFilledRequisitions > 0
      ? `${kpis.staleFilledRequisitions} marked filled with no placement. Left out of seat counts.`
      : undefined;
  const periodCaption = `Seats and late requests: today · Others: ${label}`;

  return (
    <div className="space-y-5">
      {header}

      <AnalyticsFilterBar filters={filters} onChange={setFilters} options={data.filterOptions} showClientFilter showRecruiterFilter />

      <p role="status" aria-live="polite" className="sr-only">
        {dashboardQuery.isFetching ? "Updating the numbers" : ""}
      </p>

      <div className={`space-y-5 transition-opacity ${dashboardQuery.isFetching ? "opacity-70" : ""}`}>
      <KpiRow columns="md:grid-cols-5" caption={periodCaption}>
        <AnalyticsKpi
          label="Seats filled"
          value={kpis.requestedSeats === 0 ? "—" : `${kpis.fillRate}%`}
          detail={`${kpis.filledSeats} of ${kpis.requestedSeats} seats · ${kpis.openSeats} open`}
          definition="Seats held by a placement, out of seats requested."
          anchor="operations"
          onActivate={() => showRequests("ALL")}
        />
        <AnalyticsKpi
          label="Late requests"
          value={lateRequests}
          detail={`${overdueRequests} overdue · ${atRiskRequests} at risk`}
          definition="Overdue is past the target date. At risk is due within 7 days with too few candidates."
          tone={overdueRequests > 0 ? "alert" : "default"}
          anchor="operations"
          onActivate={() => showRequests("LATE")}
        />
        <AnalyticsKpi
          label="Starts"
          value={kpis.placementsStarted}
          detail={`${kpis.newStarts} new · ${kpis.redeployStarts} redeployed`}
          definition="Workers whose start date falls in the selected dates."
          anchor="trend"
        />
        <AnalyticsKpi
          label="Days to fill"
          value={kpis.medianDaysToFill === null ? "—" : kpis.medianDaysToFill}
          detail={kpis.daysToFillSample === 0 ? "No starts" : `Median, ${kpis.daysToFillSample} ${kpis.daysToFillSample === 1 ? "start" : "starts"}`}
          definition="Days from request opened to worker start."
        />
        <AnalyticsKpi
          label="Backout rate"
          value={kpis.backoutRateBase === 0 ? "—" : `${kpis.backoutRate}%`}
          detail={`${kpis.backoutsAfterClientReview} of ${kpis.backoutRateBase}`}
          definition="Backouts after client review, out of those plus starts."
          tone={kpis.backoutRate >= 20 ? "alert" : "default"}
          anchor="backouts"
        />
      </KpiRow>

      <StagePipeline
        rows={data.stageTable}
        rangeLabel={label}
        onSelectStage={(stage) => {
          showWaiting({ stage });
          scrollToWorkspace();
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        <TeamWorkloadChart rows={data.team} selectedRecruiterId={filters.recruiterId} onSelectRecruiter={selectRecruiter} />
        <PlacementTrendChart trend={data.trend} rangeLabel={label} />
      </div>

      <AttentionStrip
        items={[
          { id: "critical", label: "critical waits", singular: "critical wait", count: kpis.criticalCandidates, target: "operations", tone: "alert", onSelect: () => showWaiting({ urgency: "critical" }) },
          { id: "late", label: "overdue requests", singular: "overdue request", count: overdueRequests, target: "operations", tone: "alert", onSelect: () => showRequests("OVERDUE") },
          { id: "no-opening", label: "no opening", singular: "no opening", count: noOpening, target: "operations", tone: "warn", onSelect: () => showRequests("NO_OPENING") },
          { id: "stale", label: "filled, no placement", singular: "filled, no placement", count: kpis.staleFilledRequisitions, target: "requests-note", tone: "warn", onSelect: () => showRequests("ALL") },
        ]}
      />

      <OperationsWorkspace<WorkspaceKey>
        active={tab}
        onChange={setTab}
        tabs={[
          {
            key: "waiting",
            label: "Waiting",
            shortLabel: "Waiting",
            count: data.stuckTotal,
            content: <StuckList bare rows={data.stuck} total={data.stuckTotal} closedOpenings={kpis.closedOpenings} focus={waitingFocus} linkState={waitingReturn} />,
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
            content: <TeamTable bare rows={data.team} rangeLabel={label} selectedRecruiterId={filters.recruiterId} onSelectRecruiter={selectRecruiter} />,
          },
        ]}
      />

      <BackoutPanel data={data.backouts} clientDecisions={data.clientDecisions} rangeLabel={label} showStageBars compact />
      </div>
    </div>
  );
};
