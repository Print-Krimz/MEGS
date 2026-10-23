import React from "react";
import { Button } from "../../ui";
import { formatTaStatus } from "../../../lib/ta-copy";
import type { WalkInMatch } from "../../../lib/types/application.types";

interface WalkInMatchListProps {
  /** Matches still to be decided. Already-dismissed people are left out by the caller. */
  matches: WalkInMatch[];
  onUse: (match: WalkInMatch) => void;
  onDismiss: (match: WalkInMatch) => void;
}

/** "This person may already be in MEGS" with a choice for each possible match. */
export const WalkInMatchList: React.FC<WalkInMatchListProps> = ({ matches, onUse, onDismiss }) => {
  if (matches.length === 0) return null;
  return (
    <div role="group" aria-label="Possible matches" className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">
        {matches.length === 1 ? "This person may already be in MEGS." : "These people may already be in MEGS."}
      </p>
      <ul className="space-y-2">
        {matches.map((match) => (
          <li key={match.userId} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-2 first:border-t-0 first:pt-0">
            <div className="min-w-0 text-sm text-slate-900">
              <p className="font-medium">
                {match.fullName}
                {match.maskedPhone ? <span className="font-normal text-slate-700"> · {match.maskedPhone}</span> : null}
              </p>
              <p className="text-slate-700">
                {match.latestApplication
                  ? `Last applied for ${match.latestApplication.jobTitle} (${formatTaStatus(match.latestApplication.status)})`
                  : "No applications yet"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={() => onDismiss(match)}>
                Different person
              </Button>
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={() => onUse(match)}>
                Use this person
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface ExistingRecordNoticeProps {
  match: WalkInMatch;
  onUndo: () => void;
}

/** Shown after "Use this person". */
export const ExistingRecordNotice: React.FC<ExistingRecordNoticeProps> = ({ match, onUndo }) => (
  <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-navy-line bg-navy-soft px-3 py-2 text-sm text-navy">
    <span>
      Using the existing record for <strong>{match.fullName}</strong>. Blank profile fields get filled in.
    </span>
    <Button type="button" variant="ghost" size="sm" onClick={onUndo}>
      Undo
    </Button>
  </div>
);
