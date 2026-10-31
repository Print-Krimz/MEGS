import { RecordBreadcrumb } from "../../components/ta/recruitment/RecordBreadcrumb";
import React, { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  RecordSummary,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { DateField } from "../../components/common/DateField";
import { formatDate, getDeploymentStatusMeta, displayEmail } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { getManilaToday } from "../../lib/field-limits";
import { plural } from "../../lib/plural";
import { EndAssignmentDialog } from "../../components/ta/EndAssignmentDialog";
import { AgreementVersionsDisclosure, DeploymentActivity } from "../../components/ta/workforce/DeploymentActivity";
import { initialsOf } from "../../components/ta/workforce/initials";

const SECTION = "space-y-4 rounded-md border border-slate-300 bg-white p-4 md:p-5";
const SECTION_HEADING = "text-lg font-semibold text-slate-950";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5">
    <dt className="text-xs font-medium text-slate-600">{label}</dt>
    <dd className="break-words text-sm text-slate-900">{children}</dd>
  </div>
);

const DAY_MS = 86_400_000;

/** Contract end with the days left, counted in Manila calendar days. */
const contractEndText = (contractEnd?: string | null): string => {
  if (!contractEnd) return "No end date";
  const day = (value: string) => Math.floor(new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime() / DAY_MS);
  const left = day(contractEnd) - day(getManilaToday());
  const when = formatDate(contractEnd);
  if (left < 0) return `${when} · ended ${plural(-left, "day")} ago`;
  if (left === 0) return `${when} · ends today`;
  return `${when} · ${plural(left, "day")} left`;
};

export const DeploymentDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { deploymentId } = useParams({ strict: false }) as { deploymentId: string };

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
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
      if (vars.status === DeploymentStatus.ACTIVE && vars.actualStart && vars.actualStart > getManilaToday()) {
        notify.success("Start date confirmed", `${formatDate(vars.actualStart)}. They become Active on site on that day.`);
      } else {
        notify.success("Deployment status updated", `The assignment is now ${getDeploymentStatusMeta(vars.status).label}.`);
      }
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
  const allowedNext = (ALLOWED_DEPLOYMENT_TRANSITIONS[dep.status] || []).filter((status) => status !== DeploymentStatus.ENDED);
  const isActive = dep.status === DeploymentStatus.ACTIVE;

  const subtitle = [dep.client?.name, dep.site].filter(Boolean).join(" · ");

  const actions = (
    <>
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
    </>
  );

  return (
    <div className="space-y-6">
      <RecordBreadcrumb
        items={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce, href: "/ta/workforce?tab=deployments" },
          { label: `Deployment #${dep.id}` },
        ]}
      />

      <RecordSummary
        titleAs="h1"
        title={empName}
        subtitle={subtitle || undefined}
        avatarText={initialsOf(empName)}
        chips={<StatusBadge status={dep.status} employeeStatus={dep.employee?.status} type="deployment" />}
        actions={actions}
        facts={[
          { label: "Employee record", value: emp?.employeeNumber ? `View ${emp.employeeNumber}` : "View record", href: emp?.id ? `/ta/employees/${emp.id}` : undefined },
          { label: "Client", value: dep.client?.name || "Not recorded" },
          { label: "Site", value: dep.site || "Client site" },
          { label: "Contract ends", value: contractEndText(dep.contractEnd) },
          { label: "Employee number", value: <span className="font-mono tabular-nums">{emp?.employeeNumber || "Not recorded"}</span> },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <DeploymentActivity deployment={dep} />
          <AgreementVersionsDisclosure versions={dep.agreementVersions ?? []} />
        </div>

        <section className={SECTION} aria-labelledby="dep-details-heading">
          <h2 id="dep-details-heading" className={SECTION_HEADING}>Assignment details</h2>
          <dl className="space-y-3">
            <Field label="Contract dates">
              {dep.contractStart ? formatDate(dep.contractStart) : "Not set"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "open"}
            </Field>
            <Field label="Actual assignment">
              {dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT
                ? dep.actualStart ? `Starts ${formatDate(dep.actualStart)}` : "Not started"
                : `${dep.actualStart ? formatDate(dep.actualStart) : "Start date not recorded"} to ${dep.actualEnd ? formatDate(dep.actualEnd) : isActive ? "ongoing" : dep.status === DeploymentStatus.ENDED ? "end date not recorded" : "—"}`}
            </Field>
            <Field label="Employee number"><span className="font-mono tabular-nums">{emp?.employeeNumber || "Not recorded"}</span></Field>
            <Field label="Phone">{profile?.mobileNumber || "Not recorded"}</Field>
            <Field label="Email">{displayEmail(emp?.user?.email) || "Not recorded"}</Field>
          </dl>
          {dep.notes && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-medium text-slate-600">Notes</p>
              <p className="mt-0.5 text-sm text-slate-800">{dep.notes}</p>
            </div>
          )}
        </section>
      </div>

      <EndAssignmentDialog open={endModalOpen} deploymentId={deploymentId} employeeName={empName} actualStart={dep.actualStart} onClose={() => setEndModalOpen(false)} />

      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={newStatus === DeploymentStatus.ACTIVE ? "Confirm start date" : "Update deployment status"}
        description={newStatus === DeploymentStatus.ACTIVE ? "Record the date the employee starts at the client site. They stay Ready to start until then." : "Update the scheduled placement status."}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="text-slate-600">Current status</span>
            <StatusBadge status={dep.status} type="deployment" />
          </div>

          {newStatus === DeploymentStatus.ACTIVE ? (
            <DateField
              label="First working date"
              value={actualStart}
              min={getManilaToday()}
              onChange={(event) => setActualStart(event.target.value)}
              help="Today or a future date. A future date becomes Active on site automatically on that day."
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
          <DateField
            label="Agreement end date (if specified)"
            value={agreementEnd}
            min={dep.contractStart?.slice(0, 10) || undefined}
            onChange={(event) => setAgreementEnd(event.target.value)}
            disabled={agreementHasNoEnd}
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
