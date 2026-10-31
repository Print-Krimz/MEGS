import React, { useState, useEffect, useLayoutEffect, useRef, useId } from "react";
import { ChevronDown, Check, X, Search, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { FIELD_LIMITS, getInputTextLimit } from "../../lib/field-limits";

const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Bolds the parts of `text` that match any word of `query` (case-insensitive). */
export const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi"));
  const lowered = tokens.map((t) => t.toLowerCase());
  return (
    <>
      {parts.map((part, i) =>
        part && lowered.includes(part.toLowerCase()) ? (
          <mark key={i} className="bg-transparent font-bold text-navy underline decoration-navy/40 underline-offset-2">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

export interface ComboBoxOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  /** Colours the badge; "teal" and "amber" render as a readable label rather than a code tag. */
  badgeTone?: "neutral" | "teal" | "amber";
  /** Options sharing a group are shown under one heading, in the order given. */
  group?: string;
  disabled?: boolean;
}

export interface ComboBoxProps {
  options: (ComboBoxOption | string)[];
  value?: string;
  onChange: (value: string, option: ComboBoxOption | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  clearable?: boolean;
  allowCustom?: boolean;
  maxLength?: number;
  /** Typed text keeps digits only, for codes such as a postal code. */
  digitsOnly?: boolean;
  emptyText?: string;
  className?: string;
  id?: string;
  leftIcon?: React.ReactNode;
  size?: "sm" | "md";
  /**
   * Opt-in windowed rendering for large, ungrouped lists: only the visible rows plus overscan are mounted.
   * Ignored (normal rendering) when options are grouped or when allowCustom/loading is set.
   */
  windowed?: boolean;
}

/** Fixed row height (px) and overscan used by windowed mode; at most ~25 options are ever mounted. */
const WINDOW_ROW_HEIGHT = 52;
const WINDOW_OVERSCAN = 8;
const WINDOW_VIEWPORT_FALLBACK = 240;

interface IndexedOption {
  opt: ComboBoxOption;
  labelLower: string;
  valueLower: string;
  subtitleLower: string;
  /** Normalized "value label subtitle" used for token matching. */
  combinedNorm: string;
  normValue: string;
  normLabel: string;
  /** Numeric part of "Barangay N" (value first, then label), or null. */
  barangayNum: number | null;
}

const BARANGAY_NUMBER = /\bbarangay\s+0*(\d+)\b/i;

const normalizeSearchText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(brgy|bgy)\.?\s*/g, "barangay ")
    .replace(/\b(sto|sta)\.?\s*/g, (m) => m.startsWith("sto") ? "santo " : "santa ")
    .replace(/[—–\-_/\\,.:;()+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const ComboBox: React.FC<ComboBoxProps> = ({
  options: rawOptions,
  value = "",
  onChange,
  label,
  placeholder = "Select or search...",
  error,
  helperText,
  required,
  disabled,
  loading = false,
  loadingText = "Loading options...",
  clearable = true,
  allowCustom = false,
  maxLength,
  digitsOnly = false,
  emptyText = "No matching options found",
  className,
  id: customId,
  leftIcon,
  size = "md",
  windowed = false,
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const listId = `${inputId}-list`;

  // Normalize string[] or ComboBoxOption[] into ComboBoxOption[]
  const normalizedOptions: ComboBoxOption[] = React.useMemo(() => {
    if (!rawOptions || !Array.isArray(rawOptions)) return [];
    return rawOptions.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [rawOptions]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Searchable text and duplicate-value lookups are computed once per options change, not per keystroke.
  const { indexed, valueIndices } = React.useMemo(() => {
    const valueIndices = new Map<string, number[]>();
    const indexed: IndexedOption[] = normalizedOptions.map((opt, i) => {
      const list = valueIndices.get(opt.value);
      if (list) list.push(i);
      else valueIndices.set(opt.value, [i]);
      const num = opt.value.match(BARANGAY_NUMBER)?.[1] ?? opt.label.match(BARANGAY_NUMBER)?.[1];
      return {
        opt,
        labelLower: opt.label.toLowerCase(),
        valueLower: opt.value.toLowerCase(),
        subtitleLower: opt.subtitle?.toLowerCase() || "",
        combinedNorm: normalizeSearchText(`${opt.value} ${opt.label} ${opt.subtitle || ""}`),
        normValue: normalizeSearchText(opt.value),
        normLabel: normalizeSearchText(opt.label),
        barangayNum: num ? parseInt(num, 10) : null,
      };
    });
    return { indexed, valueIndices };
  }, [normalizedOptions]);

  // Find active option based on current value
  const selectedOption = React.useMemo(() => {
    if (!value) return null;
    const matches = (valueIndices.get(value) ?? []).map((i) => normalizedOptions[i]);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const matchByQuery = matches.find((opt) => {
        const q = searchQuery.toLowerCase().trim();
        return q && opt.label.toLowerCase().includes(q);
      });
      return matchByQuery || matches[0];
    }
    // Fallback: normalized match (e.g. value is "Brgy 1", option value is "Barangay 1")
    const normValue = normalizeSearchText(value);
    if (normValue) {
      const normMatch = indexed.find((item) => item.normValue === normValue || item.normLabel === normValue);
      if (normMatch) return normMatch.opt;
    }
    return null;
  }, [normalizedOptions, indexed, valueIndices, value, searchQuery]);

  // Synchronize search input display with value
  useEffect(() => {
    // Only update searchQuery from outside props if the input is not currently actively focused by the user
    if (document.activeElement === inputRef.current) return;

    if (selectedOption) {
      setSearchQuery(selectedOption.label);
    } else if (allowCustom && value) {
      setSearchQuery(value);
    } else if (!value) {
      setSearchQuery("");
    }
  }, [value, selectedOption, allowCustom]);

  // Typed text to highlight in the list; empty while the input just shows the current selection.
  const highlightQuery = React.useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return "";
    if (selectedOption && q.toLowerCase() === selectedOption.label.trim().toLowerCase()) return "";
    if (allowCustom && value && q.toLowerCase() === value.trim().toLowerCase()) return "";
    return q;
  }, [searchQuery, selectedOption, allowCustom, value]);

  // Filter options based on user input
  const filteredOptions = React.useMemo(() => {
    const rawQuery = searchQuery.trim();
    if (!rawQuery) return normalizedOptions;

    // If the input text matches the current selection's label (or custom value), show all options
    const isMatchingSelected =
      (selectedOption && rawQuery.toLowerCase() === selectedOption.label.trim().toLowerCase()) ||
      (allowCustom && Boolean(value) && rawQuery.toLowerCase() === value.trim().toLowerCase());

    if (isMatchingSelected) {
      return normalizedOptions;
    }

    const q = rawQuery.toLowerCase();
    const normalizedQ = normalizeSearchText(rawQuery);
    const queryTokens = normalizedQ.split(" ").filter(Boolean);
    const fourDigitMatch = rawQuery.match(/\b\d{4}\b/)?.[0];
    const numberOnly = rawQuery.match(/^0*(\d+)$/)?.[1];
    const numberQuery = numberOnly ? parseInt(numberOnly, 10) : null;

    const matched = indexed.filter((item) => {
      const opt = item.opt;
      // 1. Exact 4-digit code match in search query (e.g. "1208--Valuen" matches option with value "1208")
      if (fourDigitMatch && opt.value === fourDigitMatch) {
        // If there are other non-numeric query tokens, check if at least one matches or prioritize
        const textTokens = queryTokens.filter((t) => t !== fourDigitMatch);
        if (textTokens.length === 0) return true;
        const anyTextMatches = textTokens.some((t) => item.combinedNorm.includes(t));
        // If text tokens match, or if this is the only option with that 4-digit code
        if (anyTextMatches || valueIndices.get(fourDigitMatch)?.length === 1) {
          return true;
        }
      }

      // Exact number query matching option number (e.g. user typed "1", matches "Barangay 1" or "Brgy 1")
      if (numberQuery !== null && item.barangayNum === numberQuery) {
        return true;
      }

      // 2. Direct substring match
      if (item.labelLower.includes(q) || item.valueLower.includes(q) || item.subtitleLower.includes(q)) {
        return true;
      }

      // 3. Normalized token matching (e.g. "1208 Valen" matches "1208 — Valenzuela", "brgy 1" matches "Barangay 1")
      if (queryTokens.length > 0 && queryTokens.every((token) => item.combinedNorm.includes(token))) {
        return true;
      }

      return false;
    });

    if (numberQuery !== null) {
      return [...matched]
        .sort((a, b) => {
          const aExact = a.barangayNum === numberQuery;
          const bExact = b.barangayNum === numberQuery;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return 0;
        })
        .map((item) => item.opt);
    }

    return matched.map((item) => item.opt);
  }, [normalizedOptions, indexed, valueIndices, searchQuery, selectedOption, allowCustom, value]);

  // Windowing only applies to the large, ungrouped, non-custom list; everything else keeps the full render path.
  const useWindow = windowed && !allowCustom && !loading && !filteredOptions.some((opt) => opt.group);
  const [windowScrollTop, setWindowScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Logical indices (into filteredOptions) to mount: visible rows + overscan, plus the active row so
  // aria-activedescendant always points at a mounted element.
  const renderIndices = React.useMemo(() => {
    const total = filteredOptions.length;
    if (!useWindow) return Array.from({ length: total }, (_, i) => i);
    const first = Math.max(0, Math.floor(windowScrollTop / WINDOW_ROW_HEIGHT) - WINDOW_OVERSCAN);
    const last = Math.min(
      total - 1,
      Math.ceil((windowScrollTop + WINDOW_VIEWPORT_FALLBACK) / WINDOW_ROW_HEIGHT) + WINDOW_OVERSCAN
    );
    const indices: number[] = [];
    for (let i = first; i <= last; i++) indices.push(i);
    if (highlightedIndex < total && (highlightedIndex < first || highlightedIndex > last)) indices.push(highlightedIndex);
    return indices;
  }, [useWindow, filteredOptions.length, windowScrollTop, highlightedIndex]);

  const handleSelectOption = (opt: ComboBoxOption) => {
    if (opt.disabled) return;
    setSearchQuery(opt.label);
    onChange(opt.value, opt);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleCommitCustom = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange("", null);
      setSearchQuery("");
    } else {
      const matched = normalizedOptions.find(
        (o) => o.label.toLowerCase() === trimmed.toLowerCase() || o.value.toLowerCase() === trimmed.toLowerCase()
      );
      if (matched) {
        handleSelectOption(matched);
      } else {
        const customOpt: ComboBoxOption = { value: trimmed, label: trimmed };
        setSearchQuery(trimmed);
        onChange(trimmed, customOpt);
      }
    }
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const resolveAndCommitQuery = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      onChange("", null);
      setSearchQuery("");
      return;
    }

    // 1. Exact value match (e.g. user typed "1208")
    const exactValue = normalizedOptions.find(
      (o) => o.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactValue && !exactValue.disabled) {
      handleSelectOption(exactValue);
      return;
    }

    // 2. Exact label match (e.g. user typed "1208 — Valenzuela")
    const exactLabel = normalizedOptions.find(
      (o) => o.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactLabel && !exactLabel.disabled) {
      handleSelectOption(exactLabel);
      return;
    }

    // 3. Exact normalized label/value match
    const normalizedTrimmed = normalizeSearchText(trimmed);
    const normalizedMatch = normalizedOptions.find(
      (o) => !o.disabled && (normalizeSearchText(o.label) === normalizedTrimmed || normalizeSearchText(o.value) === normalizedTrimmed)
    );
    if (normalizedMatch) {
      handleSelectOption(normalizedMatch);
      return;
    }

    // 3b. Exact number-only match against numbered options (e.g. user typed "1" -> matches "Barangay 1")
    const numberOnly = trimmed.match(/^0*(\d+)$/)?.[1];
    if (numberOnly) {
      const numInt = parseInt(numberOnly, 10);
      const exactNumberedOpt = normalizedOptions.find((o) => {
        if (o.disabled) return false;
        const optNum = o.value.match(/\bbarangay\s+0*(\d+)\b/i)?.[1] || o.label.match(/\bbarangay\s+0*(\d+)\b/i)?.[1];
        return optNum && parseInt(optNum, 10) === numInt;
      });
      if (exactNumberedOpt) {
        handleSelectOption(exactNumberedOpt);
        return;
      }
    }

    // 4. Single filtered option match
    if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
      handleSelectOption(filteredOptions[0]);
      return;
    }

    // 5. Custom value if allowed
    if (allowCustom) {
      handleCommitCustom(trimmed);
      return;
    }

    // 6. Otherwise revert to currently selected option or blank
    if (selectedOption) {
      setSearchQuery(selectedOption.label);
    } else if (value) {
      setSearchQuery(value);
    } else {
      setSearchQuery("");
    }
  };

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        resolveAndCommitQuery(searchQuery);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, searchQuery, normalizedOptions, filteredOptions, selectedOption, allowCustom, value]);

  // Keep the highlighted option visible by scrolling the dropdown itself, never the surrounding document.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!isOpen || !container) return;

    if (useWindow) {
      const viewport = container.clientHeight || WINDOW_VIEWPORT_FALLBACK;
      const top = highlightedIndex * WINDOW_ROW_HEIGHT;
      let next = container.scrollTop;
      if (top < next) next = top;
      else if (top + WINDOW_ROW_HEIGHT > next + viewport) next = top + WINDOW_ROW_HEIGHT - viewport;
      if (next !== container.scrollTop) container.scrollTop = next;
      setWindowScrollTop(next);
      return;
    }

    const item = document.getElementById(`${listId}-option-${highlightedIndex}`);
    if (!item) return;
    const itemRect = item.getBoundingClientRect();
    const boxRect = container.getBoundingClientRect();
    if (itemRect.top < boxRect.top) container.scrollTop -= boxRect.top - itemRect.top;
    else if (itemRect.bottom > boxRect.bottom) container.scrollTop += itemRect.bottom - boxRect.bottom;
  }, [highlightedIndex, isOpen, useWindow, filteredOptions, listId]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery("");
    onChange("", null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        const max = allowCustom && searchQuery ? filteredOptions.length : filteredOptions.length - 1;
        setHighlightedIndex((prev) => (prev < max ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        const max = allowCustom && searchQuery ? filteredOptions.length : filteredOptions.length - 1;
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : max));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen) {
        if (highlightedIndex < filteredOptions.length && filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else if (allowCustom && searchQuery.trim()) {
          handleCommitCustom(searchQuery);
        } else {
          resolveAndCommitQuery(searchQuery);
        }
      } else {
        if (allowCustom && searchQuery.trim()) {
          handleCommitCustom(searchQuery);
        } else {
          setIsOpen(true);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      if (selectedOption) {
        setSearchQuery(selectedOption.label);
      } else if (allowCustom && value) {
        setSearchQuery(value);
      } else {
        setSearchQuery("");
      }
      inputRef.current?.blur();
    } else if (e.key === "Tab") {
      if (isOpen) {
        setIsOpen(false);
        if (highlightedIndex < filteredOptions.length && filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else {
          resolveAndCommitQuery(searchQuery);
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = digitsOnly ? e.target.value.replace(/\D/g, "") : e.target.value;
    setSearchQuery(val);
    setHighlightedIndex(0);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      setIsOpen(true);
      e.target.select();
      const selectedIdx = valueIndices.get(value)?.[0] ?? -1;
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  };

  const handleInputClick = () => {
    if (!disabled && !isOpen) {
      setIsOpen(true);
      const selectedIdx = valueIndices.get(value)?.[0] ?? -1;
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  };

  const hasValue = Boolean(value || (allowCustom && searchQuery));

  return (
    <div className={cn("space-y-1 relative", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 tracking-tight"
        >
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={isOpen && filteredOptions[highlightedIndex] ? `${listId}-option-${highlightedIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          aria-busy={loading}
          disabled={disabled}
          required={required}
          placeholder={loading && !searchQuery ? loadingText : placeholder}
          value={searchQuery}
          maxLength={maxLength ?? getInputTextLimit(label, "text", FIELD_LIMITS.shortText)}
          onChange={handleInputChange}
          inputMode={digitsOnly ? "numeric" : undefined}
          onFocus={handleInputFocus}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={cn(
            "w-full min-h-11 md:min-h-10 rounded-md bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus:border-focus transition-colors cursor-text text-left",
            size === "sm" ? "px-3 py-2 text-sm" : "px-3 py-2 text-sm",
            leftIcon ? "pl-8" : undefined,
            (clearable && hasValue) ? "pr-[5.5rem] md:pr-14" : "pr-12 md:pr-8",
            error && "border-rose-500 focus-visible:ring-rose-500 focus:border-rose-500",
            disabled && "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
          )}
        />

        {/* Action icons */}
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1 pointer-events-none">
          {loading && (
            <div className="p-1 text-navy flex items-center justify-center pointer-events-none" aria-label={loadingText}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}

          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md cursor-pointer pointer-events-auto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {!loading && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                if (!disabled) {
                  if (isOpen) {
                    setIsOpen(false);
                  } else {
                    inputRef.current?.focus();
                    setIsOpen(true);
                    const selectedIdx = valueIndices.get(value)?.[0] ?? -1;
                    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
                  }
                }
              }}
              aria-label="Toggle options menu"
              className="inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-6 items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer pointer-events-auto"
            >
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-150",
                  isOpen && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Options Listbox */}
      {isOpen && !disabled && (
        <div
          ref={scrollRef}
          onScroll={useWindow ? (e) => setWindowScrollTop(e.currentTarget.scrollTop) : undefined}
          className="absolute z-[70] w-full mt-1 bg-white border border-slate-300 shadow-xl max-h-60 overflow-y-auto font-sans animate-fade-in text-xs"
        >
          <ul
            id={listId}
            role="listbox"
            ref={listRef}
            className={cn("divide-y divide-slate-100", useWindow ? "relative" : "py-0.5")}
            style={useWindow ? { height: filteredOptions.length * WINDOW_ROW_HEIGHT } : undefined}
          >
            {renderIndices.map((idx) => {
              const opt = filteredOptions[idx];
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              const showGroupHeading = Boolean(opt.group) && opt.group !== filteredOptions[idx - 1]?.group;

              return (
                <React.Fragment key={`${opt.value}-${opt.label}-${idx}`}>
                {showGroupHeading && (
                  <li
                    role="presentation"
                    className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    {opt.group}
                  </li>
                )}
                <li
                  id={`${listId}-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-setsize={useWindow ? filteredOptions.length : undefined}
                  aria-posinset={useWindow ? idx + 1 : undefined}
                  style={useWindow ? { position: "absolute", top: idx * WINDOW_ROW_HEIGHT, left: 0, right: 0, height: WINDOW_ROW_HEIGHT } : undefined}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectOption(opt)}
                  className={cn(
                    "px-3 cursor-pointer flex items-center justify-between gap-2 transition-colors select-none",
                    useWindow ? "box-border overflow-hidden" : "py-2.5",
                    isHighlighted ? "bg-navy-soft text-navy-hover" : "text-slate-800 hover:bg-slate-50",
                    opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate font-medium", isSelected && "font-bold text-navy")}>
                        <HighlightMatch text={opt.label} query={highlightQuery} />
                      </span>
                      {opt.badge && (
                        <span
                          className={cn(
                            "shrink-0 text-[10px] px-1.5 py-0.2 border",
                            opt.badgeTone === "teal"
                              ? "rounded font-sans font-semibold bg-teal-50 text-teal-800 border-teal-300"
                              : opt.badgeTone === "amber"
                                ? "rounded font-sans font-semibold bg-amber-50 text-amber-800 border-amber-300"
                                : "font-mono bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.subtitle && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                        <HighlightMatch text={opt.subtitle} query={highlightQuery} />
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-navy shrink-0" />
                  )}
                </li>
                </React.Fragment>
              );
            })}

            {/* Custom value creation option if allowCustom is enabled */}
            {allowCustom && searchQuery.trim() && !filteredOptions.some(o => o.label.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <li
                role="option"
                id={`${listId}-option-${filteredOptions.length}`}
                onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                onClick={() => handleCommitCustom(searchQuery)}
                className={cn(
                  "px-3 py-2.5 cursor-pointer flex items-center gap-2 text-navy bg-navy-soft/60 hover:bg-navy-soft transition-colors border-t border-navy-line",
                  highlightedIndex === filteredOptions.length && "bg-navy-soft"
                )}
              >
                <span className="text-sm">
                  Use custom entry: <strong className="font-bold">"{searchQuery.trim()}"</strong>
                </span>
              </li>
            )}

            {/* Loading state */}
            {loading && (
              <li className="px-3 py-4 text-center text-slate-500 italic flex items-center justify-center gap-2 select-none">
                <Loader2 className="w-4 h-4 animate-spin text-navy" />
                <span>{loadingText}</span>
              </li>
            )}

            {/* Empty state */}
            {!loading && filteredOptions.length === 0 && (!allowCustom || !searchQuery.trim()) && (
              <li className="px-3 py-4 text-center text-slate-400 italic">
                <Search className="w-4 h-4 mx-auto mb-1 text-slate-300" />
                <span>{emptyText}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <p id={errorId} className="text-xs text-rose-600 font-medium">{error}</p>
      )}
      {!error && helperText && (
        <p id={helperId} className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
