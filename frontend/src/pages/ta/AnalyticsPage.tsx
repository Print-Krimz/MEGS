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
import { PhoneCollapse } from "../../components/ta/overview/PhoneCollapse";
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
        <ErrorState compact subject="the reports" error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
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

      <p role="status" aria-live="polite" className="sr-only">
        {dashboardQuery.isFetching ? "Updating the numbers" : ""}
      </p>

      <div className={`space-y-5 transition-opacity ${dashboardQuery.isFetching ? "opacity-70" : ""}`}>
      <KpiRow columns="md:grid-cols-5" caption={`Applicants, requests and overdue: today · Others: ${label}`}>
        <AnalyticsKpi
          label="Active applicants"
          value={kpis.activeApplicants}
          detail={kpis.unlinkedApplicants > 0 ? `${kpis.unlinkedApplicants} on openings with no request` : "In the pipeline"}
          definition="Candidates between application and start."
          to="/ta/applications"
        />
        <AnalyticsKpi
          label="Open requests"
          value={kpis.requisitions.open}
          detail={`${kpis.filledSeats} of ${kpis.requestedSeats} seats filled`}
          definition="Your requests with seats left to fill."
          to="/ta/mrfs"
        />
        <AnalyticsKpi
          label="Overdue candidates"
          value={kpis.overdueCandidates}
          detail={kpis.overdueEstimated > 0 ? `+${kpis.overdueEstimated} by application age only` : "Past stage limit"}
          definition="Candidates waiting longer than their stage allows."
          tone={kpis.overdueCandidates > 0 ? "alert" : "default"}
          anchor="operations"
          onActivate={() => showWaiting({})}
        />
        <AnalyticsKpi
          label="Starts"
          value={kpis.placementsStarted}
          detail={`${kpis.newStarts} new · ${kpis.redeployStarts} redeployed`}
          definition="Workers whose start date falls in the selected dates."
          to="/ta/deployments"
        />
        <AnalyticsKpi
          label="Backouts"
          value={kpis.backoutsAfterClientReview}
          detail={`${data.backouts.withdrawals} withdrew earlier`}
          definition="Candidates who left after client review."
          tone={kpis.backoutsAfterClientReview > 0 ? "alert" : "default"}
          anchor="backouts"
        />
      </KpiRow>

      <StagePipeline rows={data.stageTable} rangeLabel={label} linkStages />

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
        <PhoneCollapse title="Stage progress" className="md:col-span-12 lg:col-span-7">
          <DropOffChart rows={data.dropOff} rangeLabel={label} />
        </PhoneCollapse>
        <PhoneCollapse title="Withdrawals and backouts" targetId="backouts" className="md:col-span-12 lg:col-span-5">
          <BackoutPanel data={data.backouts} clientDecisions={data.clientDecisions} rangeLabel={label} showRecent compact />
        </PhoneCollapse>
      </div>

      {data.closures && (
        <PhoneCollapse title="Closed applications">
          <ClosurePanel data={data.closures} rangeLabel={label} />
        </PhoneCollapse>
      )}

      <AttentionStrip
        items={[
          { id: "waiting", label: "past stage limit", singular: "past stage limit", count: data.stuckTotal, target: "operations", tone: "alert", onSelect: () => showWaiting({}) },
          { id: "pending", label: "tasks for you", singular: "task for you", count: data.pendingActionsTotal, target: "operations", tone: "warn", onSelect: () => setTab("pending") },
          { id: "late", label: "overdue requests", singular: "overdue request", count: kpis.requisitions.overdue, target: "operations", tone: "alert", onSelect: () => showRequests("OVERDUE") },
          { id: "empty", label: "no candidates", singular: "no candidates", count: noCandidates, target: "operations", tone: "warn", onSelect: () => showRequests("NONE") },
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
      </div>
    </div>
  );
};
