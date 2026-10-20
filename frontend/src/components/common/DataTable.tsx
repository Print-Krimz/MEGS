import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

export type SortDirection = "asc" | "desc";
export interface DataTableSort {
  key: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide this column below the given breakpoint (table view only). */
  hideBelow?: "md" | "lg";
  /** Render the cell as a link to rowHref(row). Defaults to the first column. */
  primary?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Card layout used below `cardsBelow`. Required so phones never get a squeezed table. */
  renderCard: (row: T) => React.ReactNode;
  cardsBelow?: "md" | "lg";
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  isFetching?: boolean;
  empty?: React.ReactNode;
  /** When set, the primary cell renders as a link. Rows themselves are not clickable. */
  rowHref?: (row: T) => string;
  footer?: React.ReactNode;
  caption?: string;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;
const hideClass = { md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  renderCard,
  cardsBelow = "md",
  sort,
  onSortChange,
  isFetching = false,
  empty,
  rowHref,
  footer,
  caption,
  className,
}: DataTableProps<T>) {
  const tableShow = cardsBelow === "lg" ? "hidden lg:block" : "hidden md:block";
  const cardsShow = cardsBelow === "lg" ? "lg:hidden" : "md:hidden";
  const primaryKey = columns.find((c) => c.primary)?.key ?? columns[0]?.key;

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!onSortChange) return;
    const next: SortDirection = sort?.key === col.key && sort.direction === "asc" ? "desc" : "asc";
    onSortChange({ key: col.key, direction: next });
  };

  return (
    <div className={cn("relative border border-slate-300 bg-white", className)} aria-busy={isFetching}>
      {isFetching && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-navy-soft" role="progressbar" aria-label="Refreshing">
          <div className="h-full w-1/3 animate-pulse bg-navy" />
        </div>
      )}

      {rows.length === 0 ? (
        (empty ?? null)
      ) : (
        <>
          <div className={cn("overflow-x-auto", tableShow)}>
            <table className="w-full border-collapse text-sm">
              {caption && <caption className="sr-only">{caption}</caption>}
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  {columns.map((col) => {
                    const active = sort?.key === col.key;
                    const ariaSort = col.sortable
                      ? active
                        ? sort!.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={ariaSort}
                        className={cn(
                          "px-3 py-2.5 text-xs font-semibold text-slate-700",
                          alignClass[col.align ?? "left"],
                          col.hideBelow && hideClass[col.hideBelow],
                          col.className
                        )}
                      >
                        {col.sortable && onSortChange ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            className={cn(
                              "inline-flex min-h-8 items-center gap-1 font-semibold hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy",
                              col.align === "right" && "flex-row-reverse"
                            )}
                          >
                            {col.header}
                            {active ? (
                              sort!.direction === "asc" ? (
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => {
                  const id = getRowId(row);
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      {columns.map((col) => {
                        const content = col.cell(row);
                        const asLink = rowHref && col.key === primaryKey;
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-3 align-middle text-slate-800 tabular-nums",
                              alignClass[col.align ?? "left"],
                              col.hideBelow && hideClass[col.hideBelow],
                              col.className
                            )}
                          >
                            {asLink ? (
                              <Link
                                to={rowHref(row)}
                                className="font-medium text-navy underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                              >
                                {content}
                              </Link>
                            ) : (
                              content
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className={cn("divide-y divide-slate-200", cardsShow)}>
            {rows.map((row) => (
              <li key={getRowId(row)}>{renderCard(row)}</li>
            ))}
          </ul>
        </>
      )}

      {footer && rows.length > 0 && <div className="border-t border-slate-300">{footer}</div>}
    </div>
  );
}
