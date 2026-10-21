import React, { useState } from "react";
import { Building2 } from "lucide-react";
import { cn, formatDate } from "../../../lib/utils";

export interface EndorsementData {
  id: number;
  outcome: string;
  notes?: string | null;
  createdAt?: string | null;
  client?: { name?: string | null } | null;
}

export interface ClientReviewSummaryProps {
  endorsements: EndorsementData[];
  /** Client name from the manpower request, used when a record has no client. */
  fallbackClientName: string;
  /** The application is past the client review stage (a decision can still be written down, never sent). */
  isPastClientReview: boolean;
  canRecordDecision: boolean;
  /** The stage bar already offers "Record client decision" for a waiting decision, so the row does not repeat it. */
  stageBarOwnsDecision?: boolean;
  /** Opens the decision dialog for an existing record. */
  onRecordDecision: (endorsement: EndorsementData) => void;
  /** Opens the dialog that writes down a decision that was never entered. */
  onRecordMissing: () => void;
}

/** One status word per outcome, used everywhere the client review shows up. */
const clientOutcomeWord = (outcome?: string | null): string =>
  outcome === "APPROVED" || outcome === "ENDORSED" ? "Approved" : outcome === "DECLINED" ? "Declined" : "Waiting for client";

const wordClass = (outcome?: string | null) =>
  outcome === "APPROVED" || outcome === "ENDORSED" ? "text-emerald-800" : outcome === "DECLINED" ? "text-rose-800" : "text-amber-900";

const linkButton =
  "focus-ring inline-flex whitespace-nowrap min-h-11 items-center px-1 text-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-6";

/** The client's answer in one row. The full history opens under it. */
export const ClientReviewSummary: React.FC<ClientReviewSummaryProps> = ({
  endorsements,
  fallbackClientName,
  isPastClientReview,
  canRecordDecision,
  stageBarOwnsDecision = false,
  onRecordDecision,
  onRecordMissing,
}) => {
  const [open, setOpen] = useState(false);
  const latest = endorsements[0];

  return (
    <section id="compliance-endorsements-section" aria-labelledby="client-review-heading" className="border border-slate-300 bg-white">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <Building2 className="h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
          <h3 id="client-review-heading" className="font-semibold text-slate-900">
            Client review
          </h3>
          {latest ? (
            <>
              <span className="text-slate-700">{latest.client?.name || fallbackClientName || "Client"}</span>
              <span className={cn("font-semibold", wordClass(latest.outcome))}>{clientOutcomeWord(latest.outcome)}</span>
              {latest.createdAt && <span className="text-slate-600">Sent {formatDate(latest.createdAt)}</span>}
            </>
          ) : (
            <span className="text-slate-700">{isPastClientReview ? "None recorded" : "Not sent to a client yet"}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3">
          {latest && (
            <button type="button" className={linkButton} aria-expanded={open} aria-controls="client-review-history" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide history" : `History (${endorsements.length})`}
            </button>
          )}
          {latest && canRecordDecision && !(stageBarOwnsDecision && latest.outcome === "PENDING") && (
            <button type="button" className={linkButton} onClick={() => onRecordDecision(latest)}>
              {latest.outcome === "PENDING" ? "Record client decision" : "Change decision"}
            </button>
          )}
          {!latest && isPastClientReview && canRecordDecision && (
            <button type="button" className={linkButton} onClick={onRecordMissing}>
              Record client decision
            </button>
          )}
        </div>
      </div>

      {open && latest && (
        <ul id="client-review-history" className="divide-y divide-slate-100 border-t border-slate-200">
          {endorsements.map((end) => (
            <li key={end.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <p>
                  <span className="font-semibold text-slate-900">{end.client?.name || fallbackClientName || "Client"}</span>
                  <span className="mx-2 text-slate-400" aria-hidden="true">·</span>
                  <span className={cn("font-semibold", wordClass(end.outcome))}>{clientOutcomeWord(end.outcome)}</span>
                </p>
                {end.createdAt && <p className="text-xs text-slate-600">Sent {formatDate(end.createdAt)}</p>}
                {end.notes && <p className="text-slate-700">{end.notes}</p>}
              </div>
              {canRecordDecision && end !== latest && (
                <button type="button" className={linkButton} onClick={() => onRecordDecision(end)}>
                  Change decision
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
