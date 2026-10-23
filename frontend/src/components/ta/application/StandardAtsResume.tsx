import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../ui";
import { formatDate } from "../../../lib/utils";
import { verificationText } from "./BioDataReviewPanel";

export interface AtsRequirement {
  documentLabel: string;
  reviewStatus: string;
}

export interface StandardAtsResumeProps {
  profile: any;
  email?: string | null;
  /** The application tracking code, when it has one. */
  reference?: string | null;
  requirements?: AtsRequirement[];
  showContact: boolean;
  /** ISO date printed in the footer. Defaults to today. */
  preparedOn?: string;
}

/** 0917 123 4567 becomes 0917•••4567. Short numbers are hidden entirely. */
export const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? `${digits.slice(0, 4)}•••${digits.slice(-4)}` : "••••••••";
};

export const maskEmail = (value: string): string => {
  const [name, domain] = value.split("@");
  return domain ? `${name.slice(0, 1)}•••@${domain}` : "•••";
};

const monthYear = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "Asia/Manila" }).format(d);
};

const range = (start?: string | null, end?: string | null, current?: boolean): string => {
  const from = monthYear(start);
  const to = current ? "Present" : monthYear(end);
  return [from, to].filter(Boolean).join(" – ");
};

const skillName = (skill: unknown): string => (typeof skill === "string" ? skill : (skill as { name?: string })?.name ?? "").trim();

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-5">
    <h2 className="border-b border-black pb-0.5 text-sm font-bold uppercase tracking-wide">{title}</h2>
    <div className="mt-2 space-y-3">{children}</div>
  </section>
);

/** The stored profile as a plain, single-column resume. Only stored data is shown. */
export const StandardAtsResume: React.FC<StandardAtsResumeProps> = ({ profile, email, reference, requirements = [], showContact, preparedOn }) => {
  const name = [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ");
  const place = [profile?.city, profile?.province].filter(Boolean).join(", ");
  const phone = profile?.mobileNumber ? (showContact ? profile.mobileNumber : maskPhone(profile.mobileNumber)) : "";
  const mail = email ? (showContact ? email : maskEmail(email)) : "";
  const summary = (profile?.professionalSummary ?? "").trim();
  const work = [...(profile?.workExperiences ?? [])].sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const education = [...(profile?.educations ?? [])].sort(
    (a: any, b: any) => new Date(b.endDate ?? b.startDate ?? 0).getTime() - new Date(a.endDate ?? a.startDate ?? 0).getTime(),
  );
  const skills: string[] = (profile?.skills ?? []).map(skillName).filter(Boolean);
  const approved = requirements.filter((r) => r.reviewStatus === "APPROVED").map((r) => r.documentLabel);
  const verified = profile?.verificationStatus === "VERIFIED";

  return (
    <article className="ats-resume bg-white text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header className="flex items-baseline justify-between border-b-2 border-black pb-1 text-xs">
        <span className="font-bold tracking-wide">MEGS</span>
        {reference && <span>Ref: {reference}</span>}
      </header>

      <h1 className="mt-3 text-2xl font-bold">{name || "Candidate"}</h1>
      <p className="mt-1 text-sm">{[place, phone, mail].filter(Boolean).join(" · ")}</p>

      {summary && (
        <Section title="Professional summary">
          <p className="text-sm leading-relaxed">{summary}</p>
        </Section>
      )}

      {work.length > 0 && (
        <Section title="Work history">
          {work.map((w: any, i: number) => (
            <div key={w.id ?? i} className="ats-entry text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-bold">{w.roleTitle}</span>
                <span className="shrink-0">{range(w.startDate, w.endDate, w.isCurrent)}</span>
              </div>
              <div>{[w.company, w.location].filter(Boolean).join(", ")}</div>
              {w.summary?.trim() && <p className="mt-0.5 whitespace-pre-line">{w.summary.trim()}</p>}
            </div>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((e: any, i: number) => (
            <div key={e.id ?? i} className="ats-entry text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-bold">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || e.school}</span>
                <span className="shrink-0">{range(e.startDate, e.endDate)}</span>
              </div>
              {(e.degree || e.fieldOfStudy) && <div>{e.school}</div>}
            </div>
          ))}
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          <p className="text-sm">{skills.join(", ")}</p>
        </Section>
      )}

      {approved.length > 0 && (
        <p className="mt-5 text-sm">
          <span className="font-bold">Requirements: </span>
          {approved.join(", ")}
        </p>
      )}

      <footer className="mt-8 border-t border-black pt-1 text-xs">
        <p>Prepared by MEGS Talent Acquisition · {formatDate(preparedOn ?? new Date().toISOString())}</p>
        <p>{verified ? verificationText(profile) : "Not verified"}</p>
      </footer>
    </article>
  );
};

export interface StandardAtsResumePreviewProps extends Omit<StandardAtsResumeProps, "showContact"> {
  onClose: () => void;
}

/** Full-screen preview. Print hides everything else on the page (see .print-resume-root in index.css). */
export const StandardAtsResumePreview: React.FC<StandardAtsResumePreviewProps> = ({ onClose, ...resume }) => {
  const [showContact, setShowContact] = useState(false);
  const checkId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Print resume" className="print-resume-root fixed inset-0 z-[100] overflow-y-auto bg-slate-100">
      {/* The walk-in slip sets an 80 mm page; this overrides it while the resume is open. */}
      <style>{"@media print { @page { size: A4; margin: 12.7mm; } }"}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3">
        <label htmlFor={checkId} className="flex min-h-11 items-center gap-2 text-sm text-slate-900 md:min-h-6">
          <input id={checkId} type="checkbox" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} className="h-4 w-4" />
          Show contact details
        </label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>
      <div className="print-resume-sheet mx-auto my-4 max-w-[210mm] bg-white p-[12.7mm] shadow-sm">
        <StandardAtsResume {...resume} showContact={showContact} />
      </div>
    </div>,
    document.body,
  );
};
