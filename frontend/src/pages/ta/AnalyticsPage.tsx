import React, { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader, LoadingState, ErrorState } from "../../components/common";
import {
  AnalyticsFilterBar,
  AnalyticsKpi,
  AttentionStrip,
  BackoutPanel,
  ClosurePanel,
  DropOffChart,
  ExportMenu,
  KpiRow,
  OperationsWorkspace,
  PendingActionsWidget,
  RequestProgressList,
  StagePipeline,
  StuckList,
} from "../../components/analytics";
import type { RequestHealthFilter } from "../../components/analytics";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import { formatDate } from "../../lib/utils";
import { TA_COPY } from "../../lib/ta-copy";

const rangeText = (start: string, end: string) => `${formatDate(start)} to ${formatDate(end)}`;

type WorkspaceKey = "pending" | "waiting" | "requests";
type WaitingFocus = { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
type RequestFocus = { health: RequestHealthFilter; nonce: number };

export const AnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilterState>({ range: "7d" });
  const [tab, setTab] = useState<WorkspaceKey>("pending");
  const [waitingFocus, setWaitingFocus] = useState<WaitingFocus>();
  const [requestFocus, setRequestFocus] = useState<RequestFocus>();

  const dashboardQuery = useQuery({
    queryKey: ["ta", "analytics", "dashboard", filters],
    queryFn: ({ signal }) => taApi.getDashboardSummary(filters, signal),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const showWaiting = (focus: Omit<WaitingFocus, "nonce">) => {
    setWaitingFocus((prev) => ({ ...focus, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab("waiting");
  };
  const showRequests = (health: RequestHealthFilter) => {
    setRequestFocus((prev) => ({ health, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab("requests");
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
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="space-y-5">
        {header}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} showClientFilter />
        <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      </div>
    );
  }

  const data = dashboardQuery.data;
  const { kpis } = data;
  const label = rangeText(data.dateRange.startDate, data.dateRange.endDate);
  const noCandidates = data.requests.filter((r) => r.attention === "NO_OPENING" || r.attention === "NO_APPLICANTS").length;
  const staleNote =
    kpis.staleFilledRequisitions > 0
      ? `${kpis.staleFilledRequisitions} of your requests ${kpis.staleFilledRequisitions === 1 ? "is" : "are"} marked filled with no placement behind ${kpis.staleFilledRequisitions === 1 ? "it" : "them"}. ${kpis.staleFilledRequisitions === 1 ? "It is" : "They are"} left out of the seat counts.`
      : undefined;

  return (
    <div className="space-y-5">
      {header}

      <AnalyticsFilterBar filters={filters} onChange={setFilters} options={data.filterOptions} showClientFilter />

      <p role="status" aria-live="polite" className={dashboardQuery.isFetching ? "text-xs text-slate-500 font-sans" : "sr-only"}>
        {dashboardQuery.isFetching ? "Updating the numbers…" : ""}
      </p>

      <KpiRow columns="md:grid-cols-5">
        <AnalyticsKpi
          label="Active applicants"
          kind="now"
          value={kpis.activeApplicants}
          detail={kpis.unlinkedApplicants > 0 ? `${kpis.unlinkedApplicants} on openings with no request` : "In the pipeline now"}
          definition="Candidates on your openings who are between application and start, not yet deployed."
          to="/ta/applications"
        />
        <AnalyticsKpi
          label="Open requests"
          kind="now"
          value={kpis.requisitions.open}
          detail={`${kpis.filledSeats} of ${kpis.requestedSeats} seats filled`}
          definition="Your client requests that still have seats to fill."
          to="/ta/mrfs"
        />
        <AnalyticsKpi
          label="Overdue candidates"
          kind="now"
          value={kpis.overdueCandidates}
          detail={kpis.overdueEstimated > 0 ? `+${kpis.overdueEstimated} by application age only` : "Past their stage limit"}
          definition="Candidates who have waited longer than the allowed days for their stage."
          tone={kpis.overdueCandidates > 0 ? "alert" : "default"}
          anchor="operations"
          onActivate={() => showWaiting({})}
        />
        <AnalyticsKpi
          label="Starts"
          kind="period"
          value={kpis.placementsStarted}
          detail={`${kpis.newStarts} new · ${kpis.redeployStarts} redeployed`}
          definition="Workers whose actual start date falls in the selected dates."
          to="/ta/deployments"
        />
        <AnalyticsKpi
          label="Backouts"
          kind="period"
          value={kpis.backoutsAfterClientReview}
          detail={`${data.backouts.withdrawals} withdrew before client review`}
          definition="Candidates who left after the client reviewed them, in the selected dates."
          tone={kpis.backoutsAfterClientReview > 0 ? "alert" : "default"}
          anchor="backouts"
        />
      </KpiRow>

      <AttentionStrip
        items={[
          { id: "waiting", label: "candidates past their stage limit", singular: "candidate past their stage limit", count: data.stuckTotal, target: "operations", tone: "alert", onSelect: () => showWaiting({}) },
          { id: "pending", label: "tasks waiting on you", singular: "task waiting on you", count: data.pendingActionsTotal, target: "operations", tone: "warn", onSelect: () => setTab("pending") },
          { id: "late", label: "requests past their target date", singular: "request past its target date", count: kpis.requisitions.overdue, target: "operations", tone: "alert", onSelect: () => showRequests("OVERDUE") },
          { id: "empty", label: "open requests with no candidates", singular: "open request with no candidates", count: noCandidates, target: "operations", tone: "warn", onSelect: () => showRequests("NONE") },
        ]}
      />

      <OperationsWorkspace<WorkspaceKey>
        active={tab}
        onChange={setTab}
        showCounts={false}
        tabs={[
          {
            key: "pending",
            label: "Pending work",
            shortLabel: "Pending",
            count: data.pendingActionsTotal,
            content: <PendingActionsWidget bare actions={data.pendingActions} total={data.pendingActionsTotal} />,
          },
          {
            key: "waiting",
            label: "Overdue candidates",
            shortLabel: "Overdue",
            count: data.stuckTotal,
            content: <StuckList bare viewer="ta" rows={data.stuck} total={data.stuckTotal} closedOpenings={kpis.closedOpenings} focus={waitingFocus} />,
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

      <StagePipeline rows={data.stageTable} rangeLabel={label} linkStages />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <DropOffChart rows={data.dropOff} rangeLabel={label} />
        <BackoutPanel data={data.backouts} clientDecisions={data.clientDecisions} rangeLabel={label} showRecent compact />
      </div>

      {data.closures && <ClosurePanel data={data.closures} rangeLabel={label} />}
    </div>
  );
};
