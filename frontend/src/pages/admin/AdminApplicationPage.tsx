import React from "react";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BellRing } from "lucide-react";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  RecordSummary,
  StatusBadge,
  PipelineIndicator,
  ScoreBadge,
  type RecordSummaryFact,
} from "../../components/common";
import { RecordBreadcrumb } from "../../components/ta/recruitment/RecordBreadcrumb";
import { Button } from "../../components/ui";
import { displayEmail, formatDate } from "../../lib/utils";
import { resolveUserName } from "../../lib/user-name";
import { notify } from "../../lib/feedback";
import { AnalyticsPanel } from "../../components/analytics";
import { readReportReturnState } from "../../lib/admin-report-search";

const titleCase = (value?: string | null) =>
  (value ?? "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const TERMINAL_STATUSES = new Set(["DEPLOYED", "REJECTED", "BACKOUT", "ARCHIVED", "TALENT_POOL"]);

const Section: React.FC<{ title: string; empty: string; items: React.ReactNode[] }> = ({ title, empty, items }) => (
  <AnalyticsPanel title={title} aside={items.length > 0 ? items.length : undefined}>
    {items.length === 0 ? (
      <p className="px-3.5 py-3 text-sm text-slate-600">{empty}</p>
    ) : (
      <ul className="divide-y divide-slate-200">
        {items.map((item, i) => (
          <li key={i} className="px-3.5 py-2.5 text-sm text-slate-800">
            {item}
          </li>
        ))}
      </ul>
    )}
  </AnalyticsPanel>
);

/** Read-only view of one application, opened from the reports. The recruiter makes any changes. */
export const AdminApplicationPage: React.FC = () => {
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };
  const locationState = useLocation().state as { fromJob?: { id?: number; title?: string } } | undefined;
  const fromJob = locationState?.fromJob?.id ? locationState.fromJob : undefined;

  // The report search this page was opened from. Anything that is not a valid report search returns to the default report.
  const reportSearch = readReportReturnState(locationState);
  const reportQueryString = new URLSearchParams(
    Object.entries(reportSearch)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  const reportsHref = reportQueryString ? `/admin/analytics?${reportQueryString}` : "/admin/analytics";

  const query = useQuery({
    queryKey: ["admin", "application", applicationId],
    queryFn: () => adminApi.getApplication(applicationId),
    enabled: Boolean(applicationId),
  });

  const remindMutation = useMutation({
    mutationFn: () => adminApi.remindRecruiters([Number(applicationId)]),
    onSuccess: (result) => {
      if (result.reminded > 0) {
        notify.success("Recruiter reminded", "A reminder was sent to the assigned recruiter.");
      } else {
        notify.error("No one was reminded", "This application has no assigned recruiter.");
      }
    },
    onError: (err) => {
      notify.error("The reminder was not sent. Try again.", err);
    },
  });

  const back = fromJob ? (
    <Button asChild variant="outline" size="sm">
      <Link to="/admin/jobs/$jobId" params={{ jobId: String(fromJob.id) }}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to {fromJob.title || "job opening"}
      </Link>
    </Button>
  ) : (
    <Button asChild variant="outline" size="sm">
      <Link to="/admin/analytics" search={reportSearch as never}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to reports
      </Link>
    </Button>
  );

  const originBreadcrumbs = fromJob
    ? [
        { label: "Administration", href: "/admin" },
        { label: "Job openings", href: "/admin/jobs" },
        { label: fromJob.title || `Opening #${fromJob.id}`, href: `/admin/jobs/${fromJob.id}` },
      ]
    : [
        { label: "Administration", href: "/admin" },
        { label: "Reports", href: reportsHref },
      ];

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Application" flush breadcrumbs={[...originBreadcrumbs, { label: "Application" }]} actions={back} />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Application" flush breadcrumbs={[...originBreadcrumbs, { label: "Application" }]} actions={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const app = query.data;
  const profile = app.user?.applicantProfile;
  const name = resolveUserName(app.user, "") || displayEmail(app.user?.email) || "Candidate";
  const job = app.jobPosting;
  const client = job?.mrf?.client;
  const owner = job?.mrf?.assignedTa ?? job?.assignedTa ?? null;
  const ownerName = owner ? resolveUserName(owner, "") || displayEmail(owner.email) || "Assigned recruiter" : "Unassigned";
  const canRemind = Boolean(owner) && !app.isArchived && !TERMINAL_STATUSES.has(app.status);
  const shownEmail = displayEmail(app.user?.email);
  const mobile = profile?.mobileNumber || null;
  const fitScore = app.candidateFitScore ?? app.aiScore;

  const facts: RecordSummaryFact[] = [
    { label: "Assigned recruiter", value: ownerName },
    { label: "Applied", value: formatDate(app.createdAt) },
    { label: "Last updated", value: formatDate(app.updatedAt) },
    {
      label: "Job opening",
      value: job ? (
        <>
          {job.title}
          {job.location ? <span className="block text-xs font-normal text-slate-600">{job.location}</span> : null}
        </>
      ) : "—",
      href: job ? `/admin/jobs/${job.id}` : undefined,
    },
    {
      label: "Client",
      value: client?.name ?? "—",
      href: client ? `/admin/clients/${client.id}` : undefined,
    },
    {
      label: "Request",
      value: job?.mrf ? job.mrf.title : "Not linked to a request",
      href: job?.mrf ? `/admin/mrfs/${job.mrf.id}` : undefined,
    },
    {
      label: "Email",
      value: shownEmail ?? "Not provided",
      copyValue: shownEmail ?? undefined,
    },
    {
      label: "Mobile",
      value: mobile ?? "Not provided",
      copyValue: mobile ?? undefined,
    },
  ];

  const subtitleParts = [
    job?.title ? `${job.title}${client?.name ? ` · ${client.name}` : ""}` : null,
    `Application #${app.id}. Only the assigned recruiter can change it.`,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <RecordBreadcrumb items={[...originBreadcrumbs, { label: name }]} />

      <RecordSummary
        titleAs="h1"
        title={name}
        subtitle={subtitleParts.join(" — ")}
        chips={
          <>
            <StatusBadge status={app.isArchived ? "ARCHIVED" : app.status} />
            {fitScore != null && <ScoreBadge score={fitScore} size="sm" />}
          </>
        }
        actions={
          <>
            {canRemind && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<BellRing className="w-3.5 h-3.5" aria-hidden="true" />}
                loading={remindMutation.isPending}
                onClick={() => remindMutation.mutate()}
              >
                Remind recruiter
              </Button>
            )}
            {back}
          </>
        }
        facts={facts}
      >
        <div className="space-y-3">
          <PipelineIndicator currentStatus={app.status} variant="compact" />
          {app.backout && (
            <p className="border-t border-slate-200 pt-3 text-sm text-rose-800">
              Backed out on {formatDate(app.backout.occurredAt)} at the {titleCase(app.backout.stage)} stage. Party: {titleCase(app.backout.party)}.
              Reason: {titleCase(app.backout.reason)}.
            </p>
          )}
        </div>
      </RecordSummary>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
        <Section
          title="Interviews"
          empty="No interviews recorded."
          items={(app.interviews ?? []).map((i: any) => (
            <>
              {titleCase(i.type)} · {i.scheduledAt ? formatDate(i.scheduledAt) : "not scheduled"} · {titleCase(i.result ?? "Pending")}
            </>
          ))}
        />
        <Section
          title="Client answers"
          empty="Not sent to a client yet."
          items={(app.clientEndorsements ?? []).map((e: any) => (
            <>
              {e.client?.name ?? "Client"} · {titleCase(e.outcome)} · sent {formatDate(e.createdAt)}
            </>
          ))}
        />
        <Section
          title="Pre-employment"
          empty="No pre-employment requirements on the checklist."
          items={(app.complianceRequirements ?? []).map((r: any) => (
            <>
              {r.documentLabel} · {titleCase(r.reviewStatus)}
              {r.deadline ? ` · due ${formatDate(r.deadline)}` : ""}
            </>
          ))}
        />
        <Section
          title="Placements"
          empty="No placement yet."
          items={(app.deployments ?? []).map((d: any) => (
            <>
              {d.client?.name ?? "Client"} · {titleCase(d.status)}
              {d.contractStart ? ` · from ${formatDate(d.contractStart)}` : ""}
            </>
          ))}
        />
      </div>
    </div>
  );
};
