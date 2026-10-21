import React from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../../../ui";
import { humanizeEnum } from "../../../../lib/labels";

const formatAgeRange = (min?: number | null, max?: number | null): string => {
  if (min != null && max != null) return `${min} - ${max} years old`;
  if (min != null) return `At least ${min} years old`;
  if (max != null) return `Up to ${max} years old`;
  return "No age limit specified";
};

const formatGenderPreference = (preference?: string | null): string => {
  switch (preference) {
    case "MALE":
      return "Male preferred";
    case "FEMALE":
      return "Female preferred";
    default:
      return "Any";
  }
};

const formatTattooPolicy = (policy?: string | null): string => {
  switch (policy) {
    case "NO_VISIBLE":
      return "No visible tattoos";
    case "NONE":
      return "No tattoos permitted";
    default:
      return "Allowed";
  }
};

/** Stored values are usually readable ("On-site"); legacy codes like ON_SITE or REGULAR get humanized, hyphenated words are kept. */
// oxlint-disable-next-line react/only-export-components
export const formatSpecValue = (value: string): string =>
  /^[A-Z0-9_]+$/.test(value) ? humanizeEnum(value).replace(/^On site$/, "On-site") : value;

const Spec: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? "md:col-span-2" : undefined}>
    <dt className="text-sm font-medium text-slate-600">{label}</dt>
    <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
  </div>
);

const Panel: React.FC<{ title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

interface MRFOverviewTabProps {
  mrf: any;
  templates: any[];
  readOnly: boolean;
  onAddDocument: () => void;
  onRemoveTemplate: (target: { id: number; label: string }) => void;
}

/** Request details, client contact and required documents. */
export const MRFOverviewTab: React.FC<MRFOverviewTabProps> = ({ mrf, templates, readOnly, onAddDocument, onRemoveTemplate }) => (
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <div className="lg:col-span-2">
      <Panel title="Request details and client criteria">
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
          {mrf.description || "No additional description provided for this request."}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-200 pt-4 md:grid-cols-2">
          <Spec label="Work site">{mrf.location || "Not specified"}</Spec>
          <Spec label="Employment and arrangement">
            {formatSpecValue(mrf.employmentType || "Contractual")} · {formatSpecValue(mrf.workArrangement || "On-site")}
          </Spec>
          {(mrf.salaryRangeMin != null || mrf.salaryRangeMax != null) && (
            <Spec label="Monthly salary range" wide>
              {mrf.salaryRangeMin != null ? `PHP ${mrf.salaryRangeMin.toLocaleString()}` : "PHP 0"} –{" "}
              {mrf.salaryRangeMax != null ? `PHP ${mrf.salaryRangeMax.toLocaleString()}` : "Open"}
            </Spec>
          )}
          <Spec label="Age limits">{formatAgeRange(mrf.ageMin, mrf.ageMax)}</Spec>
          <Spec label="Gender preference">{formatGenderPreference(mrf.genderPreference)}</Spec>
          <Spec label="Tattoo policy">{formatTattooPolicy(mrf.tattooPolicy)}</Spec>
          <Spec label="Required skills">{mrf.requiredSkills || "None specified"}</Spec>
          <Spec label="Required experience">{mrf.requiredExperience || "No experience required"}</Spec>
          <Spec label="Minimum education">{mrf.requiredEducation || "None required"}</Spec>
          <Spec label="Certifications and licenses">{mrf.requiredCertifications || "None required"}</Spec>
        </dl>
      </Panel>
    </div>

    <div className="space-y-5">
      <Panel title="Client information">
        <div className="space-y-2 text-sm">
          <div className="font-semibold text-slate-900">{mrf.client?.name || "Client"}</div>
          <div className="text-slate-700">Industry: {mrf.client?.industry || "Commercial"}</div>
          <div className="break-all text-slate-700">Contact: {mrf.client?.contactEmail || "Not provided"}</div>
        </div>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-navy" aria-hidden="true" />
            Required documents
          </span>
        }
        action={
          !readOnly ? (
            <Button variant="outline" size="sm" onClick={onAddDocument}>
              Add document
            </Button>
          ) : undefined
        }
      >
        {templates.length === 0 ? (
          <p className="text-sm text-slate-600">
            {readOnly
              ? "No required documents assigned to this request."
              : "No required documents assigned. Add the document types candidates must provide."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {templates.map((tpl: any) => (
              <li key={tpl.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-slate-900">{tpl.documentLabel}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{tpl.isRequired ? "Mandatory" : "Optional"}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveTemplate({ id: tpl.id, label: tpl.documentLabel })}
                      aria-label={`Remove ${tpl.documentLabel}`}
                      title="Remove template"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-rose-600 hover:text-rose-800 focus-ring md:min-h-8 md:min-w-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  </div>
);
