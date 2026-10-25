import React from "react";
import { SelectBox } from "../common/SelectBox";

interface PoolSelectAllProps {
  /** Rows that can be invited. Unavailable ones are not counted. */
  total: number;
  selected: number;
  onToggle: () => void;
  /** Plural noun for the screen reader, e.g. "candidates" or "workers". */
  noun?: string;
}

/** Select all for a list or grid of invitable people. */
export const PoolSelectAll: React.FC<PoolSelectAllProps> = ({ total, selected, onToggle, noun = "candidates" }) => (
  <div className="flex items-center text-sm text-slate-700">
    <SelectBox
      checked={total > 0 && selected === total}
      indeterminate={selected > 0 && selected < total}
      disabled={total === 0}
      label={`Select all available ${noun}`}
      onChange={onToggle}
    />
    <span>Select all available ({total})</span>
  </div>
);
