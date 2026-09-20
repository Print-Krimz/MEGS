import React, { useState, useEffect, useRef, useId } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { cn } from "../../lib/utils";

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
  clearable?: boolean;
  allowCustom?: boolean;
  emptyText?: string;
  className?: string;
  id?: string;
  leftIcon?: React.ReactNode;
  size?: "sm" | "md";
}

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
  clearable = true,
  allowCustom = false,
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

  // Find active option based on current value
  const selectedOption = React.useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value) || null;
  }, [normalizedOptions, value]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
    if (!searchQuery) return normalizedOptions;

    // If the input text matches the current selection's label (or custom value), show all options
    const isMatchingSelected =
      (selectedOption && searchQuery.trim().toLowerCase() === selectedOption.label.trim().toLowerCase()) ||
      (allowCustom && Boolean(value) && searchQuery.trim().toLowerCase() === value.trim().toLowerCase());

    if (isMatchingSelected) {
      return normalizedOptions;
    }

    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery, selectedOption, allowCustom, value]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        // Reset query text to current selected value
        if (selectedOption) {
          setSearchQuery(selectedOption.label);
        } else if (allowCustom && value) {
          setSearchQuery(value);
        } else if (!value) {
          setSearchQuery("");
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, selectedOption, allowCustom, value]);

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
        if (highlightedIndex < filteredOptions.length && filteredOptions[highlightedIndex]) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else if (allowCustom && searchQuery.trim()) {
          handleCommitCustom(searchQuery);
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
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={searchQuery}
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
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="p-2 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

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
            className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-150",
                isOpen && "rotate-180"
              )}
            />
          </button>
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
                  key={opt.value}
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

            {/* Empty state */}
            {filteredOptions.length === 0 && (!allowCustom || !searchQuery.trim()) && (
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
