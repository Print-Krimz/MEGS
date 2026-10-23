import React, { useEffect, useState } from "react";
import { Button, Dialog } from "../ui";
import type { ResumeAccept, ResumeProposal } from "../../lib/types/applicant.types";
import {
  actionablePersonal,
  buildAccept,
  formatResumeValue,
  initialSelection,
  resumeFieldLabel,
  selectionIsEmpty,
  type ResumeSelection,
} from "../../lib/resume-autofill";

export interface ResumeReviewDialogProps {
  open: boolean;
  proposal: ResumeProposal | null;
  saving?: boolean;
  error?: string | null;
  onSave: (accept: ResumeAccept) => void;
  onClose: () => void;
}

const checkboxClass = "mt-0.5 rounded text-[#0B315D] focus:ring-[#0B315D]";

const range = (start?: string, end?: string, isCurrent?: boolean) => {
  const from = start?.substring(0, 10);
  const to = isCurrent ? "Present" : end?.substring(0, 10);
  if (!from && !to) return "";
  return [from, to].filter(Boolean).join(" to ");
};

const joinParts = (...parts: Array<string | undefined | null | false>) =>
  parts.filter(Boolean).join(" · ");

interface ItemRowProps {
  id: string;
  title: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ id, title, detail, checked, onChange }) => (
  <li className="flex items-start gap-3 py-2">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={checkboxClass}
    />
    <label htmlFor={id} className="min-w-0 text-sm text-[#102A43]">
      <span className="font-medium">{title}</span>
      {detail ? <span className="block text-xs text-[#627D98]">{detail}</span> : null}
    </label>
  </li>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-t border-[#D9E2EC] pt-3 first:border-t-0 first:pt-0">
    <h3 className="text-sm font-semibold text-[#102A43]">{title}</h3>
    {children}
  </section>
);

function toggle<T>(set: Set<T>, value: T, on: boolean): Set<T> {
  const next = new Set(set);
  if (on) next.add(value);
  else next.delete(value);
  return next;
}

export const ResumeReviewDialog: React.FC<ResumeReviewDialogProps> = ({
  open,
  proposal,
  saving = false,
  error,
  onSave,
  onClose,
}) => {
  const [selection, setSelection] = useState<ResumeSelection | null>(null);

  useEffect(() => {
    setSelection(proposal && open ? initialSelection(proposal) : null);
  }, [proposal, open]);

  if (!proposal || !selection) {
    return <Dialog open={false} onClose={onClose}>{null}</Dialog>;
  }

  const personal = actionablePersonal(proposal);
  const work = proposal.workExperiences.filter((r) => r.status === "new" || r.status === "needs_date");
  const educations = proposal.educations.filter((r) => r.status === "new");
  const skills = proposal.skills.filter((r) => r.status === "new");
  const trainings = proposal.trainings.filter((r) => r.status === "new");
  const references = proposal.references.filter((r) => r.status === "new");

  const accept = buildAccept(proposal, selection);
  const update = (patch: Partial<ResumeSelection>) => setSelection({ ...selection, ...patch });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Review details from your resume"
      description="Nothing is saved until you choose Save selected. Details already on your profile are kept unless you pick the resume value."
    >
      <div className="space-y-4">
        {personal.length > 0 && (
          <Section title="Personal details">
            <ul className="divide-y divide-[#D9E2EC]">
              {personal.map((row) => {
                const label = resumeFieldLabel(row.field);
                const id = `resume-personal-${row.field}`;
                if (row.status === "suggested") {
                  return (
                    <ItemRow
                      key={row.field}
                      id={id}
                      title={label}
                      detail={`From your resume: ${formatResumeValue(row.proposed)}`}
                      checked={selection.personal.has(row.field)}
                      onChange={(on) => update({ personal: toggle(selection.personal, row.field, on) })}
                    />
                  );
                }
                return (
                  <li key={row.field} className="py-2">
                    <p className="text-sm font-medium text-[#102A43]">{label}</p>
                    <p className="text-xs text-[#627D98]">Saved: {formatResumeValue(row.current)}</p>
                    <p className="text-xs text-[#627D98]">From your resume: {formatResumeValue(row.proposed)}</p>
                    {row.locked ? (
                      <p className="mt-1 text-xs text-[#627D98]">Verified by MEGS staff. This value can't be changed here.</p>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          id={id}
                          type="checkbox"
                          checked={selection.overwrite.has(row.field)}
                          onChange={(e) => update({ overwrite: toggle(selection.overwrite, row.field, e.target.checked) })}
                          className="rounded text-[#0B315D] focus:ring-[#0B315D]"
                        />
                        <label htmlFor={id} className="text-xs text-[#102A43]">
                          Use the resume value for {label}
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {work.length > 0 && (
          <Section title="Work experience">
            <ul className="divide-y divide-[#D9E2EC]">
              {work.map((row) => {
                const title = [row.item.roleTitle, row.item.company && `at ${row.item.company}`].filter(Boolean).join(" ");
                if (row.status === "needs_date") {
                  return (
                    <li key={row.index} className="py-2">
                      <p className="text-sm font-medium text-[#102A43]">{title}</p>
                      <p className="text-xs text-[#627D98]">Not added: no start date found. Add it manually.</p>
                    </li>
                  );
                }
                return (
                  <ItemRow
                    key={row.index}
                    id={`resume-work-${row.index}`}
                    title={title}
                    detail={joinParts(range(row.item.startDate, row.item.endDate, row.item.isCurrent), row.item.location)}
                    checked={selection.workExperiences.has(row.index)}
                    onChange={(on) => update({ workExperiences: toggle(selection.workExperiences, row.index, on) })}
                  />
                );
              })}
            </ul>
          </Section>
        )}

        {educations.length > 0 && (
          <Section title="Education">
            <ul className="divide-y divide-[#D9E2EC]">
              {educations.map((row) => (
                <ItemRow
                  key={row.index}
                  id={`resume-education-${row.index}`}
                  title={joinParts(row.item.degree, row.item.school)}
                  detail={joinParts(row.item.fieldOfStudy, range(row.item.startDate, row.item.endDate))}
                  checked={selection.educations.has(row.index)}
                  onChange={(on) => update({ educations: toggle(selection.educations, row.index, on) })}
                />
              ))}
            </ul>
          </Section>
        )}

        {skills.length > 0 && (
          <Section title="Skills">
            <ul className="divide-y divide-[#D9E2EC]">
              {skills.map((row) => (
                <ItemRow
                  key={row.name}
                  id={`resume-skill-${row.name}`}
                  title={row.name}
                  checked={selection.skills.has(row.name)}
                  onChange={(on) => update({ skills: toggle(selection.skills, row.name, on) })}
                />
              ))}
            </ul>
          </Section>
        )}

        {trainings.length > 0 && (
          <Section title="Trainings">
            <ul className="divide-y divide-[#D9E2EC]">
              {trainings.map((row) => (
                <ItemRow
                  key={row.index}
                  id={`resume-training-${row.index}`}
                  title={row.item.title}
                  detail={joinParts(row.item.provider, row.item.completionDate?.substring(0, 10))}
                  checked={selection.trainings.has(row.index)}
                  onChange={(on) => update({ trainings: toggle(selection.trainings, row.index, on) })}
                />
              ))}
            </ul>
          </Section>
        )}

        {references.length > 0 && (
          <Section title="References">
            <ul className="divide-y divide-[#D9E2EC]">
              {references.map((row) => (
                <ItemRow
                  key={row.index}
                  id={`resume-reference-${row.index}`}
                  title={row.item.name}
                  detail={joinParts(row.item.relationship, row.item.company, row.item.phone)}
                  checked={selection.references.has(row.index)}
                  onChange={(on) => update({ references: toggle(selection.references, row.index, on) })}
                />
              ))}
            </ul>
          </Section>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[#D9E2EC] pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => onSave(accept)}
            loading={saving}
            disabled={selectionIsEmpty(accept)}
          >
            Save selected
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
