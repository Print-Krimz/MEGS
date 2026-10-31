import React, { useState, useEffect, useRef, useId, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { isValidDateOnly } from "../../lib/field-limits";
import { hoursForWeekday, OFFICE_HOURS_MESSAGE, type OpenHours } from "../../lib/business-hours";

export interface DateTimePickerProps {
  value: string; // ISO string or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: Date; // defaults to new Date()
  maxDate?: Date;
  className?: string;
  placeholder?: string;
  id?: string;
  workingHoursOnly?: boolean;
  /** Same format as value. Marks the schedule being replaced and opens the calendar on its month. */
  highlightDate?: string;
}

function formatMinutes(total: number): string {
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/** Hourly start times for a weekday (Manila wall date). Noon is skipped on weekdays for lunch. */
function slotsForWeekday(weekday: number): Array<{ hour: number; minute: number; label: string }> {
  const hours = hoursForWeekday(weekday);
  if (!hours) return [];
  const slots: Array<{ hour: number; minute: number; label: string }> = [];
  for (let m = hours.start; m <= hours.end; m += 60) {
    if (weekday !== 6 && m === 12 * 60) continue;
    slots.push({ hour: Math.floor(m / 60), minute: m % 60, label: formatMinutes(m) });
  }
  return slots;
}

/** 12-hour clock values offered for a period (AM/PM) within the open hours. */
function hours12ForPeriod(period: "AM" | "PM", hours: OpenHours): number[] {
  const result: number[] = [];
  for (let h = Math.floor(hours.start / 60); h <= Math.floor(hours.end / 60); h++) {
    if ((h >= 12 ? "PM" : "AM") !== period) continue;
    result.push(h % 12 === 0 ? 12 : h % 12);
  }
  return result;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/**
 * Safely parse ISO string or YYYY-MM-DDTHH:mm format into local Date
 */
function toManilaWallDate(instant: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return new Date(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
}

function manilaWallDateToEpoch(value: Date): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  return Date.parse(`${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}+08:00`);
}

export function dateTimeLocalToManilaIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || !isValidDateOnly(value.slice(0, 10))) return "";
  return new Date(`${value}:00+08:00`).toISOString();
}

export function manilaIsoToDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? formatToValueString(toManilaWallDate(instant)) : "";
}

export function isWithinWorkingHours(date: Date | null): boolean {
  if (!date || isNaN(date.getTime())) return false;
  const open = hoursForWeekday(date.getDay());
  if (!open) return false;
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  return totalMinutes >= open.start && totalMinutes <= open.end;
}

export function isWorkingHoursIso(isoOrLocal?: string | null): boolean {
  if (!isoOrLocal) return false;
  const parsed = parseDateTimeValue(isoOrLocal);
  return isWithinWorkingHours(parsed);
}

export function parseDateTimeValue(val?: string | null): Date | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Treat calendar values without an offset as Manila wall time, independent of browser timezone.
  const localMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    const year = parseInt(localMatch[1], 10);
    const month = parseInt(localMatch[2], 10) - 1;
    const day = parseInt(localMatch[3], 10);
    const hours = parseInt(localMatch[4], 10);
    const minutes = parseInt(localMatch[5], 10);
    const seconds = localMatch[6] ? parseInt(localMatch[6], 10) : 0;
    if (!isValidDateOnly(`${localMatch[1]}-${localMatch[2]}-${localMatch[3]}`) || hours > 23 || minutes > 59 || seconds > 59) return null;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback for standard ISO strings with timezone offsets / Z
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : toManilaWallDate(parsed);
}

/**
 * Format local Date to standard YYYY-MM-DDTHH:mm string
 */
function formatToValueString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format date for input display: "Sep 30, 2026, 10:00 AM"
 */
