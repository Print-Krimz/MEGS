import React, { useCallback, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { PageHeader, LoadingState, ErrorState } from "../../components/common";
import {
  AnalyticsFilterBar,
  AnalyticsKpi,
  AttentionStrip,
  BackoutPanel,
  ExportMenu,
  KpiRow,
  OperationsWorkspace,
  PlacementTrendChart,
  RequestProgressList,
  StagePipeline,
  StuckList,
  TeamTable,
  TeamWorkloadChart,
} from "../../components/analytics";
import type { RequestHealthFilter } from "../../components/analytics";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import { formatDate } from "../../lib/utils";

const rangeText = (start: string, end: string) => `${formatDate(start)} to ${formatDate(end)}`;

type WorkspaceKey = "waiting" | "requests" | "recruiters";
type WaitingFocus = { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
type RequestFocus = { health: RequestHealthFilter; nonce: number };

const scrollToWorkspace = () => setTimeout(() => document.getElementById("operations")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

export const AdminAnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilterState>({ range: "7d" });
  const [tab, setTab] = useState<WorkspaceKey>("waiting");
  const [waitingFocus, setWaitingFocus] = useState<WaitingFocus>();
  const [requestFocus, setRequestFocus] = useState<RequestFocus>();

  const dashboardQuery = useQuery({
    queryKey: ["admin", "analytics", "dashboard", filters],
    queryFn: ({ signal }) => adminApi.getDashboardSummary(filters, signal),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Stable, so the memoized recruiter lists do not re-render when only the open tab changes.
  const selectRecruiter = useCallback((recruiterId: string | undefined) => setFilters((f) => ({ ...f, recruiterId })), []);

  /** Open the waiting list with a filter applied. */
  const showWaiting = (focus: Omit<WaitingFocus, "nonce">) => {
    setWaitingFocus((prev) => ({ ...focus, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab("waiting");
  };
  /** Open the client requests with a status filter applied. */
  const showRequests = (health: RequestHealthFilter) => {
    setRequestFocus((prev) => ({ health, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab("requests");
  };

  const header = (
    <PageHeader
      title="Reports"
      flush
      description="Whether the team is delivering to clients, and who needs help."
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
  const lateRequests = kpis.requisitions.overdue + kpis.requisitions.atRisk;
  const noOwner = data.requests.filter((r) => r.ownerId === null && r.health !== "FILLED").length;
  const noOpening = data.requests.filter((r) => r.attention === "NO_OPENING").length;
  const staleNote =
    kpis.staleFilledRequisitions > 0
      ? `${kpis.staleFilledRequisitions} ${kpis.staleFilledRequisitions === 1 ? "request is" : "requests are"} marked filled but ${kpis.staleFilledRequisitions === 1 ? "has" : "have"} no placement behind ${kpis.staleFilledRequisitions === 1 ? "it" : "them"}. They are left out of the seat counts.`
      : undefined;

  return (
    <div className="space-y-5">
      {header}

      <AnalyticsFilterBar filters={filters} onChange={setFilters} options={data.filterOptions} showClientFilter showRecruiterFilter />

      <p role="status" aria-live="polite" className={dashboardQuery.isFetching ? "text-xs text-slate-500 font-sans" : "sr-only"}>
        {dashboardQuery.isFetching ? "Updating the numbers…" : ""}
      </p>

      <KpiRow columns="md:grid-cols-5">
        <AnalyticsKpi
          label="Seats filled"
          kind="now"
          value={kpis.requestedSeats === 0 ? "—" : `${kpis.fillRate}%`}
          detail={`${kpis.filledSeats} of ${kpis.requestedSeats} seats · ${kpis.openSeats} open`}
          definition="Seats a placement holds, out of seats requested on open requests and requests filled in these dates."
          anchor="operations"
          onActivate={() => showRequests("ALL")}
        />
        <AnalyticsKpi
          label="Late requests"
          kind="now"
          value={lateRequests}
          detail={`${kpis.requisitions.overdue} overdue · ${kpis.requisitions.atRisk} at risk`}
          definition="Overdue: past the target date. At risk: due within 7 days with too few candidates to fill the open seats."
          tone={kpis.requisitions.overdue > 0 ? "alert" : "default"}
          anchor="operations"
          onActivate={() => showRequests("OVERDUE")}
        />
        <AnalyticsKpi
          label="Starts"
          kind="period"
          value={kpis.placementsStarted}
          detail={`${kpis.newStarts} new · ${kpis.redeployStarts} redeployed`}
          definition="Workers whose actual start date falls in the selected dates. A redeployed worker counts once."
          anchor="trend"
        />
        <AnalyticsKpi
          label="Days to fill"
          kind="period"
          value={kpis.medianDaysToFill === null ? "—" : kpis.medianDaysToFill}
          detail={kpis.daysToFillSample === 0 ? "No starts with a request" : `Median of ${kpis.daysToFillSample} ${kpis.daysToFillSample === 1 ? "start" : "starts"}`}
          definition="Calendar days from the request being opened to the worker starting. 0 means the same day."
        />
        <AnalyticsKpi
          label="Backout rate"
          kind="period"
          value={kpis.backoutRateBase === 0 ? "—" : `${kpis.backoutRate}%`}
          detail={`${kpis.backoutsAfterClientReview} of ${kpis.backoutRateBase}`}
          definition="Backouts after client review, out of those backouts plus starts that came from an application."
          tone={kpis.backoutRate >= 20 ? "alert" : "default"}
          anchor="backouts"
        />
      </KpiRow>

      <AttentionStrip
        items={[
          { id: "critical", label: "critical waits", singular: "critical wait", count: kpis.criticalCandidates, target: "operations", tone: "alert", onSelect: () => showWaiting({ urgency: "critical" }) },
          { id: "late", label: "requests past their target date", singular: "request past its target date", count: kpis.requisitions.overdue, target: "operations", tone: "alert", onSelect: () => showRequests("OVERDUE") },
          { id: "orphaned", label: "open requests with no owner", singular: "open request with no owner", count: noOwner, target: "operations", tone: "alert", onSelect: () => showRequests("UNOWNED") },
          { id: "no-opening", label: "open requests with no opening", singular: "open request with no opening", count: noOpening, target: "operations", tone: "warn", onSelect: () => showRequests("NONE") },
          { id: "stale", label: "requests marked filled with no placement", singular: "request marked filled with no placement", count: kpis.staleFilledRequisitions, target: "requests-note", tone: "warn", onSelect: () => showRequests("ALL") },
        ]}
      />

      <OperationsWorkspace<WorkspaceKey>
        active={tab}
        onChange={setTab}
        tabs={[
          {
            key: "waiting",
            label: "Critical and waiting candidates",
            shortLabel: "Waiting",
            count: data.stuckTotal,
            content: <StuckList bare rows={data.stuck} total={data.stuckTotal} closedOpenings={kpis.closedOpenings} focus={waitingFocus} />,
          },
          {
            key: "requests",
            label: "Client requests",
            shortLabel: "Requests",
            count: data.requests.length,
            content: <RequestProgressList bare rows={data.requests} linkTo="/admin/mrfs/$mrfId" note={staleNote} focus={requestFocus} />,
          },
          {
            key: "recruiters",
            label: "All recruiters",
            shortLabel: "Recruiters",
            count: data.team.length,
            content: <TeamTable bare rows={data.team} rangeLabel={label} selectedRecruiterId={filters.recruiterId} onSelectRecruiter={selectRecruiter} />,
          },
        ]}
      />

      <StagePipeline
        rows={data.stageTable}
        rangeLabel={label}
        onSelectStage={(stage) => {
          showWaiting({ stage });
          scrollToWorkspace();
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <TeamWorkloadChart rows={data.team} selectedRecruiterId={filters.recruiterId} onSelectRecruiter={selectRecruiter} />
        <PlacementTrendChart trend={data.trend} rangeLabel={label} />
      </div>

      <BackoutPanel data={data.backouts} clientDecisions={data.clientDecisions} rangeLabel={label} showStageBars compact />
    </div>
  );
};
