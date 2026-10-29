import React from "react";
import { Link } from "@tanstack/react-router";
import { Truck, CheckCircle2, Lock, ExternalLink, Building2, IdCard, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import type { Application } from "../../lib/types";
import { ApplicationStatus } from "../../lib/types";
import { cn, formatDate as formatAppDate, formatDateTime } from "../../lib/utils";
import { deploymentStatusLabel } from "../../lib/labels";
import { deploymentStartsOn } from "../../lib/ta-copy";
import { describeRequirementProgress } from "./application/next-step";

export interface OnboardingDeploymentStepperProps {
  app: Application;
  totalCompReqs: number;
  approvedCompReqs: number;
  /** Requirements with a document waiting for review. Same count as the tab badge. */
  submittedCompReqs?: number;
  /** Requirements with no document yet (excluding "to follow"). */
  missingCompReqs?: number;
  hasUnapprovedMandatoryCompliance: boolean;
  isComplianceStage: boolean;
  canAdvanceToContractSigning: boolean;
  isAdvancingToContractSigning?: boolean;
  isContractSigningStage: boolean;
  isContractSigned: boolean;
  isReadyForDeployment: boolean;
  canDeployCandidate: boolean;
  /** A deployment for this worker that is not ENDED/CANCELLED (scheduled or active). */
  openDeployment?: { id: number; status: string; applicationId?: number | null } | null;
  linkedClientName?: string;
  onOpenComplianceTab: () => void;
  onAdvanceToContractSigning: () => void;
  onDeployCandidate: () => void;
}

type StepState = "complete" | "action" | "locked";

const StepMarker: React.FC<{ state: StepState; locked?: boolean; number: number; icon?: "truck" }> = ({ state, locked, number, icon }) => (
  <div
    className={cn(
      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
      state === "complete" ? "bg-emerald-700 text-white" : state === "action" ? "bg-navy text-white" : "bg-slate-200 text-slate-700"
    )}
    aria-hidden="true"
  >
    {state === "complete" ? (
      icon === "truck" ? <Truck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />
    ) : locked ? (
      <Lock className="h-3.5 w-3.5" />
    ) : (
      number
    )}
  </div>
);

const StepStatus: React.FC<{ state: StepState; label: string }> = ({ state, label }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-xs font-semibold",
      state === "complete"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : state === "action"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-100 text-slate-700"
    )}
  >
    {label}
  </span>
);

