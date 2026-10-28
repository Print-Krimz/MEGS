import React from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { adminApi } from "../../lib/api/admin.api";
import { PageHeader, LoadingState, ErrorState } from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { formatAdminPipelineStage } from "../../lib/admin-copy";
import { AnalyticsPanel } from "../../components/analytics";

const titleCase = (value?: string | null) =>
  (value ?? "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium text-slate-600">{label}</dt>
    <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
  </div>
);

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

  const query = useQuery({
    queryKey: ["admin", "application", applicationId],
    queryFn: () => adminApi.getApplication(applicationId),
    enabled: Boolean(applicationId),
  });

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/admin/analytics">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to reports
      </Link>
    </Button>
  );

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Application" flush actions={back} />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Application" flush actions={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const app = query.data;
  const profile = app.user?.applicantProfile;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || app.user?.email || "Candidate";
  const job = app.jobPosting;
  const client = job?.mrf?.client;

  return (
    <div className="space-y-5">
      <PageHeader
        title={name}
        flush
        description={`Application #${app.id}. Only the assigned recruiter can change it.`}
        breadcrumbs={[{ label: "Administration", href: "/admin" }, { label: "Reports", href: "/admin/analytics" }, { label: name }]}
        actions={back}
      />

      <section aria-label="Application summary" className="rounded-md border border-slate-300 bg-white p-3.5">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Stage">{app.isArchived ? "Archived" : formatAdminPipelineStage(app.status)}</Fact>
          <Fact label="Applied">{formatDate(app.createdAt)}</Fact>
          <Fact label="Last updated">{formatDate(app.updatedAt)}</Fact>
          <Fact label="Job opening">
            {job?.title ?? "—"}
            {job?.location ? <span className="block text-xs text-slate-600">{job.location}</span> : null}
          </Fact>
          <Fact label="Client">{client?.name ?? "—"}</Fact>
          <Fact label="Request">
            {job?.mrf ? (
              <Link
                to="/admin/mrfs/$mrfId"
                params={{ mrfId: String(job.mrf.id) }}
                className="focus-ring rounded-sm font-medium text-navy underline underline-offset-2 hover:text-navy-hover"
              >
                {job.mrf.title}
              </Link>
            ) : (
              "Not linked to a request"
            )}
          </Fact>
          <Fact label="Email">{app.user?.email ?? "—"}</Fact>
          <Fact label="Mobile">{profile?.mobileNumber ?? "—"}</Fact>
        </dl>
        {app.backout && (
          <p className="mt-3.5 border-t border-slate-200 pt-3 text-sm text-rose-800">
            Backed out on {formatDate(app.backout.occurredAt)} at the {titleCase(app.backout.stage)} stage. Party: {titleCase(app.backout.party)}.
            Reason: {titleCase(app.backout.reason)}.
          </p>
        )}
      </section>

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
