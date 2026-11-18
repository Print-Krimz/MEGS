import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  DateTimePicker,
  Dialog,
  Input,
  Select,
  dateTimeLocalToManilaIso,
  isWorkingHoursIso,
} from "../ui";
import { COMPANY_ADDRESS, OFFICE_HOURS_MESSAGE, OFFICE_HOURS_SHORT } from "../../lib/business-hours";
import { FIELD_LIMITS } from "../../lib/field-limits";
import { getRememberedInterviewLocation, rememberInterviewLocation } from "../../lib/schedule-location";
import { formatDateTime } from "../../lib/utils";

export type BulkScheduleInterviewType = "INITIAL_SCREENING" | "FINAL_INTERVIEW" | "CONTRACT_SIGNING";
export type SlotSpacing = "0" | "15" | "30" | "60";

export interface BulkScheduleApplicationItem {
  id: number;
  candidateName: string;
}

export interface BulkScheduleInterviewDialogProps {
  open: boolean;
  onClose: () => void;
  applications: BulkScheduleApplicationItem[];
  defaultType?: BulkScheduleInterviewType;
  loading?: boolean;
  onSubmit: (values: {
    items: { applicationId: number; scheduledAt: string }[];
    type: BulkScheduleInterviewType;
    location?: string;
  }) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Compute Manila wall-time slots (`YYYY-MM-DDTHH:mm`), optionally skipping weekday 12:00–1:00 PM lunch. */
export function computeBulkInterviewSlots(
  startLocal: string,
  count: number,
  stepMinutes: number,
  skipLunch = true
): string[] {
  const match = startLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match || count <= 0) return [];
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  let totalMinutes = Number(match[4]) * 60 + Number(match[5]);

