import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { deploymentHistoryLabel, deploymentStatusLabel } from "../../lib/labels";
import { getManilaToday } from "../../lib/field-limits";
import { EndAssignmentDialog } from "../../components/ta/EndAssignmentDialog";
import { RecordCheckInDialog } from "../../components/ta/RecordCheckInDialog";
import { checkInDue } from "../../components/ta/check-in-due";

const SECTION = "space-y-4 border border-slate-300 bg-white p-4 md:p-5";
const SECTION_HEADING = "text-base font-semibold text-slate-950";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <dt className="text-sm text-slate-600">{label}</dt>
    <dd className="text-sm text-slate-900 sm:text-right break-words">{children}</dd>
  </div>
);

export const DeploymentDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { deploymentId } = useParams({ strict: false }) as { deploymentId: string };

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");
  const [actualStart, setActualStart] = useState(getManilaToday());
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [agreementEnd, setAgreementEnd] = useState("");
  const [agreementHasNoEnd, setAgreementHasNoEnd] = useState(false);
  const [agreementTerms, setAgreementTerms] = useState("");

  const deploymentQuery = useQuery({
    queryKey: ["ta", "deployment", deploymentId],
    queryFn: () => taApi.getDeploymentDetails(deploymentId),
    enabled: Boolean(deploymentId),
  });


  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: DeploymentStatus; notes?: string; actualStart?: string }) =>
      taApi.updateDeploymentStatus(deploymentId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setStatusModalOpen(false);
      setStatusNotes("");
      notify.success("Deployment status updated", `The assignment is now ${getDeploymentStatusMeta(vars.status).label}.`);
    },
    onError: (err: any) => {
      notify.error("Unable to update deployment status", err);
    },
  });

  const updateAgreementMutation = useMutation({
    mutationFn: () => taApi.updateDeploymentContract(deploymentId, {
      contractEnd: agreementHasNoEnd ? null : agreementEnd || null,
      contractTerms: agreementTerms.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setAgreementModalOpen(false);
      notify.success("Agreement updated", "The previous agreement details are preserved in the record history.");
    },
    onError: (error: any) => notify.error("Could not update agreement", error?.message || error),
  });

  if (deploymentQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment details" description="Loading assignment details..." flush />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (deploymentQuery.isError || !deploymentQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment details" description="Assignment details" flush />
        <ErrorState error={deploymentQuery.error} onRetry={() => deploymentQuery.refetch()} />
      </div>
    );
  }

  const dep = deploymentQuery.data;
  const emp = dep.employee;
  const profile = emp?.user?.applicantProfile;
  const empName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : emp?.employeeNumber || "Employee";
  const history = dep.statusHistory || [];
  const allowedNext = (ALLOWED_DEPLOYMENT_TRANSITIONS[dep.status] || []).filter((status) => status !== DeploymentStatus.ENDED);
  const isActive = dep.status === DeploymentStatus.ACTIVE;
  const reviews = dep.reviews || [];
  const due = checkInDue(dep.nextReviewAt);

  const subtitle = [dep.client?.name, dep.site, deploymentStatusLabel(dep.status)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={empName}
        description={subtitle}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce, href: "/ta/workforce?tab=deployments" },
          { label: `Deployment #${dep.id}` },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isActive && (
              <Button variant="primary" size="sm" onClick={() => setCheckInOpen(true)}>
                Record check-in
              </Button>
            )}
            {allowedNext.length > 0 && (
              <Button
                variant={isActive ? "outline" : "primary"}
                size="sm"
                onClick={() => {
                  setNewStatus(allowedNext[0]);
                  const defaultStart = dep.contractStart && dep.contractStart.slice(0, 10) >= getManilaToday()
                    ? dep.contractStart.slice(0, 10)
                    : getManilaToday();
                  setActualStart(defaultStart);
                  setStatusModalOpen(true);
                }}
              >
                Update status
              </Button>
            )}
            {(isActive || dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT) && (
              <Button variant="outline" size="sm" onClick={() => {
                setAgreementEnd(dep.contractEnd?.slice(0, 10) || "");
                setAgreementHasNoEnd(!dep.contractEnd);
                setAgreementTerms("");
                setAgreementModalOpen(true);
              }}>Update agreement</Button>
            )}
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                className="border-danger! text-danger! hover:bg-danger-light! hover:text-red-700!"
                onClick={() => setEndModalOpen(true)}
              >
                End assignment
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className={SECTION} aria-labelledby="dep-details-heading">
          <h2 id="dep-details-heading" className={SECTION_HEADING}>Deployment details</h2>
          <dl className="space-y-2.5">
            <Field label="Status">
              <StatusBadge status={dep.status} employeeStatus={dep.employee?.status} type="deployment" />
            </Field>
            <Field label="Client">{dep.client?.name || "Not recorded"}</Field>
            <Field label="Site">{dep.site || "Client site"}</Field>
            <Field label="Contract dates">
              {dep.contractStart ? formatDate(dep.contractStart) : "Not set"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "open"}
            </Field>
            <Field label="Actual assignment">
              {dep.actualStart ? formatDate(dep.actualStart) : dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT ? "Not started" : "Start date not recorded"} to {dep.actualEnd ? formatDate(dep.actualEnd) : isActive ? "ongoing" : dep.status === DeploymentStatus.ENDED ? "end date not recorded" : "—"}
            </Field>
            {isActive && (
              <Field label="Next check-in">
                {dep.nextReviewAt ? (
                  <>
                    {formatDate(dep.nextReviewAt)}
                    {due.overdue && <span className="ml-2 font-semibold text-rose-700">{due.label}</span>}
                  </>
                ) : (
                  "Not scheduled"
                )}
              </Field>
            )}
          </dl>
          {dep.notes && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-sm text-slate-600">Notes</p>
              <p className="mt-0.5 text-sm text-slate-800">{dep.notes}</p>
            </div>
          )}
        </section>

        <section className={SECTION} aria-labelledby="dep-employee-heading">
          <h2 id="dep-employee-heading" className={SECTION_HEADING}>Employee details</h2>
          <dl className="space-y-2.5">
            <Field label="Employee">
              {emp?.id ? (
                <Link
                  to="/ta/employees/$employeeId"
                  params={{ employeeId: String(emp.id) }}
                  className="focus-ring inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline md:min-h-0"
                >
                  {empName}
                </Link>
              ) : (
                empName
              )}
            </Field>
            <Field label="Employee number"><span className="font-mono tabular-nums">{emp?.employeeNumber || "Not recorded"}</span></Field>
            <Field label="Phone">{profile?.mobileNumber || "Not recorded"}</Field>
            <Field label="Email">{emp?.user?.email || "Not recorded"}</Field>
          </dl>
        </section>
      </div>

      <section className={SECTION} aria-labelledby="dep-checkins-heading">
        <h2 id="dep-checkins-heading" className={SECTION_HEADING}>Check-ins</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-600">No check-ins recorded yet</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-slate-900">
                    {formatDateTime(review.reviewedAt)}
                    {review.reviewedBy?.email ? ` · ${review.reviewedBy.email}` : ""}
                  </p>
                  {review.notes && <p className="mt-1 text-slate-700">{review.notes}</p>}
                </div>
                <p className="text-slate-600">Next check-in: {review.nextReviewAt ? formatDate(review.nextReviewAt) : "Not scheduled"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={SECTION} aria-labelledby="dep-history-heading">
        <h2 id="dep-history-heading" className={SECTION_HEADING}>Status history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">
            No status changes recorded. Current status: {getDeploymentStatusMeta(dep.status).label}.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-1 border border-slate-200 bg-slate-50 p-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-slate-900">
                    {deploymentHistoryLabel(h.fromStatus)} → {deploymentStatusLabel(h.toStatus)}
                  </p>
                  {h.reason && <p className="text-slate-700">"{h.reason}"</p>}
                </div>
                <p className="shrink-0 text-xs text-slate-600 sm:text-right">{formatDateTime(h.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dep.agreementVersions && dep.agreementVersions.length > 0 && (
        <section className={SECTION} aria-labelledby="dep-agreements-heading">
          <h2 id="dep-agreements-heading" className={SECTION_HEADING}>Previous agreement versions</h2>
          <ul className="divide-y divide-slate-200">
            {dep.agreementVersions.map((version) => (
              <li key={version.id} className="py-3 text-sm first:pt-0 last:pb-0">
                <p className="font-medium text-slate-900">Recorded {formatDateTime(version.recordedAt)}</p>
                <p className="mt-1 text-slate-700">Agreement dates: {version.contractStart ? formatDate(version.contractStart) : "Not set"} to {version.contractEnd ? formatDate(version.contractEnd) : "open"}</p>
                {version.contractStatus && <p className="mt-0.5 text-slate-600">Status: {deploymentStatusLabel(version.contractStatus)}</p>}
                {version.contractTerms && <p className="mt-1 max-w-3xl whitespace-pre-wrap text-slate-700">{version.contractTerms}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecordCheckInDialog open={checkInOpen} deploymentId={deploymentId} employeeName={empName} onClose={() => setCheckInOpen(false)} />
      <EndAssignmentDialog open={endModalOpen} deploymentId={deploymentId} employeeName={empName} onClose={() => setEndModalOpen(false)} />

      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={newStatus === DeploymentStatus.ACTIVE ? "Confirm site start" : "Update deployment status"}
        description={newStatus === DeploymentStatus.ACTIVE ? "Record the date the employee actually started at the client site." : "Update the scheduled placement status."}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="text-slate-600">Current status</span>
            <StatusBadge status={dep.status} type="deployment" />
          </div>

          {newStatus === DeploymentStatus.ACTIVE ? (
            <Input
              label="Actual first working date"
              type="date"
              value={actualStart}
              min={getManilaToday()}
              onChange={(event) => setActualStart(event.target.value)}
              helperText={actualStart ? `${formatDate(actualStart)}. Must be today or a future date.` : "Must be today or a future date."}
              required
            />
          ) : <Select
            label="New status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as DeploymentStatus)}
            options={allowedNext.map((s) => ({
              value: s,
              label: getDeploymentStatusMeta(s).label,
            }))}
          />}
          <Textarea
            label="Notes (optional)"
            placeholder="Add a reason or note for this change..."
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="outline" size="sm" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateStatusMutation.isPending}
              disabled={newStatus === DeploymentStatus.ACTIVE && (!actualStart || actualStart < getManilaToday())}
              onClick={() =>
                updateStatusMutation.mutate({
                  status: newStatus,
                  notes: statusNotes || undefined,
                  actualStart: newStatus === DeploymentStatus.ACTIVE ? actualStart : undefined,
                })
              }
            >
              {newStatus === DeploymentStatus.ACTIVE ? "Confirm start" : "Save status"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={agreementModalOpen} onClose={() => setAgreementModalOpen(false)} title="Update assignment agreement" description="Record an actual agreement extension or amendment. This does not end the worker’s assignment." size="md">
        <div className="space-y-4">
          <Input
            label="Agreement end date (if specified)"
            type="date"
            value={agreementEnd}
            min={dep.contractStart?.slice(0, 10) || undefined}
            onChange={(event) => setAgreementEnd(event.target.value)}
            disabled={agreementHasNoEnd}
            helperText={agreementEnd && !agreementHasNoEnd ? formatDate(agreementEnd) : undefined}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 md:min-h-0">
            <input type="checkbox" checked={agreementHasNoEnd} onChange={(event) => { setAgreementHasNoEnd(event.target.checked); if (event.target.checked) setAgreementEnd(""); }} />
            This agreement has no fixed end date
          </label>
          <Textarea label="Agreement update notes" value={agreementTerms} onChange={(event) => setAgreementTerms(event.target.value)} rows={3} placeholder="Record the extension or amendment details." />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="outline" size="sm" onClick={() => setAgreementModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={updateAgreementMutation.isPending} onClick={() => updateAgreementMutation.mutate()}>Save agreement update</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
