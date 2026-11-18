import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, LoadingState, ErrorState, EmptyState, DocumentPreviewModal } from "../../components/common";
import { Button } from "../../components/ui";
import { RequirementStatusBadge } from "../../components/applicant/RequirementStatusBadge";
import {
  applicantJobsApi,
  type MyDocumentRequirement,
} from "../../lib/api/applicant-jobs.api";
import { formatDate, manilaDaysUntil } from "../../lib/utils";

// Same shape and amber as the shared document badge, for states that have no review status of their own.
const amberBadgeClass =
  "inline-flex items-center whitespace-nowrap rounded-md border border-[#FED7AA] bg-[#FFF7ED] px-2 py-0.5 text-xs font-medium text-[#B45309]";

const linkButtonClass =
  "inline-flex min-h-11 md:min-h-9 applicant-touch:min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-[#0B315D] hover:bg-slate-50 hover:text-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors";

const primaryLinkClass =
  "inline-flex min-h-11 md:min-h-9 applicant-touch:min-h-11 items-center justify-center rounded-md border border-[#0B315D] bg-[#0B315D] px-4 text-sm font-medium text-white hover:bg-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors";

const isPastDate = (value?: string | null) => (manilaDaysUntil(value) ?? 0) < 0;

// A requirement needs action when it is rejected, still missing, expired, or has an open update request.
const needsAction = (item: MyDocumentRequirement) =>
  item.reviewStatus === "REJECTED" ||
  item.reviewStatus === "PENDING" ||
  item.reviewStatus === "TO_FOLLOW" ||
  item.reviewStatus === "EXPIRED" ||
  Boolean(item.updateRequestedAt && !item.updateRequestCompletedAt) ||
  isPastDate(item.expiresAt);

const ActionBadge: React.FC<{ item: MyDocumentRequirement }> = ({ item }) => {
  if (item.reviewStatus === "REJECTED") return <RequirementStatusBadge status="REJECTED" />;
  if (item.updateRequestedAt && !item.updateRequestCompletedAt) return <span className={amberBadgeClass}>Update requested</span>;
  if (item.reviewStatus === "PENDING" || item.reviewStatus === "TO_FOLLOW") return <RequirementStatusBadge status={item.reviewStatus} />;
  return <RequirementStatusBadge status="EXPIRED" />;
};

