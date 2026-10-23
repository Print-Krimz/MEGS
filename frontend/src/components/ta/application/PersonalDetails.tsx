import React from "react";
import { Check } from "lucide-react";
import { Button } from "../../ui";
import { MaskedId } from "../../common";
import { formatDate } from "../../../lib/utils";
import { formatSSSNumber, formatPhilHealthNumber, formatPagIbigNumber, formatTINNumber } from "../../../lib/statutory-validation";

export interface PersonalDetailsProps {
  profile: any;
  /** Name, email, mobile and photo live in the summary strip; these stay optional for callers that still pass them. */
  candidateName?: string;
  candidateInitials?: string;
  email?: string | null;
  /** Opens Verify details. Leave out when there is no profile to check. */
  onVerify?: () => void;
  onOpenPhoto?: () => void;
  /** Progress of reading the resume. "idle" shows nothing. */
  readState?: "reading" | "failed" | "suggestions" | "idle";
  onRetryRead?: () => void;
  isRetrying?: boolean;
}

const Row: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
    <dt className="text-xs font-medium text-slate-600">{label}</dt>
    <dd className="mt-0.5 min-w-0 break-words text-sm text-slate-900">{children}</dd>
  </div>
);

/**
 * Read-only personal and contact details. Government IDs show the last four digits;
 * the full value is shown on request here and in full in the verify form.
 */
export const PersonalDetails: React.FC<PersonalDetailsProps> = ({ profile, onVerify, onOpenPhoto, readState = "idle", onRetryRead, isRetrying }) => {
  const address = [profile?.address, profile?.barangay, profile?.city, profile?.province, profile?.postalCode].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="personal-details-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div>
          <h3 id="personal-details-heading" className="text-base font-semibold text-slate-900">
            Personal &amp; contact
          </h3>
          {readState === "reading" && (
            <p role="status" className="text-sm text-slate-600">
              Reading bio-data…
            </p>
          )}
          {readState === "failed" && (
            <p role="alert" className="text-sm text-slate-700">
              Could not read the bio-data. Enter the details manually or try again.{" "}
              {onRetryRead && (
                <button
                  type="button"
                  onClick={onRetryRead}
                  disabled={isRetrying}
                  className="focus-ring inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline disabled:opacity-60 md:min-h-6"
                >
                  {isRetrying ? "Trying again…" : "Try again"}
                </button>
              )}
            </p>
          )}
          {readState === "suggestions" && onVerify && (
            <p className="text-sm text-slate-700">
              Suggestions waiting.{" "}
              <button
                type="button"
                onClick={onVerify}
                className="focus-ring inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline md:min-h-6"
              >
                Review
              </button>
            </p>
          )}
        </div>
        {onVerify && (
          <Button variant="outline" size="sm" type="button" onClick={onVerify} aria-label="Verify Profile Details" title="Check these details against the resume and correct them">
            Verify details
          </Button>
        )}
      </div>

      <dl className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Row label="Date of birth">{profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not provided"}</Row>
        <Row label="Gender">{profile?.gender || "Unspecified"}</Row>
        <Row label="Address" wide>
          <span title={address || undefined}>{address || "Not provided"}</span>
        </Row>
        <Row label="SSS number">
          <MaskedId value={profile?.sss ? formatSSSNumber(profile.sss) : null} label="SSS number" />
        </Row>
        <Row label="PhilHealth PIN">
          <MaskedId value={profile?.philhealth ? formatPhilHealthNumber(profile.philhealth) : null} label="PhilHealth PIN" />
        </Row>
        <Row label="Pag-IBIG MID">
          <MaskedId value={profile?.pagibig ? formatPagIbigNumber(profile.pagibig) : null} label="Pag-IBIG MID" />
        </Row>
        <Row label="TIN">
          <MaskedId value={profile?.tin ? formatTINNumber(profile.tin) : null} label="TIN" />
        </Row>
        <Row label="Emergency contact">
          {profile?.emergencyContactName || profile?.emergencyContactPhone ? (
            <span>
              {profile.emergencyContactName || "Contact"}
              {profile.emergencyContactPhone && (
                <span className="ml-1.5 inline-block text-xs tabular-nums text-slate-600">({profile.emergencyContactPhone})</span>
              )}
            </span>
          ) : (
            "Not provided"
          )}
        </Row>
        {profile?.photoUrl && onOpenPhoto && (
          <Row label="Identification photo">
            <button
              type="button"
              onClick={onOpenPhoto}
              className="focus-ring inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-6"
            >
              View photo
            </button>
          </Row>
        )}
        <Row label="Tattoos">
          {profile?.tattooStatus === "NONE" ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> None
            </span>
          ) : profile?.tattooStatus === "NON_VISIBLE" ? (
            <span className="font-medium">Non-visible / covered</span>
          ) : profile?.tattooStatus === "VISIBLE" ? (
            <span className="font-medium text-amber-800">Visible tattoos</span>
          ) : (
            <span className="text-slate-600">Unspecified</span>
          )}
        </Row>
      </dl>
    </section>
  );
};
