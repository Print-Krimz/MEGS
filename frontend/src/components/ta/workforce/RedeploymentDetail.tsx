import React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "../../ui";
import { applicationStatusLabel } from "../../../lib/labels";
import type { RedeploymentJobSuggestion, RedeploymentStage } from "../../../lib/api/employees.api";
import { formatDate } from "../../../lib/utils";
import { TA_COPY } from "../../../lib/ta-copy";
import { Avatar, ToneChip } from "./WorkforceRow";
import {
  REDEPLOYMENT_STAGES,
  STAGE_TONE,
  suggestionReason,
  suggestionTag,
  waitingAge,
  type RedeploymentRow,
} from "./redeployment-helpers";

export const StageChip: React.FC<{ stage: RedeploymentStage }> = ({ stage }) => (
  <ToneChip tone={STAGE_TONE[stage]}>{REDEPLOYMENT_STAGES.find((item) => item.id === stage)?.label ?? stage}</ToneChip>
);

const SHOWN_SUGGESTIONS = 3;

export interface RedeploymentDetailProps {
  row: RedeploymentRow;
  suggestions?: { total: number; suggestions: RedeploymentJobSuggestion[] };
  suggestionsLoading: boolean;
  suggestionsFailed: boolean;
  onRetrySuggestions: () => void;
  /** Opens the invitation dialog, optionally with a job already chosen. */
  onFindJob: (jobId?: number) => void;
}

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-semibold text-slate-950">{children}</h3>
);

/**
 * Everything the queue row leaves out: why jobs fit, the worker's applications and the next step.
 * Sits beside the list on wide screens and opens as a drill-down on narrow ones.
 */
export const RedeploymentDetail: React.FC<RedeploymentDetailProps> = ({
  row,
  suggestions,
  suggestionsLoading,
  suggestionsFailed,
  onRetrySuggestions,
  onFindJob,
}) => {
  const wait = waitingAge(row.waitingSince);
  const inProgress = row.stage === "IN_PROGRESS";
  const newestApplication = row.applications[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Avatar name={row.name} className="h-12 w-12 text-base" />
        <div className="min-w-0 space-y-1">
          <h2 className="break-words font-display text-xl leading-tight text-slate-950">{row.name}</h2>
          <p className="font-mono text-xs text-slate-600">{row.employeeNumber}</p>
          <StageChip stage={row.stage} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-slate-600">Previous placement</dt>
          <dd className="mt-0.5 break-words text-slate-900">
            {row.previousClient || row.previousRole ? (
              <>
                <span className="font-medium">{row.previousClient || "—"}</span>
                <span className="block text-slate-600">{row.previousRole || "—"}</span>
              </>
            ) : (
              <span className="text-slate-600">None on record</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-slate-600">Waiting</dt>
          <dd className="mt-0.5 text-slate-900">
            {wait.text}
            {row.waitingSince && <span className="block text-slate-600">Since {formatDate(row.waitingSince)}</span>}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-xs font-medium text-slate-600">Next step</dt>
          <dd className="mt-0.5 text-slate-900">
            {row.nextAction}
            {row.pendingInvitation && <span className="block text-slate-600">Invited to {row.pendingInvitation.title}</span>}
          </dd>
        </div>
      </dl>

      {row.applications.length > 0 && (
        <section className="space-y-1.5" aria-label="Applications in progress">
          <SectionHeading>{inProgress ? "Applying now" : "Applications"}</SectionHeading>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-300">
            {row.applications.map((application) => (
              <li key={application.id}>
                <Link
                  to="/ta/applications/$applicationId"
                  params={{ applicationId: String(application.id) }}
                  className="focus-ring flex min-h-11 flex-col justify-center px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-navy">{application.title}</span>
                  <span className="text-xs text-slate-600">
                    {[application.client, applicationStatusLabel(application.status)].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!inProgress && (
        <section className="space-y-2" aria-label="Suggested jobs">
          <SectionHeading>
            Suggested jobs{suggestions && suggestions.total > 0 ? ` (${suggestions.total})` : ""}
          </SectionHeading>
          {suggestionsLoading ? (
            <p className="text-sm text-slate-600">Finding matching jobs…</p>
          ) : suggestionsFailed ? (
            <p className="text-sm text-slate-600">
              Could not load suggestions.{" "}
              <button type="button" onClick={onRetrySuggestions} className="focus-ring inline-flex min-h-11 items-center font-medium text-navy hover:underline">
                Retry
              </button>
            </p>
          ) : !suggestions || suggestions.total === 0 ? (
            <p className="text-sm text-slate-600">No matching open jobs. Search all open jobs from Find a job.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.suggestions.slice(0, SHOWN_SUGGESTIONS).map((suggestion) => (
                <li key={suggestion.jobId}>
                  <button
                    type="button"
                    onClick={() => onFindJob(suggestion.jobId)}
                    className="focus-ring block min-h-11 w-full rounded-md border border-slate-300 bg-white p-3 text-left hover:bg-slate-50"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-950">{suggestion.title}</span>
                      <span className="shrink-0 text-xs font-medium text-slate-700">{suggestionTag(suggestion)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {[suggestion.clientName, suggestion.location].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">{suggestionReason(suggestion)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        {inProgress ? (
          newestApplication && (
            <Button asChild variant="primary" size="sm">
              <Link to="/ta/applications/$applicationId" params={{ applicationId: String(newestApplication.id) }}>
                Open application
              </Link>
            </Button>
          )
        ) : (
          <Button variant="primary" size="sm" onClick={() => onFindJob()}>
            {TA_COPY.workforce.actions.findJob}
            <span className="sr-only"> for {row.name}</span>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/ta/employees/$employeeId" params={{ employeeId: String(row.id) }}>
            Open employee record
          </Link>
        </Button>
      </div>
    </div>
  );
};
