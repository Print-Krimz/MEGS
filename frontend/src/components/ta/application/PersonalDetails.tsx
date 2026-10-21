import React, { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "../../ui";
import { MaskedId } from "../../common";
import { formatDate } from "../../../lib/utils";
import { formatSSSNumber, formatPhilHealthNumber, formatPagIbigNumber, formatTINNumber } from "../../../lib/statutory-validation";

export interface PersonalDetailsProps {
  profile: any;
  candidateName: string;
  candidateInitials: string;
  onVerify: () => void;
  onOpenPhoto: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
    <dt className="text-slate-600">{label}</dt>
    <dd className="min-w-0 text-slate-900">{children}</dd>
  </div>
);

/**
 * Read-only personal and contact details. Government IDs show the last four digits;
 * the full value is shown on request here and in full in the verify form.
 */
export const PersonalDetails: React.FC<PersonalDetailsProps> = ({ profile, candidateName, candidateInitials, onVerify, onOpenPhoto }) => {
  const [photoImgError, setPhotoImgError] = useState(false);
  const address = [profile?.address, profile?.barangay, profile?.city, profile?.province, profile?.postalCode].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="personal-details-heading" className="space-y-3 border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <h3 id="personal-details-heading" className="text-sm font-semibold text-slate-900">
          Personal & contact details
        </h3>
        <Button variant="outline" size="sm" type="button" onClick={onVerify} aria-label="Verify Profile Details" title="Verify candidate profile side-by-side with resume">
          Verify details
        </Button>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
        <div className="shrink-0">
          {profile?.photoUrl && !photoImgError ? (
            <button type="button" onClick={onOpenPhoto} className="focus-ring rounded-md" aria-label="View full photo" title="View full photo">
              <img
                src={profile.photoUrl}
                alt="Profile"
                className="h-16 w-16 rounded-md border border-slate-300 object-cover"
                onError={() => setPhotoImgError(true)}
              />
            </button>
          ) : (
            <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-md bg-navy-soft text-base font-semibold text-navy ring-1 ring-inset ring-navy-line">
              {candidateInitials}
            </div>
          )}
        </div>

        <dl className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
          <Row label="Full name">
            <span className="font-semibold">{candidateName}</span>
          </Row>
          <Row label="Mobile">
            <span className="tabular-nums">{profile?.mobileNumber || "Not provided"}</span>
          </Row>
          <Row label="Date of birth">{profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not provided"}</Row>
          <Row label="Gender">{profile?.gender || "Unspecified"}</Row>
          <Row label="City">{profile?.city ? `${profile.city}, ${profile.province || ""}` : profile?.province || "Philippines"}</Row>
          <Row label="Address">
            <span className="break-words" title={address || undefined}>
              {address || "Not provided"}
            </span>
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
      </div>
    </section>
  );
};
