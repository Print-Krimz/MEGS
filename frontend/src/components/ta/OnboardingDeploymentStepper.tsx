import React from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  FileSignature,
  GraduationCap,
  Truck,
  CheckCircle2,
  Lock,
  ExternalLink,
  Building2,
  IdCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "../ui/Button";
import { StatusBadge } from "../common/StatusBadge";
import type { Application } from "../../lib/types";
import { ApplicationStatus } from "../../lib/types";
import { getApplicationStatusPresentation } from "../../lib/utils";

export interface OnboardingDeploymentStepperProps {
  app: Application;
  totalCompReqs: number;
  approvedCompReqs: number;
  hasUnapprovedMandatoryCompliance: boolean;
  isComplianceStage: boolean;
  canAdvanceToContractAndOrientation: boolean;
  isAdvancingToContractAndOrientation?: boolean;
  isContractAndOrientationStage: boolean;
  isContractSigned: boolean;
  isOrientationCompleted: boolean;
  isReadyForDeployment: boolean;
  canDeployCandidate: boolean;
  linkedClientName?: string;
  onOpenComplianceTab: () => void;
  onAdvanceToContractAndOrientation: () => void;
  onRecordContract: () => void;
  onRecordOrientation: () => void;
  onDeployCandidate: () => void;
}