export const OnboardingDeploymentStepper: React.FC<OnboardingDeploymentStepperProps> = ({
  app,
  totalCompReqs,
  approvedCompReqs,
  submittedCompReqs = 0,
  missingCompReqs = 0,
  hasUnapprovedMandatoryCompliance,
  isComplianceStage,
  canAdvanceToContractSigning: _canAdvanceToContractSigning,
  isAdvancingToContractSigning: _isAdvancingToContractSigning = false,
  isContractSigningStage,
  isContractSigned,
  canDeployCandidate,
  openDeployment = null,
  linkedClientName,
  onOpenComplianceTab,
  onAdvanceToContractSigning: _onAdvanceToContractSigning,
  onDeployCandidate,
}) => {
  const isDeployed = app.status === ApplicationStatus.DEPLOYED;

  // Single source of truth for milestone completion
  const isStep1Complete = !hasUnapprovedMandatoryCompliance && (totalCompReqs > 0 || isContractSigningStage || isDeployed);
  const isStep2Complete = Boolean(isContractSigned || app.contractSigned || app.contractSignedAt);

  // A worker with an open (scheduled or active) deployment cannot be deployed again.
  const hasOpenDeployment = Boolean(openDeployment) && !isDeployed;
  const isOpenDeploymentForThisApplication = hasOpenDeployment && (!openDeployment?.applicationId || openDeployment.applicationId === app.id);
  const isStep4Ready = !isDeployed && !hasOpenDeployment && isStep1Complete && isStep2Complete;
  const effectiveCanDeploy = canDeployCandidate || isStep4Ready;

  // Which step is the recruiter's turn, and what to do about it.
  let blockingStepNumber: 1 | 2 | null = null;
  let nextActionLabel = "";
  if (isDeployed) {
    // Fully deployed
  } else if (!isStep1Complete) {
    blockingStepNumber = 1;
    nextActionLabel = "Review requirements";
  } else if (isComplianceStage) {
    blockingStepNumber = 1;
    nextActionLabel = "Move to contract signing";
  } else if (!isStep2Complete) {
    blockingStepNumber = 2;
    nextActionLabel = "Deploy applicant";
  } else if (hasOpenDeployment) {
    nextActionLabel = isOpenDeploymentForThisApplication
      ? "Confirm the start date on the deployment record"
      : "Close the worker's other open deployment first";
  } else {
    nextActionLabel = "Activate deployment";
  }

  const completedMilestonesCount = (isStep1Complete ? 1 : 0) + (isStep2Complete ? 1 : 0) + (isDeployed ? 1 : 0);
  const progressPercent = Math.round((completedMilestonesCount / 3) * 100);

  // =========================================================================
  // Deployed: placement summary. The deployment status is stated once.
  // =========================================================================
  if (isDeployed) {
    const primaryDeployment = app.deployments?.[0];
    const clientName = primaryDeployment?.client?.name || linkedClientName || "Client";
    const siteLocation = primaryDeployment?.site || "Client designated site";
    const employeeNumber = app.hiredEmployee?.employeeNumber || "EMP-ROSTERED";
    const position = app.hiredEmployee?.position || app.jobPosting?.title || "Specialist";
    const deploymentLine = primaryDeployment
      ? [
          deploymentStatusLabel(primaryDeployment.status),
          primaryDeployment.status === "READY_FOR_DEPLOYMENT" && primaryDeployment.contractStart
            ? deploymentStartsOn(formatAppDate(primaryDeployment.contractStart))
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    return (
      <section aria-labelledby="deployment-summary-heading" className="space-y-5 border border-slate-300 bg-white p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 id="deployment-summary-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Truck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Deployed
            </h3>
            {deploymentLine && <p className="mt-0.5 text-sm text-slate-700">Deployment: {deploymentLine}</p>}
          </div>

          {app.hiredEmployee?.id ? (
            <Link
              to="/ta/employees/$employeeId"
              params={{ employeeId: String(app.hiredEmployee.id) }}
              className="focus-ring inline-flex min-h-11 items-center gap-1.5 self-start rounded border border-slate-300 bg-slate-100 px-2.5 font-mono text-xs font-semibold text-navy hover:underline md:min-h-8"
            >
              <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
              {employeeNumber}
            </Link>
          ) : (
            <span className="inline-flex self-start rounded border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800">{employeeNumber}</span>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <dt className="text-slate-600">Client</dt>
            <dd className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-navy" aria-hidden="true" />
              <span className="truncate">{clientName}</span>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-slate-600">Site</dt>
            <dd className="truncate font-semibold text-slate-900">{siteLocation}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-slate-600">Position</dt>
            <dd className="truncate font-semibold text-slate-900">{position}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-slate-600">Contract dates</dt>
            <dd className="font-semibold text-slate-900">
              {primaryDeployment?.contractStart ? formatAppDate(primaryDeployment.contractStart) : "Immediate"} –{" "}
              {primaryDeployment?.contractEnd ? formatAppDate(primaryDeployment.contractEnd) : "Open-ended"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-slate-800">Completed steps</h4>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-emerald-900">
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                Requirements approved ({approvedCompReqs}/{totalCompReqs})
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                Contract signed ({formatAppDate(app.contractSignedAt)})
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {primaryDeployment?.id && (
              <Button asChild variant="primary" size="sm">
                <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(primaryDeployment.id) }}>
                  <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                  View deployment
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />} onClick={onOpenComplianceTab}>
              View requirements
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // In progress: three steps and one "Next:" line.
  // =========================================================================
  const step1State: StepState = isStep1Complete ? "complete" : blockingStepNumber === 1 ? "action" : "locked";
  const step2State: StepState = isStep2Complete ? "complete" : blockingStepNumber === 2 ? "action" : "locked";
  const step3State: StepState = isStep4Ready ? "action" : "locked";
  const nextIsMine = blockingStepNumber !== null || isStep4Ready || (hasOpenDeployment && isOpenDeploymentForThisApplication);

  return (
    <section aria-labelledby="readiness-heading" className="space-y-4 border border-slate-300 bg-white p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0 space-y-1">
          <h3 id="readiness-heading" className="text-base font-semibold text-slate-900">
            Deployment readiness
          </h3>
          <p className={cn("text-sm", nextIsMine ? "font-medium text-slate-950" : "text-slate-700")}>
            {nextIsMine && <span className="mr-2 inline-flex rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Action needed</span>}
            Next: {nextActionLabel}
          </p>
        </div>
        <div className="w-full shrink-0 space-y-1.5 sm:w-52">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900">{completedMilestonesCount} of 3 steps complete</span>
            <span className="tabular-nums text-slate-700">{progressPercent}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Deployment readiness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div className="h-full rounded-full bg-navy transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <ol className="divide-y divide-slate-100 border border-slate-200">
        {/* Step 1: requirements */}
        <li className={cn("flex flex-col justify-between gap-3 p-3.5 md:flex-row md:items-center", step1State === "action" && "bg-amber-50/50")}>
          <div className="flex min-w-0 items-start gap-3">
            <StepMarker state={step1State} number={1} />
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-3.5 w-3.5 text-navy" aria-hidden="true" />
                Step 1 · Requirements
              </p>
              <p className="text-sm text-slate-700">
                Approved: <span className="font-semibold text-slate-900">{approvedCompReqs} / {totalCompReqs}</span>
                <span className="mx-1.5 text-slate-400" aria-hidden="true">•</span>
                <span className={isStep1Complete ? "text-emerald-800" : totalCompReqs === 0 ? "text-slate-600" : "text-amber-900"}>
                  {isStep1Complete
                    ? "All required documents approved"
                    : totalCompReqs === 0
                    ? "No requirements configured yet"
                    : describeRequirementProgress(submittedCompReqs, missingCompReqs) || "Waiting on the remaining requirements"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 md:justify-end">
            <StepStatus state={step1State} label={isStep1Complete ? "Complete" : blockingStepNumber === 1 ? "Action needed" : totalCompReqs === 0 ? "Not set up" : "In progress"} />
            <Button variant="ghost" size="sm" onClick={onOpenComplianceTab}>
              View requirements
            </Button>
          </div>
        </li>

        {/* Step 2: contract */}
        <li className={cn("flex flex-col justify-between gap-3 p-3.5 md:flex-row md:items-center", step2State === "action" && "bg-amber-50/50")}>
          <div className="flex min-w-0 items-start gap-3">
            <StepMarker state={step2State} number={2} locked={!isStep2Complete && (!isStep1Complete || isComplianceStage)} />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Step 2 · Employment contract</p>
              <p className="text-sm text-slate-700">
                {isStep2Complete ? (
                  <span>Signed {app.contractSignedAt && `• ${formatAppDate(app.contractSignedAt)}`}</span>
                ) : !isStep1Complete ? (
                  <span>Available after requirements are approved</span>
                ) : isComplianceStage ? (
                  <span>Available after the candidate moves to contract signing</span>
                ) : (
                  <>
                    {app.contractSigningAt && (
                      <span className="block font-medium text-slate-900">
                        Signing on <span className="tabular-nums">{formatDateTime(app.contractSigningAt)}</span>
                        {app.contractSigningLocation ? ` at ${app.contractSigningLocation}` : ""}
                      </span>
                    )}
                    <span className="text-amber-900">Deploy the applicant after the contract signing.</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 md:justify-end">
            <StepStatus state={step2State} label={isStep2Complete ? "Complete" : blockingStepNumber === 2 ? "Action needed" : "Locked"} />
            {isStep2Complete ? null : isContractSigningStage && isStep1Complete ? (
              <span className="px-1 text-sm text-slate-600">Use the button in the bar above</span>
            ) : (
              <span className="px-1 text-sm text-slate-600">Not available yet</span>
            )}
          </div>
        </li>

        {/* Step 3: site deployment */}
        <li className={cn("flex flex-col justify-between gap-3 p-3.5 md:flex-row md:items-center", step3State === "action" && "bg-emerald-50/50")}>
          <div className="flex min-w-0 items-start gap-3">
            <StepMarker state={step3State} number={3} locked={step3State === "locked"} icon="truck" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Step 3 · Site deployment</p>
              <p className="text-sm text-slate-700">
                {hasOpenDeployment ? (
                  <span className="font-medium text-amber-900">
                    {isOpenDeploymentForThisApplication
                      ? `Deployment #${openDeployment!.id} is ${openDeployment!.status.replace(/_/g, " ").toLowerCase()}. Confirm the worker's start on the deployment record.`
                      : `This worker already has open deployment #${openDeployment!.id} (${openDeployment!.status.replace(/_/g, " ").toLowerCase()}). End or cancel it before deploying again.`}
                  </span>
                ) : isStep4Ready || effectiveCanDeploy ? (
                  <span className="font-medium text-emerald-900">Requirements and the contract signing are complete. The employee can be assigned to a site.</span>
                ) : (
                  <span>Waiting for {!isStep1Complete ? "requirements" : "the contract signing"} before deployment activation</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 md:justify-end">
            <StepStatus state={step3State} label={hasOpenDeployment ? "Scheduled" : isStep4Ready ? "Ready to deploy" : "Locked"} />
            {hasOpenDeployment ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(openDeployment!.id) }}>
                  <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                  View deployment
                </Link>
              </Button>
            ) : isStep4Ready ? (
              <Button variant="ghost" size="sm" leftIcon={<Truck className="h-3.5 w-3.5" />} onClick={onDeployCandidate}>
                Activate deployment
              </Button>
            ) : (
              <span className="px-1 text-sm text-slate-600">Available after steps 1–2 are complete</span>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
};
