import React from "react";

const checkboxClass =
  "h-4 w-4 rounded border-slate-400 text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-40";

/** Checkbox with a 44px touch target on coarse pointers. The label is read aloud, so name the row it selects. */
export const SelectBox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}> = ({ checked, indeterminate = false, disabled, label, onChange }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11">
      <input
        ref={ref}
        type="checkbox"
        className={checkboxClass}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
      />
    </label>
  );
};