function formatDisplayDateTime(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Compare two dates by date only (ignoring time)
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Generate relative day descriptor (e.g. "Today", "Tomorrow", "In 2 days")
 */
function getRelativeDayHint(target: Date, base: Date): string | null {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const diffMs = targetDay.getTime() - baseDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === 2) return "In 2 days";
  if (diffDays > 2 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays > 7 && diffDays <= 14) return "Next week";
  if (diffDays < 0) return "Past date";
  return null;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  label,
  helperText,
  error,
  required,
  disabled,
  minDate,
  maxDate = new Date("2100-12-31T23:59:59.999+08:00"),
  className,
  placeholder = "Select date and time...",
  id: customId,
  workingHoursOnly = false,
  highlightDate,
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const popoverId = `${inputId}-popover`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const refreshClock = () => setClockNow(new Date());
    refreshClock();
    const interval = window.setInterval(refreshClock, 1_000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  // Bring the popover into view when it opens inside a scrolling dialog body.
  useEffect(() => {
    if (isOpen) popoverRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen]);

  // Normalize minDate start of day for strict past date disabling
  const now = useMemo(() => toManilaWallDate(clockNow), [clockNow]);
  const effectiveMinDate = useMemo(() => {
    const requestedMin = minDate ? toManilaWallDate(minDate) : now;
    return requestedMin.getTime() < now.getTime() ? now : requestedMin;
  }, [minDate, now]);
  const minDateMidnight = useMemo(
    () => new Date(effectiveMinDate.getFullYear(), effectiveMinDate.getMonth(), effectiveMinDate.getDate(), 0, 0, 0, 0),
    [effectiveMinDate]
  );
  const maxDateEnd = useMemo(
    () => {
      const wallDate = toManilaWallDate(maxDate);
      return new Date(wallDate.getFullYear(), wallDate.getMonth(), wallDate.getDate(), 23, 59, 59, 999);
    },
    [maxDate]
  );

  // Current selected parsed date
  const parsedValue = useMemo(() => parseDateTimeValue(value), [value]);
  const parsedHighlight = useMemo(() => (highlightDate ? parseDateTimeValue(highlightDate) : null), [highlightDate]);

  // Calendar month/year navigation state
  const [viewYear, setViewYear] = useState<number>(() => {
    return (parsedValue ?? parsedHighlight)?.getFullYear() ?? effectiveMinDate.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    return (parsedValue ?? parsedHighlight)?.getMonth() ?? effectiveMinDate.getMonth();
  });

  // Sync calendar view when value updates or popover opens
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.getFullYear());
      setViewMonth(parsedValue.getMonth());
    }
  }, [parsedValue]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Handle keyboard navigation (Escape to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Previous month navigation guard
  const isPrevMonthDisabled = useMemo(() => {
    const minYear = effectiveMinDate.getFullYear();
    const minMonth = effectiveMinDate.getMonth();
    return viewYear < minYear || (viewYear === minYear && viewMonth <= minMonth);
  }, [viewYear, viewMonth, effectiveMinDate]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPrevMonthDisabled) return;
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const isTodayPastWorkingHours = useMemo(() => {
    const open = hoursForWeekday(now.getDay());
    return workingHoursOnly && (!open || now.getHours() * 60 + now.getMinutes() >= open.end);
  }, [workingHoursOnly, now]);

  /** Sundays have no office hours, so they cannot be picked. */
  const isClosedDay = (date: Date) => workingHoursOnly && !hoursForWeekday(date.getDay());

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

    const days: Array<{
      dayNumber: number;
      date: Date;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
      isCurrent: boolean;
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);
      const isToday = isSameDay(date, now);
      const isDisabled =
        date.getTime() < minDateMidnight.getTime() ||
        date.getTime() > maxDateEnd.getTime() ||
        isClosedDay(date) ||
        (isToday && isTodayPastWorkingHours);
      const isSelected = parsedValue ? isSameDay(date, parsedValue) : false;
      const isCurrent = parsedHighlight ? isSameDay(date, parsedHighlight) : false;

      days.push({
        dayNumber: day,
        date,
        isDisabled,
        isToday,
        isSelected,
        isCurrent,
      });
    }

    return {
      firstDayIndex,
      days,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, minDateMidnight, maxDateEnd, now, parsedValue, parsedHighlight, isTodayPastWorkingHours, workingHoursOnly]);

  // Helper to apply or update date while preserving or defaulting time
  const handleSelectDate = (date: Date) => {
    let hours = 9;
    let minutes = 0;

    if (parsedValue) {
      hours = parsedValue.getHours();
      minutes = parsedValue.getMinutes();
    }

    if (workingHoursOnly) {
      const totalMinutes = hours * 60 + minutes;
      const open = hoursForWeekday(date.getDay());
      // A time that does not fit the new day (e.g. 2 PM moved to a Saturday) is reset to opening time.
      if (!open || totalMinutes < open.start || totalMinutes > open.end) {
        hours = 9;
        minutes = 0;
      }
    }

    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);

    // If the candidate selected time is in the past for today, pick the next available future business slot
    if (manilaWallDateToEpoch(candidate) <= Date.now()) {
      const nextSlot = slotsForWeekday(date.getDay()).find((s) => {
        const slotTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), s.hour, s.minute, 0, 0);
        return manilaWallDateToEpoch(slotTime) > Date.now();
      });

      if (nextSlot) {
        candidate.setHours(nextSlot.hour, nextSlot.minute, 0, 0);
      } else if (!workingHoursOnly) {
        // If today's business slots have all passed and not restricted to working hours, advance hour slightly beyond now if possible
        const nextHour = now.getHours() + 1;
        if (nextHour <= 23) {
          candidate.setHours(nextHour, 0, 0, 0);
        }
      }
    }

    onChange(formatToValueString(candidate));
  };

  // Quick shortcuts logic
  const shortcuts = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const inTwoDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

    const daysUntilNextMonday = ((1 - now.getDay() + 7) % 7) || 7;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMonday);

    return [
      {
        label: "Today",
        date: today,
        disabled:
          today.getTime() < minDateMidnight.getTime() ||
          today.getTime() > maxDateEnd.getTime() ||
          isClosedDay(today) ||
          isTodayPastWorkingHours,
      },
      {
        label: "Tomorrow",
        date: tomorrow,
        disabled: tomorrow.getTime() < minDateMidnight.getTime() || tomorrow.getTime() > maxDateEnd.getTime() || isClosedDay(tomorrow),
      },
      {
        label: "In 2 Days",
        date: inTwoDays,
        disabled: inTwoDays.getTime() < minDateMidnight.getTime() || inTwoDays.getTime() > maxDateEnd.getTime() || isClosedDay(inTwoDays),
      },
      {
        label: "Next Monday",
        date: nextMonday,
        disabled: nextMonday.getTime() < minDateMidnight.getTime() || nextMonday.getTime() > maxDateEnd.getTime(),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, minDateMidnight, maxDateEnd, isTodayPastWorkingHours, workingHoursOnly]);

  const handleShortcutClick = (date: Date) => {
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    handleSelectDate(date);
  };

  // Time slot selection
  const handleSelectTimeSlot = (hour: number, minute: number) => {
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
    if (manilaWallDateToEpoch(updated) <= Date.now()) return;
    if (workingHoursOnly && !isWithinWorkingHours(updated)) return;
    onChange(formatToValueString(updated));
  };

  // Custom time helpers
  const currentHour24 = parsedValue ? parsedValue.getHours() : 9;
  const currentMinute = parsedValue ? parsedValue.getMinutes() : 0;

  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24;
  const currentPeriod: "AM" | "PM" = currentHour24 >= 12 ? "PM" : "AM";

  const activeHours: OpenHours = hoursForWeekday((parsedValue ?? now).getDay()) ?? hoursForWeekday(1)!;

  const availableHours12 = useMemo(() => {
    if (!workingHoursOnly) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    const forPeriod = hours12ForPeriod(currentPeriod, activeHours);
    return forPeriod.length > 0 ? forPeriod : hours12ForPeriod(currentPeriod === "AM" ? "PM" : "AM", activeHours);
  }, [workingHoursOnly, currentPeriod, activeHours]);

  const availableMinutes = useMemo(() => {
    const all = [0, 15, 30, 45];
    if (!workingHoursOnly) return all;
    return all.filter((m) => currentHour24 * 60 + m <= activeHours.end);
  }, [workingHoursOnly, currentHour24, activeHours]);

  /** Minutes past the closing time are not allowed, so the closing hour only offers :00. */
  const clampMinute = (hour24: number, minute: number) =>
    workingHoursOnly && hour24 * 60 + minute > activeHours.end ? 0 : minute;

  const handleCustomHourChange = (newHour12: number) => {
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    let newHour24 = newHour12;
    if (currentPeriod === "AM") {
      newHour24 = newHour12 === 12 ? 0 : newHour12;
    } else {
      newHour24 = newHour12 === 12 ? 12 : newHour12 + 12;
    }
    const newMinute = clampMinute(newHour24, currentMinute);
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), newHour24, newMinute, 0, 0);
    onChange(formatToValueString(updated));
  };

  const handleCustomMinuteChange = (newMinute: number) => {
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    newMinute = clampMinute(currentHour24, newMinute);
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), currentHour24, newMinute, 0, 0);
    onChange(formatToValueString(updated));
  };

  const handleCustomPeriodToggle = (period: "AM" | "PM") => {
    if (period === currentPeriod) return;
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    let newHour12 = currentHour12;
    if (workingHoursOnly) {
      const allowed = hours12ForPeriod(period, activeHours);
      if (allowed.length === 0) return;
      if (!allowed.includes(currentHour12)) newHour12 = allowed[0];
    }
    let newHour24 = newHour12;
    if (period === "AM") {
      newHour24 = newHour12 === 12 ? 0 : newHour12;
    } else {
      newHour24 = newHour12 === 12 ? 12 : newHour12 + 12;
    }
    const newMinute = clampMinute(newHour24, currentMinute);
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), newHour24, newMinute, 0, 0);
    onChange(formatToValueString(updated));
  };

  // Check if current selection is invalid (in the past or outside working hours)
  const isCurrentSelectionInPast = useMemo(() => {
    if (!parsedValue) return false;
    return (
      manilaWallDateToEpoch(parsedValue) <= Date.now() ||
      parsedValue.getTime() < minDateMidnight.getTime() ||
      parsedValue.getTime() > maxDateEnd.getTime()
    );
  }, [parsedValue, minDateMidnight, maxDateEnd]);

  const isCurrentSelectionOutsideWorkingHours = useMemo(() => {
    if (!parsedValue || !workingHoursOnly) return false;
    return !isWithinWorkingHours(parsedValue);
  }, [parsedValue, workingHoursOnly]);

  // Confirmation banner copy
  const confirmationText = useMemo(() => {
    if (!parsedValue) return null;

    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(parsedValue);
    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsedValue);
    const timeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(parsedValue);

    const relativeHint = getRelativeDayHint(parsedValue, now);
    const hintBadge = relativeHint ? ` (${relativeHint})` : "";

    return `Selected: ${weekday}, ${dateFormatted} at ${timeFormatted}${hintBadge}`;
  }, [parsedValue, now]);

  const monthYearLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
      new Date(viewYear, viewMonth, 1)
    );
  }, [viewYear, viewMonth]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className={cn("w-full space-y-1.5 text-left relative", className)} ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="text-rose-700 ml-0.5">*</span>}
        </label>
      )}

      {/* Input Trigger Button */}
      <div className="relative">
        <button
          ref={triggerRef}
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "ArrowDown" || e.key === "ArrowUp") && !isOpen) {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={popoverId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            "w-full min-h-11 md:min-h-10 rounded-md border text-sm text-left bg-white transition-colors flex items-center justify-between pl-3 py-2",
            parsedValue && !disabled ? "pr-14" : "pr-8",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 focus:border-teal-700",
            error
              ? "border-rose-400 text-rose-900 bg-rose-50/20"
              : "border-slate-300 hover:border-slate-400",
            disabled ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className={cn("truncate", !parsedValue ? "text-slate-400" : "text-slate-900 font-medium")}>
              {parsedValue ? formatDisplayDateTime(parsedValue) : placeholder}
            </span>
          </div>
        </button>

        {/* Clear & Clock actions positioned outside the trigger button */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {parsedValue && !disabled && (
            <button
              type="button"
              aria-label="Clear date and time"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <Clock className="w-3.5 h-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Popover Card */}
      {isOpen && !disabled && (
        <div
          id={popoverId}
          ref={popoverRef}
          role="dialog"
          aria-label="Date and time picker"
          className="absolute z-[70] left-0 mt-1 w-full max-w-[460px] bg-white border border-slate-300 shadow-xl rounded-md font-sans text-xs animate-fade-in overflow-hidden"
        >
          {/* Quick Date Shortcuts */}
          <div className="p-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 shrink-0">Quick:</span>
            {shortcuts.map((sc) => {
              const isSelected = parsedValue ? isSameDay(sc.date, parsedValue) : false;
              return (
                <button
                  key={sc.label}
                  type="button"
                  disabled={sc.disabled}
                  onClick={() => handleShortcutClick(sc.date)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors border shadow-2xs",
                    isSelected
                      ? "bg-teal-700 text-white border-teal-700"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-teal-50 hover:border-teal-400 hover:text-teal-900",
                    sc.disabled && "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 pointer-events-none"
                  )}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            {/* Calendar Section */}
            <div className="p-3 space-y-2.5">
              {/* Calendar Month & Year Header */}
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={isPrevMonthDisabled}
                  aria-label="Previous month"
                  className={cn(
                    "p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors",
                    isPrevMonthDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent pointer-events-none"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-semibold text-slate-900 text-xs tracking-tight">
                  {monthYearLabel}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="py-0.5">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: calendarDays.firstDayIndex }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-7 w-7" aria-hidden="true" />
                ))}

                {calendarDays.days.map((item) => {
                  return (
                    <button
                      key={item.dayNumber}
                      type="button"
                      disabled={item.isDisabled}
                      onClick={() => handleSelectDate(item.date)}
                      title={item.isCurrent ? "Current schedule" : undefined}
                      aria-label={item.isCurrent ? `${item.dayNumber}, current schedule` : undefined}
                      className={cn(
                        "h-7 w-7 mx-auto rounded text-xs flex items-center justify-center transition-colors font-medium",
                        item.isCurrent && !item.isSelected && "ring-2 ring-amber-500 bg-amber-50 !text-amber-900 font-bold",
                        item.isDisabled
                          ? "text-slate-300 bg-slate-50/50 cursor-not-allowed pointer-events-none"
                          : item.isSelected
                          ? "bg-teal-700 text-white font-semibold shadow-xs"
                          : item.isToday
                          ? "text-teal-800 font-bold ring-1 ring-teal-600 hover:bg-teal-50"
                          : "text-slate-700 hover:bg-teal-50 hover:text-teal-900 cursor-pointer"
                      )}
                    >
                      {item.dayNumber}
                    </button>
                  );
                })}
              </div>
              {parsedHighlight && (
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-50 ring-2 ring-amber-500" aria-hidden="true" />
                  Current schedule
                </p>
              )}
            </div>

            {/* Time Section */}
            <div className="p-3 space-y-3 bg-slate-50/50">
              {/* Business Interview Time Slots */}
              <div>
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px] mb-2">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Business Slots</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {slotsForWeekday((parsedValue ?? now).getDay()).map((slot) => {
                    const isSelected =
                      parsedValue &&
                      parsedValue.getHours() === slot.hour &&
                      parsedValue.getMinutes() === slot.minute;

                    // Past time slot check
                    const baseDate = parsedValue || now;
                    const slotDateTime = new Date(
                      baseDate.getFullYear(),
                      baseDate.getMonth(),
                      baseDate.getDate(),
                      slot.hour,
                      slot.minute,
                      0,
                      0
                    );
                    const isSlotInPast = manilaWallDateToEpoch(slotDateTime) <= Date.now();

                    return (
                      <button
                        key={slot.label}
                        type="button"
                        disabled={isSlotInPast}
                        onClick={() => handleSelectTimeSlot(slot.hour, slot.minute)}
                        className={cn(
                          "px-2 py-1.5 rounded text-[11px] font-medium border text-center transition-colors",
                          isSelected
                            ? "bg-teal-700 text-white border-teal-700 font-semibold shadow-2xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-teal-50 hover:border-teal-400 hover:text-teal-900",
                          isSlotInPast && "opacity-35 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 pointer-events-none"
                        )}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Time Controls */}
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-[11px] font-semibold text-slate-600">Custom Time</span>
                  {workingHoursOnly && (
                    <span className="text-[10px] text-teal-700 font-medium">
                      {formatMinutes(activeHours.start)} – {formatMinutes(activeHours.end)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Hour Select */}
                  <select
                    value={availableHours12.includes(currentHour12) ? currentHour12 : availableHours12[0]}
                    onChange={(e) => handleCustomHourChange(parseInt(e.target.value, 10))}
                    aria-label="Hour"
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    {availableHours12.map((h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-400 font-bold">:</span>

                  {/* Minute Select */}
                  <select
                    value={availableMinutes.includes(currentMinute) ? currentMinute : availableMinutes[0]}
                    onChange={(e) => handleCustomMinuteChange(parseInt(e.target.value, 10))}
                    aria-label="Minute"
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    {availableMinutes.map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>

                  {/* AM/PM Toggle */}
                  <div className="flex rounded border border-slate-300 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCustomPeriodToggle("AM")}
                      className={cn(
                        "px-2 py-1 text-[11px] font-semibold transition-colors",
                        currentPeriod === "AM"
                          ? "bg-teal-700 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCustomPeriodToggle("PM")}
                      className={cn(
                        "px-2 py-1 text-[11px] font-semibold border-l border-slate-200 transition-colors",
                        currentPeriod === "PM"
                          ? "bg-teal-700 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {isCurrentSelectionInPast && (
                  <p className="text-[11px] text-rose-600 font-medium">
                    Selected time has already passed.
                  </p>
                )}
                {!isCurrentSelectionInPast && isCurrentSelectionOutsideWorkingHours && (
                  <p className="text-[11px] text-rose-600 font-medium">
                    {OFFICE_HOURS_MESSAGE}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Human Readable Confirmation & Close Footer */}
          <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {confirmationText ? (
                <p className="text-[11px] text-slate-700 font-medium truncate">
                  {confirmationText}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Please select a date and time</p>
              )}
            </div>

            <button
              type="button"
              disabled={!parsedValue || isCurrentSelectionInPast || isCurrentSelectionOutsideWorkingHours}
              onClick={() => setIsOpen(false)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-2xs flex items-center gap-1 shrink-0",
                (!parsedValue || isCurrentSelectionInPast || isCurrentSelectionOutsideWorkingHours) && "opacity-40 cursor-not-allowed hover:bg-teal-700"
              )}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* Field Error & Helper Text */}
      {error && (
        <p id={errorId} className="text-xs text-rose-600 font-medium">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
};
