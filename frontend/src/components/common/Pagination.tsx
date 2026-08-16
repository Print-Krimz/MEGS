import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
}) => {
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
        "flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-2 text-xs text-slate-600 border-t border-slate-300",
        className
      )}
    >
      {/* Items Count Overview */}
      <div>
        {totalItems !== undefined && startItem !== undefined && endItem !== undefined ? (
          <span className="font-mono text-[11px]">
            SHOWING <strong className="text-slate-900">{startItem}</strong>-
            <strong className="text-slate-900">{endItem}</strong> OF{" "}
            <strong className="text-slate-900">{totalItems}</strong> RECORDS
          </span>
        ) : (
          <span className="font-mono text-[11px]">
            PAGE <strong className="text-slate-900">{currentPage}</strong> OF{" "}
            <strong className="text-slate-900">{totalPages || 1}</strong>
          </span>
        )}
      </div>

      {/* Page Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-7 w-7 p-0"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        <span className="px-2 font-mono text-slate-800 text-xs font-bold">
          {currentPage} / {totalPages || 1}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-7 w-7 p-0"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