export const OnboardingDeploymentStepper: React.FC<OnboardingDeploymentStepperProps> = ({
  app,
  totalCompReqs,
  approvedCompReqs,
  hasUnapprovedMandatoryCompliance,
  isComplianceStage,
  canAdvanceToContractAndOrientation: _canAdvanceToContractAndOrientation,
  isAdvancingToContractAndOrientation: _isAdvancingToContractAndOrientation = false,
  isContractAndOrientationStage,
  isContractSigned,
  isOrientationCompleted,
  canDeployCandidate,
  linkedClientName,
  onOpenComplianceTab,
  onAdvanceToContractAndOrientation: _onAdvanceToContractAndOrientation,
  onRecordContract,
  onRecordOrientation,
  onDeployCandidate,
}) => {
  const isDeployed = app.status === ApplicationStatus.DEPLOYED;

  // Single Source of Truth for Milestone Completion
  const isStep1Complete =
    !hasUnapprovedMandatoryCompliance &&
    (totalCompReqs > 0 || isContractAndOrientationStage || isDeployed);

  const isStep2Complete = Boolean(isContractSigned || app.contractSigned || app.contractSignedAt);
  const isStep3Complete = Boolean(isOrientationCompleted || app.orientationCompleted || app.orientationCompletedAt);

  const isStep4Ready = !isDeployed && isStep1Complete && isStep2Complete && isStep3Complete;
  const effectiveCanDeploy = canDeployCandidate || isStep4Ready;

  // Derive workflow sequencing & blocker info
  let blockingStepNumber: 1 | 2 | 3 | null = null;
  let blockingStepLabel = "";
  let blockerExplanation = "";
  let nextActionLabel = "";

  if (isDeployed) {
    // Fully deployed
  } else if (!isStep1Complete) {
    blockingStepNumber = 1;
    blockingStepLabel = "01 · Requirements";
    const pendingCount = Math.max(0, totalCompReqs - approvedCompReqs);
    blockerExplanation =
      totalCompReqs === 0
        ? "The pre-employment requirements list is not ready yet."
        : `${pendingCount} of ${totalCompReqs} required documents still need review.`;
    nextActionLabel = "Review requirements";
  } else if (isComplianceStage) {
    blockingStepNumber = 1;
    blockingStepLabel = "01 · Requirements";
    blockerExplanation =
      "All required documents are approved. Move the candidate to contract and orientation.";
    nextActionLabel = "Move to contract and orientation";
  } else if (!isStep2Complete) {
    blockingStepNumber = 2;
    blockingStepLabel = "02 · Employment contract";
    blockerExplanation =
      "The employment contract still needs to be signed before orientation can be scheduled.";
    nextActionLabel = "Record signed contract";
  } else if (!isStep3Complete) {
    blockingStepNumber = 3;
    blockingStepLabel = "03 · Orientation";
    blockerExplanation =
      "Orientation must be completed before the employee can start at the site.";
    nextActionLabel = "Record orientation";
  } else {
    nextActionLabel = "Activate deployment";
  }

  // Completed steps calculation (out of 4 milestones)
  const completedMilestonesCount =
    (isStep1Complete ? 1 : 0) +
    (isStep2Complete ? 1 : 0) +
    (isStep3Complete ? 1 : 0) +
    (isDeployed ? 1 : 0);

  const progressPercent = Math.round((completedMilestonesCount / 4) * 100);
  const remainingActionsCount = Math.max(0, 4 - completedMilestonesCount);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const currentStageLabel = getApplicationStatusPresentation(app.status, "staff").label;

  // =========================================================================
  // VIEW 1: 100% FINALIZED & DEPLOYED PLACEMENT SUMMARY CARD
  // =========================================================================
  if (isDeployed) {
    const primaryDeployment = app.deployments?.[0];
    const clientName = primaryDeployment?.client?.name || linkedClientName || "Client Corporate Partner";
    const siteLocation = primaryDeployment?.site || "Client Designated Site";
    const employeeNumber = app.hiredEmployee?.employeeNumber || "EMP-ROSTERED";
    const position = app.hiredEmployee?.position || app.jobPosting?.title || "Specialist";

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Active site deployment
                </h3>
                <p className="text-xs text-slate-500">
                  All requirements are complete and the employee is assigned to a client site.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {app.hiredEmployee?.id ? (
              <Link
                to="/ta/employees/$employeeId"
                params={{ employeeId: String(app.hiredEmployee.id) }}
                className="inline-flex"
              >
                <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-teal-800 hover:underline border border-slate-300 rounded flex items-center gap-1.5 transition-colors">
                  <IdCard className="w-3.5 h-3.5 text-teal-700" />
                  {employeeNumber}
                </span>
              </Link>
            ) : (
              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded">
                {employeeNumber}
              </span>
            )}
            {primaryDeployment && (
              <StatusBadge status={primaryDeployment.status} type="deployment" size="sm" />
            )}
          </div>
        </div>

        {/* Deployment Specifications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
          <div className="space-y-1">
            <span className="text-slate-500 block">Client</span>
            <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="truncate">{clientName}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 block">Site</span>
            <div className="font-semibold text-slate-800 truncate">
              {siteLocation}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 block">Position</span>
            <div className="font-semibold text-slate-800 truncate">
              {position}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 block">Contract dates</span>
            <div className="font-semibold text-slate-800">
              {primaryDeployment?.contractStart ? formatDate(primaryDeployment.contractStart) : "Immediate"} – {primaryDeployment?.contractEnd ? formatDate(primaryDeployment.contractEnd) : "Open-ended"}
            </div>
          </div>
        </div>

        {/* Completed Onboarding Milestones Audit Trail */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block">
              Completed steps
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-700">
              <div className="flex items-center gap-1 text-emerald-800 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Requirements approved ({approvedCompReqs}/{totalCompReqs})</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-emerald-800 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Contract signed ({formatDate(app.contractSignedAt)})</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-emerald-800 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Orientation complete ({formatDate(app.orientationDate)})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {primaryDeployment?.id && (
              <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(primaryDeployment.id) }}>
                <Button variant="primary" size="sm" leftIcon={<Truck className="w-3.5 h-3.5" />}>
                  View deployment
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={onOpenComplianceTab}
            >
              View requirements
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: IN-PROGRESS LINEAR ONBOARDING WORKFLOW (SINGLE-CONTAINER)
  // =========================================================================
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
      {/* Header & Overall Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">
              Deployment readiness
            </h3>
            {effectiveCanDeploy ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Ready to deploy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 uppercase tracking-wide">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Waiting for earlier steps
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            <span className="text-slate-500 font-medium">Current stage</span>
            <span className="font-semibold text-slate-800">{currentStageLabel}</span>
          </div>
        </div>

        {/* Compact Horizontal Progress Bar (Point 15) */}
        <div className="w-full sm:w-56 space-y-1.5 bg-slate-50 border border-slate-200 p-2.5 rounded-lg shrink-0">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-900">{completedMilestonesCount} of 4 steps complete</span>
            <span className="font-semibold text-slate-700">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-teal-700 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-500 text-right">
            {remainingActionsCount === 0
            ? "All steps complete"
              : `${remainingActionsCount} ${remainingActionsCount === 1 ? "action" : "actions"} remaining`}
          </div>
        </div>
      </div>

      {/* Recruiter Blocker Diagnosis Banner (STATUS -> BLOCKER -> NEXT ACTION) */}
      {!effectiveCanDeploy ? (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-950 font-sans">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                Waiting for earlier steps
              </span>
              {blockingStepLabel && (
                <span className="text-xs font-mono font-semibold text-amber-900">
                  Waiting on: {blockingStepLabel}
                </span>
              )}
            </div>
            <p className="text-slate-800 leading-normal text-xs">
              {blockerExplanation}
            </p>
            <div className="text-xs font-semibold text-amber-950">
              Next step: <span className="font-normal text-slate-800">{nextActionLabel}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-start gap-3 text-xs text-emerald-950 font-sans">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <span className="font-bold font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 tracking-wide">
              Ready to deploy
            </span>
            <p className="text-slate-800 leading-normal text-xs mt-1">
              Requirements, contract, and orientation are complete. The employee can be assigned to a site.
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Single-Column Linear Rows (Point 12 Standardized Structure) */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {/* MILESTONE 1: Pre-Employment Clearances */}
        <div
          className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            blockingStepNumber === 1
              ? "bg-amber-50/50 ring-1 ring-inset ring-amber-200"
              : isStep1Complete
              ? "bg-white"
              : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isStep1Complete
                  ? "bg-emerald-600 text-white"
                  : blockingStepNumber === 1
                  ? "bg-amber-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {isStep1Complete ? <CheckCircle2 className="w-4 h-4" /> : "1"}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs font-mono uppercase text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  01 · Requirements
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                Approved: <span className="font-semibold text-slate-900">{approvedCompReqs} / {totalCompReqs}</span>
                <span className="text-slate-300 mx-1.5">•</span>
                <span className={isStep1Complete ? "text-emerald-700" : totalCompReqs === 0 ? "text-slate-500" : "text-amber-800"}>
                  {isStep1Complete
                    ? "All required documents approved"
                    : totalCompReqs === 0
                    ? "No requirements configured yet"
                    : `${totalCompReqs - approvedCompReqs} documents still need review`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                isStep1Complete
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : blockingStepNumber === 1
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : totalCompReqs === 0
                  ? "bg-slate-100 text-slate-600 border-slate-200"
                  : "bg-blue-50 text-blue-800 border-blue-200"
              }`}
            >
              {isStep1Complete
                ? "Complete"
                : blockingStepNumber === 1
                ? "Action needed"
                : totalCompReqs === 0
                ? "Not set up"
                : "In progress"}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenComplianceTab}
            >
              View requirements
            </Button>
          </div>
        </div>

        {/* MILESTONE 2: Employment Contract */}
        <div
          className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            blockingStepNumber === 2
              ? "bg-amber-50/50 ring-1 ring-inset ring-amber-200"
              : isStep2Complete
              ? "bg-white"
              : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isStep2Complete
                  ? "bg-emerald-600 text-white"
                  : blockingStepNumber === 2
                  ? "bg-amber-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {isStep2Complete ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : !isStep1Complete || isComplianceStage ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                "2"
              )}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900">
                  02 · Employment contract
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                {isStep2Complete ? (
                  <span>Signed {app.contractSignedAt && `• ${formatDate(app.contractSignedAt)}`}</span>
                ) : !isStep1Complete ? (
                  <span className="text-slate-500">Available after requirements are approved</span>
                ) : isComplianceStage ? (
                  <span className="text-slate-500">Available after the candidate moves to contract and orientation</span>
                ) : (
                  <span className="text-amber-800">Waiting for signed contract</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                isStep2Complete
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : blockingStepNumber === 2
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {isStep2Complete
                ? "Complete"
                : blockingStepNumber === 2
                ? "Action needed"
                : "Locked"}
            </span>

            {isStep2Complete ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileSignature className="w-3.5 h-3.5" />}
                onClick={onRecordContract}
              >
                Update contract
              </Button>
            ) : isContractAndOrientationStage && isStep1Complete ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileSignature className="w-3.5 h-3.5" />}
                onClick={onRecordContract}
              >
                Record contract
              </Button>
            ) : (
              <span className="text-xs font-mono text-slate-500 px-2 py-1">
                Not available yet
              </span>
            )}
          </div>
        </div>

        {/* MILESTONE 3: Corporate Orientation */}
        <div
          className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            blockingStepNumber === 3
              ? "bg-amber-50/50 ring-1 ring-inset ring-amber-200"
              : isStep3Complete
              ? "bg-white"
              : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isStep3Complete
                  ? "bg-emerald-600 text-white"
                  : blockingStepNumber === 3
                  ? "bg-amber-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {isStep3Complete ? <CheckCircle2 className="w-4 h-4" /> : !isStep2Complete ? <Lock className="w-3.5 h-3.5" /> : "3"}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900">
                  03 · Orientation
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                {isStep3Complete ? (
                  <span>Complete {app.orientationDate && `• ${formatDate(app.orientationDate)}`}</span>
                ) : !isStep2Complete ? (
                  <span className="text-slate-500">Available after the contract is signed</span>
                ) : (
                  <span className="text-amber-800">Required before site deployment</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                isStep3Complete
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : blockingStepNumber === 3
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : !isStep2Complete
                  ? "bg-slate-100 text-slate-500 border-slate-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {isStep3Complete
                ? "Complete"
                : blockingStepNumber === 3
                ? "Action needed"
                : !isStep2Complete
                ? "Locked"
                : "Pending"}
            </span>

            {isStep2Complete ? (
              <Button
                variant={isStep3Complete ? "outline" : "primary"}
                size="sm"
                leftIcon={<GraduationCap className="w-3.5 h-3.5" />}
                onClick={onRecordOrientation}
              >
                {isStep3Complete ? "Update orientation" : "Record orientation"}
              </Button>
            ) : (
              <span className="text-xs font-mono text-slate-500 px-2 py-1">
                Not available yet
              </span>
            )}
          </div>
        </div>

        {/* MILESTONE 4: Site deployment and employee record */}
        <div
          className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            isStep4Ready
              ? "bg-emerald-50/50 ring-1 ring-inset ring-emerald-200"
              : isDeployed
              ? "bg-white"
              : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isDeployed || isStep4Ready ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              {isDeployed || isStep4Ready ? <Truck className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900">
                  04 · Site deployment
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                {isDeployed ? (
                  <span className="text-emerald-800 font-semibold">
                    Employee active at the client site
                  </span>
                ) : isStep4Ready ? (
                  <span className="text-emerald-800 font-semibold">
                    Requirements, contract, and orientation are complete.
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Waiting for {!isStep1Complete ? "requirements" : !isStep2Complete ? "contract signing" : "orientation"} before deployment activation
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                isDeployed
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : isStep4Ready
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {isDeployed ? "Deployed" : isStep4Ready ? "Ready to deploy" : "Locked"}
            </span>

            {isStep4Ready ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Truck className="w-3.5 h-3.5" />}
                onClick={onDeployCandidate}
              >
                Activate deployment
              </Button>
            ) : (
              <span className="text-xs font-mono text-slate-500 px-2 py-1">
                Available after steps 1–3 are complete
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