export const MyDocumentsPage: React.FC = () => {
  const [preview, setPreview] = useState<{ id: number; label: string } | null>(null);
  const requirementsQuery = useQuery({
    queryKey: ["applicant", "my-documents"],
    queryFn: applicantJobsApi.getMyDocuments,
  });
  const libraryQuery = useQuery({
    queryKey: ["applicant", "my-document-library"],
    queryFn: applicantJobsApi.getMyDocumentLibrary,
  });

  const header = (
    <PageHeader
      title="My document library"
      description="Documents you have already submitted. Reuse them on new applications instead of uploading again."
      breadcrumbs={[
        { label: "My career", href: "/app" },
        { label: "Documents" },
      ]}
    />
  );

  if (requirementsQuery.isLoading || libraryQuery.isLoading) {
    // The page is a single column of rows, so the skeleton is too.
    return <div className="space-y-5">{header}<LoadingState variant="cards" rows={4} className="md:grid-cols-1! lg:grid-cols-1!" message="Loading your documents…" /></div>;
  }
  // Offline, TanStack pauses the first fetch and the data stays undefined: say so instead of showing an empty library.
  const pausedQuery = [requirementsQuery, libraryQuery].find((q) => q.fetchStatus === "paused" && q.data === undefined);
  if (pausedQuery) {
    return <div className="space-y-5">{header}<ErrorState subject="your documents" onRetry={() => pausedQuery.refetch()} /></div>;
  }
  if (requirementsQuery.isError) {
    return <div className="space-y-5">{header}<ErrorState subject="your documents" error={requirementsQuery.error} onRetry={() => requirementsQuery.refetch()} /></div>;
  }
  if (libraryQuery.isError) {
    return <div className="space-y-5">{header}<ErrorState subject="your documents" error={libraryQuery.error} onRetry={() => libraryQuery.refetch()} /></div>;
  }

  const actionItems = (requirementsQuery.data || []).filter(needsAction);
  const library = [...(libraryQuery.data || [])].sort((a, b) => a.label.localeCompare(b.label));

  if (actionItems.length === 0 && library.length === 0) {
    return <div className="min-w-0 space-y-6">
      {header}
      <EmptyState
        title="No documents uploaded yet"
        description="Documents you submit for an application will appear here so you can reuse them on new applications."
        action={<Link to="/app/jobs" className={primaryLinkClass}>Browse jobs</Link>}
      />
    </div>;
  }

  return <div className="min-w-0 space-y-8">
    {header}

    <section aria-labelledby="action-needed-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="action-needed-heading" className="text-base font-semibold text-[#0B315D]">Action needed</h2>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-[#0B315D] tabular-nums">
          {actionItems.length}
        </span>
      </div>
      {actionItems.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-[#486581]">No documents need action right now.</p>
      ) : (
        <div className="space-y-3">
          {actionItems.map((item) => (
            <article key={item.id} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-5 [overflow-wrap:anywhere]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-base font-semibold text-[#102A43]">{item.documentLabel}</h3>
                  <p className="text-sm text-[#486581]">
                    {item.clientName ? `${item.clientName} · ${item.jobTitle}` : item.jobTitle}
                  </p>
                </div>
                <div className="shrink-0">
                  <ActionBadge item={item} />
                </div>
              </div>
              {item.updateRequestedAt && !item.updateRequestCompletedAt && (
                <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">
                  <p>{item.updateRequestReason}</p>
                  <p className="mt-1">Due {item.updateRequestDeadline ? formatDate(item.updateRequestDeadline) : "Date not set"}{isPastDate(item.updateRequestDeadline) && <> · <span className="font-medium text-[#B91C1C]">Overdue</span></>}</p>
                </div>
              )}
              {item.reviewStatus === "REJECTED" && item.reviewNotes && <p className="text-sm text-[#B91C1C]">{item.reviewNotes}</p>}
              <div className="pt-1">
                <Link to="/app/applications/$applicationId" params={{ applicationId: String(item.applicationId) }} className={linkButtonClass}>
                  Open application to upload
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>

    <section aria-labelledby="library-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="library-heading" className="text-base font-semibold text-[#0B315D]">Your documents</h2>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-[#0B315D] tabular-nums">
          {library.length}
        </span>
      </div>
      {library.length === 0 ? (
        <EmptyState
          title="No documents uploaded yet"
          description="Documents you submit for an application will appear here so you can reuse them on new applications."
        />
      ) : (
        <div className="space-y-3">
          {library.map((item) => {
            return (
              <article key={`${item.label}-${item.documentId}`} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-5 [overflow-wrap:anywhere]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold text-[#102A43]">{item.label}</h3>
                    <p className="truncate text-sm text-[#486581]" title={item.originalName}>{item.originalName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <RequirementStatusBadge status={item.reviewStatus} />
                    {item.isExpired && item.reviewStatus !== "EXPIRED" && <RequirementStatusBadge status="EXPIRED" />}
                    {!item.isExpired && item.isExpiringSoon && <span className={amberBadgeClass}>Expiring soon</span>}
                  </div>
                </div>
                <div className="space-y-1 text-sm text-[#486581] [overflow-wrap:anywhere]">
                  <p>{item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : item.validityStatus === "NO_EXPIRY" ? "No expiry" : "Expiry not recorded"}</p>
                  <p>Source: {item.jobTitle} · Uploaded {formatDate(item.uploadedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" onClick={() => setPreview({ id: item.documentId, label: item.label })}>View</Button>
                  <Link to="/app/applications/$applicationId" params={{ applicationId: String(item.applicationId) }} className={linkButtonClass}>
                    Open application
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>

    <DocumentPreviewModal open={Boolean(preview)} documentId={preview?.id} title={preview?.label} onClose={() => setPreview(null)} />
  </div>;
};
