import React, { useEffect, useState } from "react";
import { Button, Dialog } from "../ui";
import { formatDate } from "../../lib/utils";
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
  /** Talent Acquisition review: wording refers to the resume (not "your"), and verified values may be replaced. */
  staff?: boolean;
}

// The staff (Talent Acquisition) review keeps its original look: every visual choice below has a staff branch.
// Applicant: 20 px boxes in 44 px label rows, darker secondary text, dates like "Apr 12, 1995".
const checkboxClass = (staff: boolean) =>
  staff ? "mt-0.5 rounded text-[#0B315D] focus:ring-[#0B315D]" : "size-5 shrink-0 rounded text-[#0B315D] focus:ring-[#0B315D]";
const mutedText = (staff: boolean) => (staff ? "text-[#627D98]" : "text-[#486581]");

const range = (staff: boolean, start?: string, end?: string, isCurrent?: boolean) => {
  const from = staff ? start?.substring(0, 10) : start ? formatDate(start) : undefined;
  const to = isCurrent ? "Present" : staff ? end?.substring(0, 10) : end ? formatDate(end) : undefined;
  if (!from && !to) return "";
  return [from, to].filter(Boolean).join(" to ");
};

const resumeValue = (staff: boolean, field: string, value: string | number | null | undefined) =>
  !staff && field === "dateOfBirth" && typeof value === "string" && value ? formatDate(value) : formatResumeValue(value);

const joinParts = (...parts: Array<string | undefined | null | false>) =>
  parts.filter(Boolean).join(" · ");

interface ItemRowProps {
  staff: boolean;
  id: string;
  title: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ staff, id, title, detail, checked, onChange }) =>
  staff ? (
    <li className="flex items-start gap-3 py-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={checkboxClass(true)}
      />
      <label htmlFor={id} className="min-w-0 text-sm text-[#102A43]">
        <span className="font-medium">{title}</span>
        {detail ? <span className={`block text-xs ${mutedText(true)}`}>{detail}</span> : null}
      </label>
    </li>
  ) : (
    <li>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={checkboxClass(false)}
        />
        <span className="min-w-0 text-sm text-[#102A43]">
          <span className="font-medium">{title}</span>
          {detail ? <span className={`block text-xs ${mutedText(false)}`}>{detail}</span> : null}
        </span>
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
  staff = false,
}) => {
  const source = staff ? "From the resume" : "From your resume";
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

  const accept = buildAccept(proposal, selection, { allowLocked: staff });
  const update = (patch: Partial<ResumeSelection>) => setSelection({ ...selection, ...patch });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      // Applicant phones: the header wraps to several lines, so leave more room and keep Save on screen.
      // `!` because `cn` does not merge Tailwind classes and the Dialog body sets its own max-h.
      bodyClassName={staff ? undefined : "max-h-[calc(100dvh-13rem)]! sm:max-h-[calc(100dvh-8rem)]!"}
      title={staff ? "Review details from the resume" : "Review details from your resume"}
      description={
        staff
          ? "Nothing is saved until you choose Save selected. Saved details are kept unless you pick the resume value."
          : "Nothing is saved until you choose Save selected. Details already on your profile are kept unless you pick the resume value."
      }
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
                      staff={staff}
                      key={row.field}
                      id={id}
                      title={label}
                      detail={`${source}: ${resumeValue(staff, row.field, row.proposed)}`}
                      checked={selection.personal.has(row.field)}
                      onChange={(on) => update({ personal: toggle(selection.personal, row.field, on) })}
                    />
                  );
                }
                return (
                  <li key={row.field} className="py-2">
                    <p className="text-sm font-medium text-[#102A43]">{label}</p>
                    <p className={`text-xs ${mutedText(staff)}`}>Saved: {resumeValue(staff, row.field, row.current)}</p>
                    <p className={`text-xs ${mutedText(staff)}`}>{source}: {resumeValue(staff, row.field, row.proposed)}</p>
                    {row.locked && !staff ? (
                      <p className={`mt-1 text-xs ${mutedText(staff)}`}>Verified by MEGS staff. This value can't be changed here.</p>
                    ) : (
                      staff ? (
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
                      ) : (
                        <label htmlFor={id} className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#102A43]">
                          <input
                            id={id}
                            type="checkbox"
                            checked={selection.overwrite.has(row.field)}
                            onChange={(e) => update({ overwrite: toggle(selection.overwrite, row.field, e.target.checked) })}
                            className={checkboxClass(false)}
                          />
                          Use the resume value for {label}
                        </label>
                      )
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
                      <p className={`text-xs ${mutedText(staff)}`}>Not added: no start date found. Add it manually.</p>
                    </li>
                  );
                }
                return (
                  <ItemRow
                      staff={staff}
                    key={row.index}
                    id={`resume-work-${row.index}`}
                    title={title}
                    detail={joinParts(range(staff, row.item.startDate, row.item.endDate, row.item.isCurrent), row.item.location)}
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
                      staff={staff}
                  key={row.index}
                  id={`resume-education-${row.index}`}
                  title={joinParts(row.item.degree, row.item.school)}
                  detail={joinParts(row.item.fieldOfStudy, range(staff, row.item.startDate, row.item.endDate))}
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
              {skills.map((row, index) => (
                <ItemRow
                      staff={staff}
                  key={row.name}
                  id={staff ? `resume-skill-${row.name}` : `resume-skill-${index}`}
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
                      staff={staff}
                  key={row.index}
                  id={`resume-training-${row.index}`}
                  title={row.item.title}
                  detail={joinParts(row.item.provider, staff ? row.item.completionDate?.substring(0, 10) : row.item.completionDate ? formatDate(row.item.completionDate) : undefined)}
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
                      staff={staff}
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

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#D9E2EC] bg-white pt-3">
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
