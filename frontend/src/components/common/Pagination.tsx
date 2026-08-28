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
        "flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-2 text-sm text-slate-600 border-t border-slate-300",
        className
      )}
    >
      {/* Items Count Overview */}
      <div>
        {totalItems !== undefined && startItem !== undefined && endItem !== undefined ? (
          <span>
            Showing <strong className="text-slate-900">{startItem}</strong>–
            <strong className="text-slate-900">{endItem}</strong> of{" "}
            <strong className="text-slate-900">{totalItems}</strong> records
          </span>
        ) : (
          <span>
            Page <strong className="text-slate-900">{currentPage}</strong> of{" "}
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
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-0"
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        <span className="px-2 text-slate-800 text-sm font-medium">
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
  );
};
