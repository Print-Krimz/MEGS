import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatDate } from "../../../lib/utils";

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

const sortKey = (iso?: string | null): number => Date.parse(iso ?? "") || 0;

const skillName = (skill: unknown): string => (typeof skill === "string" ? skill : (skill as { name?: string })?.name ?? "").trim();

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-5">
    <h2 className="border-b border-black pb-0.5 text-sm font-bold uppercase tracking-wide">{title}</h2>
    <div className="mt-2 space-y-3">{children}</div>
  </section>
);

/** The stored profile as a plain, single-column resume. Only stored data is shown. */
function educationTitle(e: any): string {
  const degree = (e.degree ?? "").trim();
  const field = (e.fieldOfStudy ?? "").trim();
  const skipField = !field || field.toLowerCase() === "general" || degree.toLowerCase().includes(field.toLowerCase());
  return [degree, skipField ? "" : field].filter(Boolean).join(", ");
}

export const StandardAtsResume: React.FC<StandardAtsResumeProps> = ({ profile, email, reference, requirements = [], showContact, preparedOn }) => {
  const name = [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ");
  const place = [profile?.city, profile?.province].filter(Boolean).join(", ");
  const phone = profile?.mobileNumber ? (showContact ? profile.mobileNumber : maskPhone(profile.mobileNumber)) : "";
  const mail = email ? (showContact ? email : maskEmail(email)) : "";
  const summary = (profile?.professionalSummary ?? "").trim();
  const work = [...(profile?.workExperiences ?? [])].sort((a: any, b: any) => sortKey(b.startDate) - sortKey(a.startDate));
  const education = [...(profile?.educations ?? [])].sort((a: any, b: any) => sortKey(b.endDate ?? b.startDate) - sortKey(a.endDate ?? a.startDate));
  const trainings = [...(profile?.trainings ?? [])].sort((a: any, b: any) => sortKey(b.completionDate) - sortKey(a.completionDate));
  const skills: string[] = (profile?.skills ?? []).map(skillName).filter(Boolean);
  const approved = requirements.filter((r) => r.reviewStatus === "APPROVED").map((r) => r.documentLabel);

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
                <span className="font-bold">{educationTitle(e) || e.school}</span>
                <span className="shrink-0">{range(e.startDate, e.endDate)}</span>
              </div>
              {educationTitle(e) && <div>{e.school}</div>}
            </div>
          ))}
        </Section>
      )}

      {trainings.length > 0 && (
        <Section title="Trainings & certifications">
          {trainings.map((t: any, i: number) => (
            <div key={t.id ?? i} className="ats-entry text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-bold">{t.title}</span>
                <span className="shrink-0">{monthYear(t.completionDate)}</span>
              </div>
              {t.provider && <div>{t.provider}</div>}
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
      </footer>
    </article>
  );
};

export interface PrintableResumeProps extends Omit<StandardAtsResumeProps, "showContact"> {
  /** Whether the printed copy shows the full phone and email. */
  showContact: boolean;
  /** Called when the print dialog closes. */
  onDone: () => void;
}

/**
 * Prints the resume on A4. It mounts a copy that is hidden on screen, opens the print dialog and
 * unmounts when the dialog closes. Print hides everything else on the page (see .print-resume-root in index.css).
 * Mount it with a new `key` each time to print again.
 */
export const PrintableResume: React.FC<PrintableResumeProps> = ({ onDone, ...resume }) => {
  const printed = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const onAfterPrint = () => done.current();
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  useEffect(() => {
    // Strict Mode runs effects twice in development; the dialog must open once.
    if (printed.current) return;
    printed.current = true;
    window.print();
  }, []);

  return createPortal(
    <div className="print-resume-root hidden print:block">
      {/* The walk-in slip sets an 80 mm page; this overrides it while the resume prints. */}
      <style>{"@media print { @page { size: A4; margin: 12.7mm; } }"}</style>
      <div className="print-resume-sheet">
        <StandardAtsResume {...resume} />
      </div>
    </div>,
    document.body,
  );
};
