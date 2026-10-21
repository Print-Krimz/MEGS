import React from "react";
import {
  DataTable,
  FilterTile,
  FilterTileRow,
  Pagination,
  SearchFilters,
  type DataTableColumn,
  type DataTableSort,
} from "../../common";
import type { FilterConfig } from "../../common/SearchFilters";
import type { Application } from "../../../lib/types";

export interface ComplianceTile {
  id: string;
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "warning" | "danger";
}

export interface ComplianceQueueProps {
  /** Table caption for screen readers. */
  caption: string;
  tiles: ComplianceTile[];
  selectedTile: string;
  onTileChange: (id: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterConfig[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
  columns: DataTableColumn<Application>[];
  /** The rows of the current page. */
  rows: Application[];
  renderCard: (app: Application) => React.ReactNode;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  empty: React.ReactNode;
  page: number;
  pageSize: number;
  /** Rows after filters, across all pages. */
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel: string;
  isFetching?: boolean;
}

/**
 * Shared frame of both compliance queues: filter tiles, one toolbar, one table (cards on phones) and one count.
 * The pages supply the columns and cards; this keeps the two queues looking and behaving the same.
 */
export const ComplianceQueue: React.FC<ComplianceQueueProps> = ({
  caption,
  tiles,
  selectedTile,
  onTileChange,
  searchLabel,
  searchPlaceholder,
  search,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  onReset,
  columns,
  rows,
  renderCard,
  sort,
  onSortChange,
  empty,
  page,
  pageSize,
  totalItems,
  onPageChange,
  itemLabel,
  isFetching,
}) => (
  <div className="space-y-4">
    <FilterTileRow columns={tiles.length === 3 ? 3 : 4}>
      {tiles.map((tile) => (
        <FilterTile
          key={tile.id}
          label={tile.label}
          value={tile.value}
          hint={tile.hint}
          tone={tile.tone}
          selected={selectedTile === tile.id}
          onClick={() => onTileChange(tile.id)}
        />
      ))}
    </FilterTileRow>

    <SearchFilters
      className="mb-0"
      searchLabel={searchLabel}
      searchPlaceholder={searchPlaceholder}
      searchValue={search}
      onSearchChange={onSearchChange}
      filters={filters}
      filterValues={filterValues}
      onFilterChange={onFilterChange}
      onReset={onReset}
    />

    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      getRowId={(app) => String(app.id)}
      renderCard={renderCard}
      sort={sort}
      onSortChange={onSortChange}
      isFetching={isFetching}
      empty={empty}
      footer={
        <Pagination
          variant="inset"
          currentPage={page}
          totalPages={Math.max(1, Math.ceil(totalItems / pageSize))}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          itemLabel={itemLabel}
        />
      }
    />
  </div>
);
