import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { DateField } from "../common/DateField";
import { getManilaToday, toManilaDateInput } from "../../lib/field-limits";
import { requirementStatusLabel } from "../../lib/labels";

export type RequirementDecision = "APPROVED" | "REJECTED" | "TO_FOLLOW";
export type RequirementValidity = "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY";

/** The fields of a compliance requirement this dialog reads. Application and TA types satisfy it. */
export interface ReviewableRequirement {
  id: number;
  documentLabel: string;
  documentId?: number | null;
  reviewStatus: string;
  reviewNotes?: string | null;
  toFollowExpectedAt?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  validityStatus?: RequirementValidity | null;
  updateRequestedAt?: string | null;
  updateRequestCompletedAt?: string | null;
}

/** Same shape the review mutation already takes. */
export interface RequirementReviewValues {
  reviewStatus: RequirementDecision;
  reviewNotes?: string;
  validityStatus?: RequirementValidity;
  issuedAt?: string | null;
  expiresAt?: string | null;
  toFollowExpectedAt?: string | null;
}

export interface RequirementReviewDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Who and what is being reviewed, e.g. "Maria Cruz · Security guard". */
  subtitle?: string;
  /** One item shows no picker. Several items show a list on the left. */
  requirements: ReviewableRequirement[];
  /** Requirement selected when the dialog opens. Defaults to the first one. */
  initialRequirementId?: number | null;
  /** pre: before deployment (candidate can start with a follow-up). post: worker already deployed. */
  mode?: "pre" | "post";
  /** Opens the full document viewer. When set and a file exists, an "Open uploaded document" button shows. */
  onOpenDocument?: (requirement: ReviewableRequirement) => void;
  /** Optional inline preview (for example the page's thumbnail component). Rendered when a file exists. */
  renderDocumentPreview?: (requirement: ReviewableRequirement) => React.ReactNode;
  /** Right-hand part of each picker row. Defaults to the requirement status word. */
  renderListMeta?: (requirement: ReviewableRequirement) => React.ReactNode;
  /** Approval needs an uploaded file. Default true. */
  requireDocumentForApproval?: boolean;
  /** Caller keeps its own mutation and cache invalidation. */
  onSubmit: (values: RequirementReviewValues, requirement: ReviewableRequirement) => void;
  isSubmitting?: boolean;
}

const MEDICAL_LABEL = /medical|fit\s+to\s+work|health/i;

/** Same rule as the backend: an open updated-copy request blocks approval until the new file arrives. */
export const isAwaitingUpdatedCopy = (req?: ReviewableRequirement | null): boolean =>
  Boolean(req?.updateRequestedAt && !req.updateRequestCompletedAt && req.reviewStatus !== "SUBMITTED");

const initialDecision = (req?: ReviewableRequirement | null): RequirementDecision | "" =>
  req && (req.reviewStatus === "APPROVED" || req.reviewStatus === "REJECTED" || req.reviewStatus === "TO_FOLLOW")
    ? req.reviewStatus
    : "";

