import React from "react";
import { AlertTriangle } from "lucide-react";
import type { RequirementClarity } from "../../lib/types/ta.types";

interface RequirementClarityNoticeProps {
  clarity?: RequirementClarity | null;
  /** Where the user fixes it, e.g. "Edit the client request" or "Edit this request". */
  fixHint: string;
}

/**
 * Shown when a job or request states requirements the match score can't use: personal
 * qualities listed as skills, or a location that is not a city or province.
 */
export const RequirementClarityNotice: React.FC<RequirementClarityNoticeProps> = ({ clarity, fixHint }) => {
  if (!clarity || (!clarity.skillsAreTraits && !clarity.locationNotAPlace)) return null;

  const problems = [
    clarity.skillsAreTraits && "the required skills are personal qualities, not job skills",
    clarity.locationNotAPlace && "the location is not a city, municipality or province",
  ].filter(Boolean);

  return (
    <div role="note" className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 text-sm text-amber-900">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Requirements need clarification:</span> {problems.join("; ")}. Match scores
        leave these out until they are fixed. {fixHint}
      </p>
    </div>
  );
};
