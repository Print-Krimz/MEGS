import React from "react";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Singular noun for the screen-reader label, e.g. "recruiters". */
  noun: string;
}

/** Previous/next pager with a "1 to 10 of 37" summary. Renders nothing when everything fits on one page. */
export const PaginationBar: React.FC<PaginationBarProps> = ({ page, pageSize, total, onPageChange, noun }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const buttonClass =
    "min-h-9 px-3 text-xs font-medium border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]";

  return (
    <nav
      aria-label={`${noun} pages`}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600"
    >
      <span className="tabular-nums" aria-live="polite">
        {first} to {last} of {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        <button type="button" className={buttonClass} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
};
