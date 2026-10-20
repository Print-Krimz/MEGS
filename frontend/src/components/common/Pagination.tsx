import React, { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  /** When provided together with pageSize, shows a rows-per-page control. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** "inset" drops the top border so it sits inside a list container. */
  variant?: "default" | "inset";
  className?: string;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  variant = "default",
  className,
  itemLabel,
}) => {
  const sizeId = useId();
  if (totalPages <= 1 && !totalItems) return null;

  const startItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min((currentPage - 1) * pageSize + 1, totalItems)
    : undefined;
  const endItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min(currentPage * pageSize, totalItems)
    : undefined;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-2 text-sm text-[#4B5F78]",
        variant === "default" && "border-t border-[#D9E2EC]",
        variant === "inset" && "px-3",
        className
      )}
    >
      {/* Items Count Overview */}
      <div>
        {totalItems !== undefined && startItem !== undefined && endItem !== undefined ? (
          <span>
            Showing <strong className="text-[#102A43]">{startItem}</strong>–
            <strong className="text-[#102A43]">{endItem}</strong> of{" "}
            <strong className="text-[#102A43]">{totalItems}</strong> {itemLabel || "records"}
          </span>
        ) : (
          <span>
            Page <strong className="text-[#102A43]">{currentPage}</strong> of{" "}
            <strong className="text-[#102A43]">{totalPages || 1}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onPageSizeChange && pageSize !== undefined && (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId} className="text-sm text-slate-600">
              Rows per page
            </label>
            <select
              id={sizeId}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="min-h-11 md:min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-1"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-0"
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <span className="px-2 text-[#102A43] text-sm font-medium tabular-nums">
            {currentPage} / {totalPages || 1}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-0"
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
