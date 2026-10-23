import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Input, Textarea } from "../../ui";
import { getManilaToday } from "../../../lib/field-limits";
import type { ReviewEducation, ReviewWorkExperience } from "../../../lib/api/ta-profile-review.api";

/** A row being edited. `key` is only for React; `id` is set for rows that already exist. */
export type WorkDraft = {
  key: string;
  id?: number;
  company: string;
  roleTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
};

export type EducationDraft = {
  key: string;
  id?: number;
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  notes: string;
};

export type DraftErrors = Record<string, string>;

let counter = 0;
export const newKey = () => `row-${(counter += 1)}`;

const day = (value?: string | null) => (value ? String(value).slice(0, 10) : "");

export const toWorkDrafts = (rows: any[] = []): WorkDraft[] =>
  rows.map((r) => ({
    key: newKey(),
    id: r.id,
    company: r.company ?? "",
    roleTitle: r.roleTitle ?? "",
    location: r.location ?? "",
    startDate: day(r.startDate),
    endDate: day(r.endDate),
    isCurrent: Boolean(r.isCurrent),
    summary: r.summary ?? "",
  }));

export const toEducationDrafts = (rows: any[] = []): EducationDraft[] =>
  rows.map((r) => ({
    key: newKey(),
    id: r.id,
    school: r.school ?? "",
    degree: r.degree ?? "",
    fieldOfStudy: r.fieldOfStudy ?? "",
    startDate: day(r.startDate),
    endDate: day(r.endDate),
    notes: r.notes ?? "",
  }));

export const emptyWork = (): WorkDraft => ({ key: newKey(), company: "", roleTitle: "", location: "", startDate: "", endDate: "", isCurrent: false, summary: "" });
export const emptyEducation = (): EducationDraft => ({ key: newKey(), school: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", notes: "" });

export const skillNames = (skills: Array<{ name?: string } | string> = []): string[] =>
  skills.map((s) => (typeof s === "string" ? s : s?.name ?? "")).filter(Boolean);

export const workPayload = (rows: WorkDraft[]): ReviewWorkExperience[] =>
  rows.map((r) => ({
    ...(r.id !== undefined ? { id: r.id } : {}),
    company: r.company.trim(),
    roleTitle: r.roleTitle.trim(),
    location: r.location.trim() || null,
    startDate: r.startDate,
    endDate: r.isCurrent ? null : r.endDate || null,
    isCurrent: r.isCurrent,
    summary: r.summary.trim() || null,
  }));

export const educationPayload = (rows: EducationDraft[]): ReviewEducation[] =>
  rows.map((r) => ({
    ...(r.id !== undefined ? { id: r.id } : {}),
    school: r.school.trim(),
    degree: r.degree.trim() || null,
    fieldOfStudy: r.fieldOfStudy.trim() || null,
    startDate: r.startDate || null,
    endDate: r.endDate || null,
    notes: r.notes.trim() || null,
  }));

/** Problems keyed `<row key>:<field>`; empty when the lists can be saved. */
export const validateDrafts = (work: WorkDraft[], education: EducationDraft[]): DraftErrors => {
  const errors: DraftErrors = {};
  const today = getManilaToday();
  for (const r of work) {
    if (!r.company.trim()) errors[`${r.key}:company`] = "Enter the company.";
    if (!r.roleTitle.trim()) errors[`${r.key}:roleTitle`] = "Enter the job title.";
    if (!r.startDate) errors[`${r.key}:startDate`] = "Enter the start date.";
    else if (r.startDate > today) errors[`${r.key}:startDate`] = "Start date cannot be in the future.";
    if (!r.isCurrent && r.endDate) {
      if (r.endDate > today) errors[`${r.key}:endDate`] = "End date cannot be in the future.";
      else if (r.startDate && r.endDate < r.startDate) errors[`${r.key}:endDate`] = "End date must be after the start date.";
    }
  }
  for (const r of education) {
    if (!r.school.trim()) errors[`${r.key}:school`] = "Enter the school.";
    if (r.startDate && r.startDate > today) errors[`${r.key}:startDate`] = "Start date cannot be in the future.";
    if (r.endDate && r.endDate > today) errors[`${r.key}:endDate`] = "End date cannot be in the future.";
    else if (r.startDate && r.endDate && r.endDate < r.startDate) errors[`${r.key}:endDate`] = "End date must be after the start date.";
  }
  return errors;
};

const EditorSection: React.FC<{ title: string; id: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, id, action, children }) => (
  <section aria-labelledby={id} className="space-y-3 border-t border-slate-200 pt-4">
    <div className="flex items-center justify-between gap-3">
      <h3 id={id} className="text-sm font-semibold text-slate-900">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const RowShell: React.FC<{ label: string; onRemove: () => void; children: React.ReactNode }> = ({ label, onRemove, children }) => (
  <li className="space-y-2 rounded-md border border-slate-300 p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()}`}>
        Remove
      </Button>
    </div>
    {children}
  </li>
);

export const SummaryEditor: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <EditorSection title="Professional summary" id="bio-summary">
    <Textarea label="Summary" rows={4} value={value} maxLength={5000} onChange={(e) => onChange(e.target.value)} />
  </EditorSection>
);

export const WorkExperienceEditor: React.FC<{
  rows: WorkDraft[];
  errors: DraftErrors;
  onChange: (rows: WorkDraft[]) => void;
}> = ({ rows, errors, onChange }) => {
  const patch = (key: string, change: Partial<WorkDraft>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  return (
    <EditorSection
      title="Work experience"
      id="bio-work"
      action={
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...rows, emptyWork()])}>
          Add job
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No jobs listed.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <RowShell key={r.key} label={`Job ${i + 1}`} onRemove={() => onChange(rows.filter((x) => x.key !== r.key))}>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Company" required maxLength={200} value={r.company} error={errors[`${r.key}:company`]} onChange={(e) => patch(r.key, { company: e.target.value })} />
                <Input label="Job title" required maxLength={200} value={r.roleTitle} error={errors[`${r.key}:roleTitle`]} onChange={(e) => patch(r.key, { roleTitle: e.target.value })} />
              </div>
              <Input label="Location" maxLength={200} value={r.location} onChange={(e) => patch(r.key, { location: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Start date" type="date" required min="1900-01-01" max={getManilaToday()} value={r.startDate} error={errors[`${r.key}:startDate`]} onChange={(e) => patch(r.key, { startDate: e.target.value })} />
                <Input label="End date" type="date" min="1900-01-01" max={getManilaToday()} value={r.isCurrent ? "" : r.endDate} disabled={r.isCurrent} error={errors[`${r.key}:endDate`]} onChange={(e) => patch(r.key, { endDate: e.target.value })} />
              </div>
              <label className="flex min-h-9 items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={r.isCurrent} onChange={(e) => patch(r.key, { isCurrent: e.target.checked, endDate: e.target.checked ? "" : r.endDate })} className="rounded text-navy" />
                I currently work here
              </label>
              <Textarea label="Description" rows={2} maxLength={2000} value={r.summary} onChange={(e) => patch(r.key, { summary: e.target.value })} />
            </RowShell>
          ))}
        </ul>
      )}
    </EditorSection>
  );
};