export const RequirementReviewDialog: React.FC<RequirementReviewDialogProps> = ({
  open,
  onClose,
  title = "Review requirement",
  subtitle,
  requirements,
  initialRequirementId,
  mode = "pre",
  onOpenDocument,
  renderDocumentPreview,
  renderListMeta,
  requireDocumentForApproval = true,
  onSubmit,
  isSubmitting = false,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decision, setDecision] = useState<RequirementDecision | "">("");
  const [notes, setNotes] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [validity, setValidity] = useState<RequirementValidity>("UNKNOWN");
  const [followDate, setFollowDate] = useState("");

  const selected = useMemo(
    () => requirements.find((r) => r.id === selectedId) ?? null,
    [requirements, selectedId]
  );

  const loadFrom = (req?: ReviewableRequirement | null) => {
    setSelectedId(req?.id ?? null);
    setDecision(initialDecision(req));
    setNotes(req?.reviewNotes || "");
    setIssuedAt(req?.issuedAt?.slice(0, 10) || "");
    setExpiresAt(req?.expiresAt?.slice(0, 10) || "");
    setValidity(req?.validityStatus || "UNKNOWN");
    setFollowDate(req?.toFollowExpectedAt ? toManilaDateInput(req.toFollowExpectedAt) : "");
  };

  // Load the starting requirement each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    loadFrom(requirements.find((r) => r.id === initialRequirementId) ?? requirements[0]);
    // Only reopen resets the form, so a refetch while open never wipes what the reviewer typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRequirementId]);

  const hasFile = Boolean(selected?.documentId);
  const awaitingCopy = isAwaitingUpdatedCopy(selected);
  const isMedical = MEDICAL_LABEL.test(selected?.documentLabel || "");

  // The first reason the reviewer cannot save yet. Shown next to the button so a disabled button is never a mystery.
  const blockReason = (() => {
    if (!selected) return null;
    if (!decision) return "Choose a decision to continue.";
    if (decision === "APPROVED") {
      if (requireDocumentForApproval && !hasFile) return "The document has not been uploaded yet.";
      if (awaitingCopy) return "An updated copy was requested. Approve once the new file is uploaded.";
      if (validity === "UNKNOWN") return "Choose whether the document has an expiry date.";
      if (validity === "HAS_EXPIRY" && !expiresAt) return "Enter the expiry date.";
      if (isMedical && !issuedAt) return "Enter the issue date for this document.";
    }
    if (decision === "REJECTED" && !notes.trim()) return "Add a note explaining why this was rejected.";
    return null;
  })();

  const handleSave = () => {
    if (!selected || !decision || blockReason) return;
    const values: RequirementReviewValues = {
      reviewStatus: decision,
      reviewNotes: notes.trim() || undefined,
    };
    if (decision === "APPROVED") {
      values.validityStatus = validity;
      values.issuedAt = issuedAt || null;
      values.expiresAt = validity === "NO_EXPIRY" ? null : expiresAt || null;
    }
    if (decision === "TO_FOLLOW") {
      values.toFollowExpectedAt = mode === "post" ? followDate || null : followDate || undefined;
    }
    onSubmit(values, selected);
  };

  const picker = requirements.length > 1;
  const decisionOptions = [
    { value: "", label: "Select a decision…" },
    { value: "APPROVED", label: "Approve: document is valid" },
    {
      value: "TO_FOLLOW",
      label: mode === "post" ? "To follow: update the target date" : "To follow: allow deployment, follow up later",
    },
    { value: "REJECTED", label: "Reject: document needs correction" },
  ];

  const detail = selected ? (
    <div className={picker ? "space-y-3 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" : "space-y-3"}>
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <span className="font-semibold text-slate-900">{selected.documentLabel}</span>
        <span className="text-slate-600">{requirementStatusLabel(selected.reviewStatus)}</span>
      </div>

      {hasFile ? (
        <>
          {renderDocumentPreview?.(selected)}
          {onOpenDocument && (
            <button
              type="button"
              onClick={() => onOpenDocument(selected)}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-blue-700 underline hover:text-blue-900 md:min-h-0"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open uploaded document
            </button>
          )}
        </>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
          No document uploaded yet.
        </p>
      )}

      {awaitingCopy && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          An updated copy was requested. The file above is the old one. You can approve once the new copy is uploaded.
        </p>
      )}

      <Select
        label="Decision"
        value={decision}
        onChange={(e) => setDecision(e.target.value as RequirementDecision | "")}
        options={decisionOptions}
      />

      {decision === "APPROVED" && (
        <>
          <DateField
            label="Issue date (if shown)"
            value={issuedAt}
            max={getManilaToday()}
            onChange={(e) => setIssuedAt(e.target.value)}
            required={isMedical}
          />
          <Select
            label="Document validity"
            value={validity}
            onChange={(e) => setValidity(e.target.value as RequirementValidity)}
            options={[
              { value: "UNKNOWN", label: "Choose…" },
              { value: "HAS_EXPIRY", label: "Has an expiry date" },
              { value: "NO_EXPIRY", label: "No expiry" },
            ]}
          />
          {validity === "HAS_EXPIRY" && (
            <DateField
              label="Expiry date"
              value={expiresAt}
              min={issuedAt || undefined}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          )}
        </>
      )}

      {decision === "TO_FOLLOW" && (
        <DateField
          label="Target completion date (optional)"
          value={followDate}
          min={getManilaToday()}
          max="2100-12-31"
          onChange={(e) => setFollowDate(e.target.value)}
          help={
            mode === "post"
              ? "Keep this date updated until the worker submits the final file."
              : "The candidate can be deployed now. This document stays on the follow-up list until it is submitted."
          }
        />
      )}

      <Textarea
        label={decision === "REJECTED" ? "Notes for the candidate (required)" : "Notes for the candidate (optional)"}
        placeholder="Explain what was verified, or what needs to be corrected."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={decision === "REJECTED" && !notes.trim() ? "Add a note explaining why this was rejected." : undefined}
        rows={2}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {blockReason && decision !== "" && decision !== "REJECTED" && (
          <p className="mr-auto text-sm text-slate-600" role="status">
            {blockReason}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant={decision === "REJECTED" ? "danger" : "primary"}
          size="sm"
          loading={isSubmitting}
          disabled={!decision || Boolean(blockReason)}
          onClick={handleSave}
        >
          {decision === "REJECTED" ? "Reject document" : "Save review"}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex justify-end border-t border-slate-100 pt-3">
      <Button variant="outline" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} title={title} description={subtitle} size={picker ? "xl" : "md"}>
      {picker ? (
        <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">Documents to review ({requirements.length})</p>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 lg:max-h-[28rem]">
              {requirements.map((req) => {
                const isSelected = req.id === selectedId;
                return (
                  <li key={req.id}>
                    <button
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => loadFrom(req)}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 p-2.5 text-left text-sm transition-colors ${
                        isSelected ? "bg-slate-100 font-medium text-slate-950" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate" title={req.documentLabel}>
                        {req.documentLabel}
                      </span>
                      <span className="shrink-0 text-xs text-slate-600">
                        {renderListMeta ? renderListMeta(req) : requirementStatusLabel(req.reviewStatus)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {detail}
        </div>
      ) : (
        detail
      )}
    </Dialog>
  );
};