  const formatCurrent = () => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${year}-${pad2(month)}-${pad2(day)}T${pad2(h)}:${pad2(m)}`;
  };

  const slots: string[] = [formatCurrent()];
  for (let i = 1; i < count; i++) {
    if (stepMinutes > 0) {
      totalMinutes += stepMinutes;
      if (totalMinutes >= 1440) {
        const nextDay = new Date(Date.UTC(year, month - 1, day + Math.floor(totalMinutes / 1440)));
        year = nextDay.getUTCFullYear();
        month = nextDay.getUTCMonth() + 1;
        day = nextDay.getUTCDate();
        totalMinutes %= 1440;
      }
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (skipLunch && weekday >= 1 && weekday <= 5 && totalMinutes >= 12 * 60 && totalMinutes < 13 * 60) {
        totalMinutes = 13 * 60;
      }
    }
    slots.push(formatCurrent());
  }
  return slots;
}

export const BulkScheduleInterviewDialog: React.FC<BulkScheduleInterviewDialogProps> = ({
  open,
  onClose,
  applications,
  defaultType = "INITIAL_SCREENING",
  loading = false,
  onSubmit,
}) => {
  const [type, setType] = useState<BulkScheduleInterviewType>(defaultType);
  const [startLocal, setStartLocal] = useState("");
  const [spacing, setSpacing] = useState<SlotSpacing>("15");
  const [skipLunch, setSkipLunch] = useState(true);
  const [location, setLocation] = useState("");
  const [rememberedLocation, setRememberedLocation] = useState("");

  useEffect(() => {
    if (!open) return;
    const saved = getRememberedInterviewLocation();
    setType(defaultType);
    setStartLocal("");
    setSpacing("15");
    setSkipLunch(true);
    setRememberedLocation(saved);
    setLocation(defaultType === "CONTRACT_SIGNING" ? COMPANY_ADDRESS : saved);
  }, [open, defaultType]);

  const stepMinutes = Number(spacing);

  const scheduledSlots = useMemo(() => {
    if (!startLocal || applications.length === 0) return [];
    const localSlots = computeBulkInterviewSlots(startLocal, applications.length, stepMinutes, skipLunch);
    return applications.map((app, idx) => {
      const local = localSlots[idx] ?? "";
      const iso = local ? dateTimeLocalToManilaIso(local) : "";
      const inFuture = Boolean(iso) && Date.parse(iso) > Date.now();
      const inHours = Boolean(local) && isWorkingHoursIso(local);
      return {
        applicationId: app.id,
        candidateName: app.candidateName,
        local,
        iso,
        valid: inFuture && inHours,
        inFuture,
        inHours,
      };
    });
  }, [applications, startLocal, stepMinutes, skipLunch]);

  const blockReason = useMemo(() => {
    if (applications.length === 0) return "Select at least one application.";
    if (!startLocal) return "Choose a start date and time.";
    if (scheduledSlots.some((s) => !s.iso || !s.inFuture)) {
      return type === "CONTRACT_SIGNING"
        ? "All contract signing times must be in the future."
        : "All interview times must be in the future.";
    }
    if (scheduledSlots.some((s) => !s.inHours)) return OFFICE_HOURS_MESSAGE;
    return null;
  }, [applications.length, startLocal, scheduledSlots, type]);

  const locationChips = useMemo(() => {
    const chips: { label: string; value: string }[] = [
      { label: "MEGS Main Office", value: COMPANY_ADDRESS },
    ];
    if (rememberedLocation && rememberedLocation !== COMPANY_ADDRESS) {
      chips.push({ label: "Last used", value: rememberedLocation });
    }
    return chips;
  }, [rememberedLocation]);

  const handleSubmit = () => {
    if (blockReason) return;
    const trimmedLocation = location.trim();
    if (trimmedLocation) rememberInterviewLocation(trimmedLocation);
    onSubmit({
      items: scheduledSlots.map((s) => ({ applicationId: s.applicationId, scheduledAt: s.iso })),
      type,
      location: trimmedLocation || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={type === "CONTRACT_SIGNING" ? "Schedule contract signing" : "Schedule interviews"}
      description={`Book ${applications.length === 1 ? "1 candidate" : `${applications.length} candidates`} at once.`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Interview round"
            value={type}
            onChange={(e) => setType(e.target.value as BulkScheduleInterviewType)}
            options={[
              { value: "INITIAL_SCREENING", label: "Initial screening" },
              { value: "FINAL_INTERVIEW", label: "Final interview" },
              { value: "CONTRACT_SIGNING", label: "Contract signing" },
            ]}
          />
          <Select
            label="Slot timing"
            value={spacing}
            onChange={(e) => setSpacing(e.target.value as SlotSpacing)}
            options={[
              { value: "0", label: "Same time for all" },
              { value: "15", label: "Stagger every 15 minutes" },
              { value: "30", label: "Stagger every 30 minutes" },
              { value: "60", label: "Stagger every 60 minutes" },
            ]}
          />
        </div>

        <DateTimePicker
          label="Start date and time"
          value={startLocal}
          onChange={setStartLocal}
          minDate={new Date()}
          required
          workingHoursOnly
          helperText={OFFICE_HOURS_SHORT}
        />

        {stepMinutes > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 md:min-h-8">
            <input
              type="checkbox"
              checked={skipLunch}
              onChange={(e) => setSkipLunch(e.target.checked)}
              className="focus-ring h-4 w-4 rounded border-slate-300 text-navy"
            />
            <span>Skip weekday lunch break (12:00 PM–1:00 PM)</span>
          </label>
        )}

        <div className="space-y-2">
          <Input
            label="Location or meeting link"
            placeholder="e.g. Google Meet link or office address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={FIELD_LIMITS.address}
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick locations">
            {locationChips.map((chip) => {
              const active = location.trim() === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLocation(chip.value)}
                  className={`focus-ring min-h-11 rounded border px-2.5 py-1 text-xs font-medium transition-colors md:min-h-8 ${
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {scheduledSlots.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">Schedule preview</span>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 text-sm">
              {scheduledSlots.map((slot) => (
                <li key={slot.applicationId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate font-medium text-slate-900">{slot.candidateName}</span>
                  <span
                    className={`shrink-0 tabular-nums text-xs ${
                      slot.valid ? "text-slate-700" : "font-medium text-rose-700"
                    }`}
                  >
                    {slot.iso ? formatDateTime(slot.iso) : slot.local}
                    {!slot.valid && " (outside hours)"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {blockReason && (
            <p className="mr-auto text-sm text-slate-600" role="status">
              {blockReason}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={loading} disabled={Boolean(blockReason)} onClick={handleSubmit}>
            {`Schedule ${applications.length}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
