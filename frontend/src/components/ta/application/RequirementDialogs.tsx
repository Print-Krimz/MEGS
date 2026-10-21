import React, { useEffect, useState } from "react";
import { Button, ComboBox, Dialog } from "../../ui";
import { DateField } from "../../common/DateField";
import { COMPLIANCE_201_PRESETS } from "../../../lib/hr-constants";
import { addManilaCalendarDays, getManilaToday } from "../../../lib/field-limits";
import { formatDate } from "../../../lib/utils";

const QUICK_PICKS = [
  "Driver's License (Professional)",
  "PRC Board License",
  "5-Panel Drug Test Certificate",
  "Academic Transcript (TOR)",
  "Certificate of Employment (COE)",
  "Trade Skill Certification",
];

const same = (a: string, b: string) => a.toLowerCase().trim() === b.toLowerCase().trim();

export interface AddRequirementDialogProps {
  open: boolean;
  onClose: () => void;
  /** Labels already on the checklist, so duplicates are blocked. */
  existingLabels: string[];
  onSubmit: (values: { documentLabel: string; deadline?: string; isRequired: true }) => void;
  isSubmitting?: boolean;
}

export const AddRequirementDialog: React.FC<AddRequirementDialogProps> = ({
  open,
  onClose,
  existingLabels,
  onSubmit,
  isSubmitting = false,
}) => {
  const [label, setLabel] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setDeadline(addManilaCalendarDays(getManilaToday(), 7));
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDuplicate = existingLabels.some((l) => same(l, label.trim()));
  const hasBundleDelimiters = label.includes(",") || label.includes(";");

  return (
    <Dialog open={open} onClose={onClose} title="Add requirement" description="Add a document needed for this specific role or client." overflowVisible>
      <div className="space-y-4">
        <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="block text-xs font-medium text-slate-700">Standard requirements</span>
          <p className="text-slate-600">
            Government IDs, NBI clearance, medical exam, SSS, PhilHealth, Pag-IBIG, and contract documents are added automatically. Use this form for extra requirements only.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-700">Common requirements</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PICKS.map((preset) => {
              const added = existingLabels.some((l) => same(l, preset));
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={added}
                  onClick={() => setLabel(preset)}
                  className={`focus-ring min-h-11 rounded border px-2.5 py-1 text-xs transition-colors md:min-h-8 ${
                    added
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 line-through"
                      : label === preset
                      ? "border-navy bg-navy text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {preset} {added && "(Already added)"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <ComboBox
            label="Requirement name"
            placeholder="Search or type a requirement..."
            value={label}
            onChange={(val) => setLabel(val || "")}
            options={COMPLIANCE_201_PRESETS.map((p) => ({
              value: p.label,
              label: p.label,
              subtitle: p.description,
              badge: p.category,
              disabled: existingLabels.some((l) => same(l, p.label)),
            }))}
            allowCustom
            required
          />
          {isDuplicate ? (
            <p className="mt-1 text-xs text-rose-700">This requirement is already on the candidate’s list.</p>
          ) : hasBundleDelimiters ? (
            <p className="mt-1 text-xs text-amber-800">Enter one requirement at a time.</p>
          ) : null}
        </div>

        <DateField
          label="Submission deadline (optional)"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={getManilaToday()}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!label.trim() || isDuplicate || hasBundleDelimiters}
            loading={isSubmitting}
            onClick={() => onSubmit({ documentLabel: label.trim(), deadline: deadline || undefined, isRequired: true })}
          >
            Add requirement
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export interface EditDeadlineDialogProps {
  open: boolean;
  onClose: () => void;
  requirement: { id: number; documentLabel: string; deadline?: string | null } | null;
  initialDate: string;
  onSubmit: (values: { id: number; deadline: string | null }) => void;
  isSubmitting?: boolean;
}

export const EditDeadlineDialog: React.FC<EditDeadlineDialogProps> = ({
  open,
  onClose,
  requirement,
  initialDate,
  onSubmit,
  isSubmitting = false,
}) => {
  const [date, setDate] = useState(initialDate);

  useEffect(() => {
    if (open) setDate(initialDate);
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change requirement deadline"
      description="Set or extend the date the candidate should submit this requirement."
    >
      <div className="space-y-4">
        <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="block font-medium text-slate-600">Selected requirement</span>
          <span className="block font-semibold text-slate-900">{requirement?.documentLabel}</span>
          {requirement?.deadline && (
            <span className="block text-xs text-slate-600">Current deadline: {formatDate(requirement.deadline)}</span>
          )}
        </div>

        <DateField
          label="Submission deadline"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={date && date < getManilaToday() ? date : getManilaToday()}
          required
        />

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-600">Quick extensions</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "+3 days", days: 3 },
              { label: "+7 days", days: 7 },
              { label: "+14 days", days: 14 },
              { label: "+30 days", days: 30 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + opt.days);
                  setDate(d.toISOString().split("T")[0]);
                }}
                className="focus-ring min-h-11 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-50 md:min-h-8"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!date || !requirement}
            loading={isSubmitting}
            onClick={() => {
              if (requirement) onSubmit({ id: requirement.id, deadline: date || null });
            }}
          >
            Save deadline
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
