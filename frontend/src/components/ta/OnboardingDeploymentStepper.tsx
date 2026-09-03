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
} from "lucide-react";
import { Button } from "../ui/Button";
import { StatusBadge } from "../common/StatusBadge";
import type { Application } from "../../lib/types";
import { ApplicationStatus } from "../../lib/types";

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
  canAdvanceToContractAndOrientation,
  isAdvancingToContractAndOrientation = false,
  isContractAndOrientationStage,
  isContractSigned,
  isOrientationCompleted,
  canDeployCandidate,
  linkedClientName,
  onOpenComplianceTab,
  onAdvanceToContractAndOrientation,
  onRecordContract,
  onRecordOrientation,
  onDeployCandidate,
}) => {
  const isDeployed = app.status === ApplicationStatus.DEPLOYED;

  // Step 1 status computation
  const isStep1Complete =
    !hasUnapprovedMandatoryCompliance &&
    (totalCompReqs > 0 || isContractAndOrientationStage || isDeployed);

  // Step 2 & 3 status computation
  const isStep2Complete = isContractSigned;
  const isStep3Complete = isOrientationCompleted;

  const completedStepsCount =
    (isStep1Complete ? 1 : 0) +
    (isStep2Complete ? 1 : 0) +
    (isStep3Complete ? 1 : 0) +
    (isDeployed ? 1 : 0);

  const progressPercent = Math.round((completedStepsCount / 4) * 100);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
                  Active Workforce Site Deployment
                </h3>
                <p className="text-xs text-slate-500">
                  Candidate onboarding is 100% complete and deployed on active client assignment.
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
            <span className="text-slate-500 uppercase text-[10px] block">Client Partner</span>
            <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="truncate">{clientName}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 uppercase text-[10px] block">Site Location</span>
            <div className="font-semibold text-slate-800 truncate">
              {siteLocation}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 uppercase text-[10px] block">Designation</span>
            <div className="font-semibold text-slate-800 truncate">
              {position}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 uppercase text-[10px] block">Contract Schedule</span>
            <div className="font-semibold text-slate-800">
              {primaryDeployment?.contractStart ? formatDate(primaryDeployment.contractStart) : "Immediate"} – {primaryDeployment?.contractEnd ? formatDate(primaryDeployment.contractEnd) : "Open-ended"}
            </div>
          </div>
        </div>

        {/* Completed Onboarding Milestones Audit Trail */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">
              Verified Onboarding Milestones
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-700">
              <div className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pre-Employment Clearances ({approvedCompReqs}/{totalCompReqs})</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Contract Executed ({formatDate(app.contractSignedAt)})</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Orientation Completed ({formatDate(app.orientationDate)})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {primaryDeployment?.id && (
              <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(primaryDeployment.id) }}>
                <Button variant="primary" size="sm" leftIcon={<Truck className="w-3.5 h-3.5" />}>
                  View Field Deployment Record
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={onOpenComplianceTab}
            >
              View Requirements Checklist (Tab)
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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      {/* Header & Overall Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Personnel, Onboarding & Deployment Readiness
            </h3>
            {canDeployCandidate && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Ready to Deploy
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete the 4 pre-employment milestones to finalize hiring and activate site deployment.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
              Milestone Progress
            </div>
            <div className="text-xs font-bold font-mono text-slate-900">
              {completedStepsCount} of 4 Completed ({progressPercent}%)
            </div>
          </div>
          <div className="w-9 h-9 rounded-full border-2 border-teal-600 flex items-center justify-center font-mono text-xs font-bold text-teal-800 bg-teal-50">
            {progressPercent}%
          </div>
        </div>
      </div>

      {/* 4-Step Single-Column Linear Rows */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {/* MILESTONE 1: Pre-Employment Clearances */}
        <div
          className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            isStep1Complete ? "bg-white" : isComplianceStage ? "bg-teal-50/40" : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isStep1Complete
                  ? "bg-emerald-600 text-white"
                  : isComplianceStage
                  ? "bg-teal-700 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {isStep1Complete ? <CheckCircle2 className="w-4 h-4" /> : "1"}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  1. Pre-Employment Clearances
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    isStep1Complete
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : totalCompReqs === 0
                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {isStep1Complete ? "COMPLETE" : totalCompReqs === 0 ? "AWAITING SETUP" : "IN PROGRESS"}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                Approved Mandatory Clearances: <span className="font-semibold text-slate-900">{approvedCompReqs} / {totalCompReqs}</span>
                <span className="text-slate-300 mx-1.5">•</span>
                <span className={isStep1Complete ? "text-emerald-700" : totalCompReqs === 0 ? "text-slate-500" : "text-amber-700"}>
                  {isStep1Complete ? "All mandatory clearances verified" : totalCompReqs === 0 ? "No requirements configured yet" : "Pending verification"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {isComplianceStage && canAdvanceToContractAndOrientation && (
              <Button
                variant="primary"
                size="sm"
                loading={isAdvancingToContractAndOrientation}
                onClick={onAdvanceToContractAndOrientation}
              >
                Advance to Contract & Orientation
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={onOpenComplianceTab}
            >
              View Requirements Checklist (Tab)
            </Button>
          </div>
        </div>

        {/* MILESTONE 2: Employment Contract */}
        <div
          className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            isStep2Complete ? "bg-white" : isContractAndOrientationStage && isStep1Complete ? "bg-teal-50/40" : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isStep2Complete
                  ? "bg-emerald-600 text-white"
                  : isContractAndOrientationStage && !isStep2Complete
                  ? "bg-teal-700 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {isStep2Complete ? <CheckCircle2 className="w-4 h-4" /> : "2"}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900">
                  2. Employment Contract
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    isContractSigned
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {isContractSigned ? "SIGNED" : "PENDING SIGNATURE"}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                {isContractSigned ? (
                  <span>Signed & Executed {app.contractSignedAt && `• Date: ${formatDate(app.contractSignedAt)}`}</span>
                ) : (
                  <span className="text-slate-500">Awaiting executed employment agreement signature</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <Button
              variant={isContractSigned ? "outline" : isContractAndOrientationStage ? "primary" : "outline"}
              size="sm"
              leftIcon={<FileSignature className="w-3.5 h-3.5" />}
              onClick={onRecordContract}
            >
              {isContractSigned ? "Update Contract Details" : "Record Contract Signed"}
            </Button>
          </div>
        </div>

        {/* MILESTONE 3: Candidate Orientation */}
        <div
          className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            isStep3Complete ? "bg-white" : isContractAndOrientationStage && isContractSigned ? "bg-teal-50/40" : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                isStep3Complete
                  ? "bg-emerald-600 text-white"
                  : isContractAndOrientationStage && isContractSigned && !isStep3Complete
                  ? "bg-teal-700 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {isStep3Complete ? <CheckCircle2 className="w-4 h-4" /> : "3"}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900">
                  3. Candidate Orientation
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    isOrientationCompleted
                      ? "bg-purple-50 text-purple-800 border border-purple-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {isOrientationCompleted ? "COMPLETED" : "PENDING"}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                {isOrientationCompleted ? (
                  <span>Orientation Completed {app.orientationDate && `• Date: ${formatDate(app.orientationDate)}`}</span>
                ) : (
                  <span className="text-slate-500">Verify company policy briefing and job site orientation</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <Button
              variant={
                isOrientationCompleted
                  ? "outline"
                  : isContractAndOrientationStage && isContractSigned
                  ? "primary"
                  : "outline"
              }
              size="sm"
              leftIcon={<GraduationCap className="w-3.5 h-3.5" />}
              onClick={onRecordOrientation}
            >
              {isOrientationCompleted ? "Update Orientation Details" : "Record Orientation Complete"}
            </Button>
          </div>
        </div>

        {/* MILESTONE 4: Site Deployment & Digital 201 */}
        <div
          className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
            canDeployCandidate ? "bg-emerald-50/50" : "bg-slate-50/50"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5 ${
                canDeployCandidate ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              {canDeployCandidate ? <Truck className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs font-mono uppercase text-slate-900">
                  4. Site Deployment & Digital 201
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    canDeployCandidate
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {canDeployCandidate ? "READY TO DEPLOY" : "LOCKED"}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                {canDeployCandidate ? (
                  <span className="text-emerald-800 font-semibold">
                    All pre-employment clearances, contract execution, and orientation are verified.
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Awaiting {!isStep1Complete ? "clearances" : !isContractSigned ? "contract signing" : "orientation"} before deployment activation
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {canDeployCandidate ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Truck className="w-3.5 h-3.5" />}
                onClick={onDeployCandidate}
              >
                Deploy Candidate to Site
              </Button>
            ) : (
              <span className="text-[11px] font-mono font-medium text-slate-400 px-2 py-1">
                Locked until Steps 1–3 complete
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
