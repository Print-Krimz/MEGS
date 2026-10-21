import React from "react";
import { MaskedId } from "../../../common";
import { formatDate } from "../../../../lib/utils";
import { DetailField, SECTION_HEADING } from "./shared";

export interface IdentityTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidate: any;
  skills: string[];
}

/** Government IDs, personal details and skills. */
export const IdentityTab: React.FC<IdentityTabProps> = ({ candidate: cand, skills }) => {
  const fullAddress =
    [cand.address, cand.barangay, cand.city, cand.province, cand.postalCode].filter(Boolean).join(", ") || "Not provided";
  const emergencyContact = cand.emergencyContactName
    ? `${cand.emergencyContactName}${cand.emergencyContactRelationship ? ` (${cand.emergencyContactRelationship})` : ""}${cand.emergencyContactPhone ? ` • ${cand.emergencyContactPhone}` : ""}`
    : "Not provided";

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="emp-ids-heading">
        <h2 id="emp-ids-heading" className={SECTION_HEADING}>Government IDs</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="SSS number"><MaskedId value={cand.sss} label="SSS number" /></DetailField>
          <DetailField label="PhilHealth PIN"><MaskedId value={cand.philhealth} label="PhilHealth PIN" /></DetailField>
          <DetailField label="Pag-IBIG MID"><MaskedId value={cand.pagibig} label="Pag-IBIG MID" /></DetailField>
          <DetailField label="TIN"><MaskedId value={cand.tin} label="TIN" /></DetailField>
        </dl>
        <p className="text-sm text-slate-600">Full numbers are shown only on request. Edit details to correct a number.</p>
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="emp-personal-heading">
        <h2 id="emp-personal-heading" className={SECTION_HEADING}>Personal details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Residential address">{fullAddress}</DetailField>
          <DetailField label="Date of birth and gender">
            {`${cand.dateOfBirth ? formatDate(cand.dateOfBirth) : "Not provided"}${cand.gender ? ` · ${cand.gender}` : ""}`}
          </DetailField>
          <DetailField label="Civil status">{cand.civilStatus || "Not provided"}</DetailField>
          <DetailField label="Emergency contact">{emergencyContact}</DetailField>
        </dl>
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="emp-skills-heading">
        <h2 id="emp-skills-heading" className={SECTION_HEADING}>Skills</h2>
        {skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {skills.map((skill, index) => (
              <li key={index} className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm text-slate-800">
                {skill}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">No skills listed</p>
        )}
      </section>
    </div>
  );
};
