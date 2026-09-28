import React, { useState, useEffect, useRef, useId, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DateTimePickerProps {
  value: string; // ISO string or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: Date; // defaults to new Date()
  className?: string;
  placeholder?: string;
  id?: string;
}

const BUSINESS_SLOTS = [
  { hour: 9, minute: 0, label: "09:00 AM" },
  { hour: 10, minute: 0, label: "10:00 AM" },
  { hour: 11, minute: 0, label: "11:00 AM" },
  { hour: 13, minute: 0, label: "01:00 PM" },
  { hour: 14, minute: 0, label: "02:00 PM" },
  { hour: 15, minute: 0, label: "03:00 PM" },
  { hour: 16, minute: 0, label: "04:00 PM" },
  { hour: 17, minute: 0, label: "05:00 PM" },
] as const;

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/**
 * Safely parse ISO string or YYYY-MM-DDTHH:mm format into local Date
 */
function parseDateTimeValue(val?: string | null): Date | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Handle YYYY-MM-DDTHH:mm(:ss) without timezone
  const localMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    const year = parseInt(localMatch[1], 10);
    const month = parseInt(localMatch[2], 10) - 1;
    const day = parseInt(localMatch[3], 10);
    const hours = parseInt(localMatch[4], 10);
    const minutes = parseInt(localMatch[5], 10);
    const seconds = localMatch[6] ? parseInt(localMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback for standard ISO strings with timezone offsets / Z
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
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
  minDate = new Date(),
  className,
  placeholder = "Select date and time...",
  id: customId,
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const popoverId = `${inputId}-popover`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  // Normalize minDate start of day for strict past date disabling
  const now = useMemo(() => new Date(), [isOpen]);
  const effectiveMinDate = minDate || now;
  const minDateMidnight = useMemo(
    () => new Date(effectiveMinDate.getFullYear(), effectiveMinDate.getMonth(), effectiveMinDate.getDate(), 0, 0, 0, 0),
    [effectiveMinDate]
  );

  // Current selected parsed date
  const parsedValue = useMemo(() => parseDateTimeValue(value), [value]);

  // Calendar month/year navigation state
  const [viewYear, setViewYear] = useState<number>(() => {
    return parsedValue ? parsedValue.getFullYear() : effectiveMinDate.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    return parsedValue ? parsedValue.getMonth() : effectiveMinDate.getMonth();
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
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);
      const isDisabled = date.getTime() < minDateMidnight.getTime();
      const isToday = isSameDay(date, now);
      const isSelected = parsedValue ? isSameDay(date, parsedValue) : false;

      days.push({
        dayNumber: day,
        date,
        isDisabled,
        isToday,
        isSelected,
      });
    }

    return {
      firstDayIndex,
      days,
    };
  }, [viewYear, viewMonth, minDateMidnight, now, parsedValue]);

  // Helper to apply or update date while preserving or defaulting time
  const handleSelectDate = (date: Date) => {
    let hours = 9;
    let minutes = 0;

    if (parsedValue) {
      hours = parsedValue.getHours();
      minutes = parsedValue.getMinutes();
    }

    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);

    // If the candidate selected time is in the past for today, pick the next available future business slot
    if (candidate.getTime() <= now.getTime()) {
      const nextSlot = BUSINESS_SLOTS.find((s) => {
        const slotTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), s.hour, s.minute, 0, 0);
        return slotTime.getTime() > now.getTime();
      });

      if (nextSlot) {
        candidate.setHours(nextSlot.hour, nextSlot.minute, 0, 0);
      } else {
        // If today's business slots have all passed, advance hour slightly beyond now if possible
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
        disabled: today.getTime() < minDateMidnight.getTime(),
      },
      {
        label: "Tomorrow",
        date: tomorrow,
        disabled: tomorrow.getTime() < minDateMidnight.getTime(),
      },
      {
        label: "In 2 Days",
        date: inTwoDays,
        disabled: inTwoDays.getTime() < minDateMidnight.getTime(),
      },
      {
        label: "Next Monday",
        date: nextMonday,
        disabled: nextMonday.getTime() < minDateMidnight.getTime(),
      },
    ];
  }, [now, minDateMidnight]);

  const handleShortcutClick = (date: Date) => {
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    handleSelectDate(date);
  };

  // Time slot selection
  const handleSelectTimeSlot = (hour: number, minute: number) => {
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
    onChange(formatToValueString(updated));
  };

  // Custom time helpers
  const currentHour24 = parsedValue ? parsedValue.getHours() : 9;
  const currentMinute = parsedValue ? parsedValue.getMinutes() : 0;

  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24;
  const currentPeriod: "AM" | "PM" = currentHour24 >= 12 ? "PM" : "AM";

  const handleCustomHourChange = (newHour12: number) => {
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    let newHour24 = newHour12;
    if (currentPeriod === "AM") {
      newHour24 = newHour12 === 12 ? 0 : newHour12;
    } else {
      newHour24 = newHour12 === 12 ? 12 : newHour12 + 12;
    }
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), newHour24, currentMinute, 0, 0);
    onChange(formatToValueString(updated));
  };

  const handleCustomMinuteChange = (newMinute: number) => {
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), currentHour24, newMinute, 0, 0);
    onChange(formatToValueString(updated));
  };

  const handleCustomPeriodToggle = (period: "AM" | "PM") => {
    if (period === currentPeriod) return;
    const base = parsedValue || (calendarDays.days.find((d) => !d.isDisabled)?.date ?? new Date());
    let newHour24 = currentHour12;
    if (period === "AM") {
      newHour24 = currentHour12 === 12 ? 0 : currentHour12;
    } else {
      newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12;
    }
    const updated = new Date(base.getFullYear(), base.getMonth(), base.getDate(), newHour24, currentMinute, 0, 0);
    onChange(formatToValueString(updated));
  };

  // Check if current selection is invalid (in the past)
  const isCurrentSelectionInPast = useMemo(() => {
    if (!parsedValue) return false;
    return parsedValue.getTime() < effectiveMinDate.getTime();
  }, [parsedValue, effectiveMinDate]);

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
          {required && <span className="text-rose-500 ml-0.5">*</span>}
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
                      className={cn(
                        "h-7 w-7 mx-auto rounded text-xs flex items-center justify-center transition-colors font-medium",
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
                  {BUSINESS_SLOTS.map((slot) => {
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
                    const isSlotInPast = slotDateTime.getTime() <= now.getTime();

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
                <span className="block text-[11px] font-semibold text-slate-600">Custom Time</span>
                <div className="flex items-center gap-1.5">
                  {/* Hour Select */}
                  <select
                    value={currentHour12}
                    onChange={(e) => handleCustomHourChange(parseInt(e.target.value, 10))}
                    aria-label="Hour"
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-400 font-bold">:</span>

                  {/* Minute Select */}
                  <select
                    value={currentMinute}
                    onChange={(e) => handleCustomMinuteChange(parseInt(e.target.value, 10))}
                    aria-label="Minute"
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    {[0, 15, 30, 45].map((m) => (
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
              disabled={!parsedValue || isCurrentSelectionInPast}
              onClick={() => setIsOpen(false)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-2xs flex items-center gap-1 shrink-0",
                (!parsedValue || isCurrentSelectionInPast) && "opacity-40 cursor-not-allowed hover:bg-teal-700"
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