export const EducationEditor: React.FC<{
  rows: EducationDraft[];
  errors: DraftErrors;
  onChange: (rows: EducationDraft[]) => void;
}> = ({ rows, errors, onChange }) => {
  const patch = (key: string, change: Partial<EducationDraft>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  return (
    <EditorSection
      title="Education"
      id="bio-education"
      action={
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...rows, emptyEducation()])}>
          Add school
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No education listed.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <RowShell key={r.key} label={`School ${i + 1}`} onRemove={() => onChange(rows.filter((x) => x.key !== r.key))}>
              <Input label="School" required maxLength={200} value={r.school} error={errors[`${r.key}:school`]} onChange={(e) => patch(r.key, { school: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Degree" maxLength={200} value={r.degree} onChange={(e) => patch(r.key, { degree: e.target.value })} />
                <Input label="Field of study" maxLength={200} value={r.fieldOfStudy} onChange={(e) => patch(r.key, { fieldOfStudy: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Start date" type="date" min="1900-01-01" max={getManilaToday()} value={r.startDate} error={errors[`${r.key}:startDate`]} onChange={(e) => patch(r.key, { startDate: e.target.value })} />
                <Input label="End date" type="date" min="1900-01-01" max={getManilaToday()} value={r.endDate} error={errors[`${r.key}:endDate`]} onChange={(e) => patch(r.key, { endDate: e.target.value })} />
              </div>
            </RowShell>
          ))}
        </ul>
      )}
    </EditorSection>
  );
};

export const SkillsEditor: React.FC<{ skills: string[]; onChange: (skills: string[]) => void }> = ({ skills, onChange }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (!skills.some((s) => s.toLowerCase() === name.toLowerCase()) && skills.length < 50) onChange([...skills, name]);
    setDraft("");
  };
  return (
    <EditorSection title="Skills" id="bio-skills">
      {skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => onChange(skills.filter((s) => s !== name))}
                aria-label={`Remove skill ${name}`}
                className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-sm text-slate-900 hover:bg-slate-100"
              >
                {name}
                <X className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Add a skill"
            maxLength={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </EditorSection>
  );
};
