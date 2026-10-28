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
          detail={`${kpis.requisitions.overdue} overdue · ${kpis.requisitions.atRisk} at risk`}
          definition="Overdue is past the target date. At risk is due within 7 days with too few candidates."
          tone={kpis.requisitions.overdue > 0 ? "alert" : "default"}
          anchor="operations"
          onActivate={() => showRequests("OVERDUE")}
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
          { id: "late", label: "overdue requests", singular: "overdue request", count: kpis.requisitions.overdue, target: "operations", tone: "alert", onSelect: () => showRequests("OVERDUE") },
          { id: "orphaned", label: "no owner", singular: "no owner", count: noOwner, target: "operations", tone: "alert", onSelect: () => showRequests("UNOWNED") },
          { id: "no-opening", label: "no opening", singular: "no opening", count: noOpening, target: "operations", tone: "warn", onSelect: () => showRequests("NONE") },
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
