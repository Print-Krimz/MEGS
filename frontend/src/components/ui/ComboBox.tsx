import React, { useState, useEffect, useRef, useId } from "react";
import { ChevronDown, Check, X, Search, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { FIELD_LIMITS, getInputTextLimit } from "../../lib/field-limits";

export interface ComboBoxOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
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
  emptyText?: string;
  className?: string;
  id?: string;
  leftIcon?: React.ReactNode;
  size?: "sm" | "md";
}

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
  emptyText = "No matching options found",
  className,
  id: customId,
  leftIcon,
  size = "md",
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

  // Find active option based on current value
  const selectedOption = React.useMemo(() => {
    if (!value) return null;
    const matches = normalizedOptions.filter((opt) => opt.value === value);
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
      const normMatch = normalizedOptions.find(
        (opt) => normalizeSearchText(opt.value) === normValue || normalizeSearchText(opt.label) === normValue
      );
      if (normMatch) return normMatch;
    }
    return null;
  }, [normalizedOptions, value, searchQuery]);

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

    const matched = normalizedOptions.filter((opt) => {
      // 1. Exact 4-digit code match in search query (e.g. "1208--Valuen" matches option with value "1208")
      if (fourDigitMatch && opt.value === fourDigitMatch) {
        // If there are other non-numeric query tokens, check if at least one matches or prioritize
        const textTokens = queryTokens.filter((t) => t !== fourDigitMatch);
        if (textTokens.length === 0) return true;
        const combinedNormalized = normalizeSearchText(`${opt.value} ${opt.label} ${opt.subtitle || ""}`);
        const anyTextMatches = textTokens.some((t) => combinedNormalized.includes(t));
        // If text tokens match, or if this is the only option with that 4-digit code
        if (anyTextMatches || normalizedOptions.filter((o) => o.value === fourDigitMatch).length === 1) {
          return true;
        }
      }

      // Exact number query matching option number (e.g. user typed "1", matches "Barangay 1" or "Brgy 1")
      if (numberQuery !== null) {
        const optNum = opt.value.match(/\bbarangay\s+0*(\d+)\b/i)?.[1] || opt.label.match(/\bbarangay\s+0*(\d+)\b/i)?.[1];
        if (optNum && parseInt(optNum, 10) === numberQuery) {
          return true;
        }
      }

      const labelLower = opt.label.toLowerCase();
      const valueLower = opt.value.toLowerCase();
      const subtitleLower = opt.subtitle?.toLowerCase() || "";

      // 2. Direct substring match
      if (labelLower.includes(q) || valueLower.includes(q) || subtitleLower.includes(q)) {
        return true;
      }

      // 3. Normalized token matching (e.g. "1208 Valen" matches "1208 — Valenzuela", "brgy 1" matches "Barangay 1")
      if (queryTokens.length > 0) {
        const combinedNormalized = normalizeSearchText(`${opt.value} ${opt.label} ${opt.subtitle || ""}`);
        const allTokensMatch = queryTokens.every((token) => combinedNormalized.includes(token));
        if (allTokensMatch) return true;
      }

      return false;
    });

    if (numberQuery !== null) {
      return [...matched].sort((a, b) => {
        const aNum = a.value.match(/\bbarangay\s+0*(\d+)\b/i)?.[1] || a.label.match(/\bbarangay\s+0*(\d+)\b/i)?.[1];
        const bNum = b.value.match(/\bbarangay\s+0*(\d+)\b/i)?.[1] || b.label.match(/\bbarangay\s+0*(\d+)\b/i)?.[1];
        const aExact = aNum && parseInt(aNum, 10) === numberQuery;
        const bExact = bNum && parseInt(bNum, 10) === numberQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
    }

    return matched;
  }, [normalizedOptions, searchQuery, selectedOption, allowCustom, value]);

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

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      if (items[highlightedIndex] && typeof items[highlightedIndex].scrollIntoView === "function") {
        items[highlightedIndex].scrollIntoView({
          block: "nearest",
        });
      }
    }
  }, [highlightedIndex, isOpen]);

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
    const val = e.target.value;
    setSearchQuery(val);
    setHighlightedIndex(0);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      setIsOpen(true);
      e.target.select();
      const selectedIdx = normalizedOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  };

  const handleInputClick = () => {
    if (!disabled && !isOpen) {
      setIsOpen(true);
      const selectedIdx = normalizedOptions.findIndex((opt) => opt.value === value);
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
          onFocus={handleInputFocus}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={cn(
            "w-full min-h-11 md:min-h-10 rounded-md bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 focus:border-teal-700 transition-colors cursor-text text-left",
            size === "sm" ? "px-3 py-2 text-sm" : "px-3 py-2 text-sm",
            leftIcon ? "pl-8" : undefined,
            (clearable && hasValue) ? "pr-14" : "pr-8",
            error && "border-rose-500 focus:ring-rose-500 focus:border-rose-500",
            disabled && "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
          )}
        />

        {/* Action icons */}
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1 pointer-events-none">
          {loading && (
            <div className="p-1 text-teal-600 flex items-center justify-center pointer-events-none" aria-label={loadingText}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}

          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="p-2 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 cursor-pointer pointer-events-auto"
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
                    const selectedIdx = normalizedOptions.findIndex((opt) => opt.value === value);
                    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
                  }
                }
              }}
              aria-label="Toggle options menu"
              className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer pointer-events-auto"
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
        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-300 shadow-xl max-h-60 overflow-y-auto font-sans animate-fade-in text-xs">
          <ul
            id={listId}
            role="listbox"
            ref={listRef}
            className="divide-y divide-slate-100 py-0.5"
          >
            {filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={`${opt.value}-${opt.label}-${idx}`}
                  id={`${listId}-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectOption(opt)}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors select-none",
                    isHighlighted ? "bg-teal-50 text-teal-950" : "text-slate-800 hover:bg-slate-50",
                    opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate font-medium", isSelected && "font-bold text-teal-900")}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.subtitle && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                        {opt.subtitle}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  )}
                </li>
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
                  "px-3 py-2.5 cursor-pointer flex items-center gap-2 text-teal-800 bg-teal-50/60 hover:bg-teal-100/80 transition-colors border-t border-teal-200",
                  highlightedIndex === filteredOptions.length && "bg-teal-100"
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
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
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
