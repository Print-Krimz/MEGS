import { useState, useEffect } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { ApplicationStatus } from '../../../lib/types/enums';

export interface FilterTabItem {
  id: string;
  label: string;
  statusValue?: ApplicationStatus;
}

export const STATUS_FILTER_TABS: FilterTabItem[] = [
  { id: 'ALL', label: 'All Applications' },
  { id: 'REVIEW', label: 'Review', statusValue: ApplicationStatus.REVIEW },
  { id: 'INITIAL_SCREENING', label: 'Screening', statusValue: ApplicationStatus.INITIAL_SCREENING },
  { id: 'CLIENT_ENDORSEMENT', label: 'Endorsement', statusValue: ApplicationStatus.CLIENT_ENDORSEMENT },
  { id: 'FINAL_INTERVIEW', label: 'Final Interview', statusValue: ApplicationStatus.FINAL_INTERVIEW },
  { id: 'HIRED', label: 'Hired', statusValue: ApplicationStatus.HIRED },
  { id: 'COMPLIANCE', label: 'Compliance', statusValue: ApplicationStatus.COMPLIANCE },
  { id: 'DEPLOYED', label: 'Deployed', statusValue: ApplicationStatus.DEPLOYED },
  { id: 'TALENT_POOL', label: 'Talent Pool', statusValue: ApplicationStatus.TALENT_POOL },
  { id: 'ARCHIVED', label: 'Archived', statusValue: ApplicationStatus.ARCHIVED },
];

interface ApplicationFiltersProps {
  selectedStatus?: string;
  searchQuery: string;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onReset: () => void;
}

export function ApplicationFilters({
  selectedStatus = 'ALL',
  searchQuery,
  onStatusChange,
  onSearchChange,
  onReset,
}: ApplicationFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchChange]);

  const hasActiveFilters = selectedStatus !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-3" data-testid="application-filters">
      {/* Search and Reset Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search candidate, job title, email..."
            data-testid="application-search-input"
            className="w-full h-10 px-3.5 pl-10 pr-9 text-sm bg-background border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-muted-foreground/60 transition-colors"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            data-testid="reset-filters-btn"
            className="h-9 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border border-border bg-slate-50 hover:bg-slate-100 transition duration-150 self-end sm:self-auto cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Status Tabs Scrollable Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {STATUS_FILTER_TABS.map((tab) => {
          const isSelected =
            selectedStatus === tab.id ||
            (!selectedStatus && tab.id === 'ALL') ||
            (tab.statusValue && selectedStatus === tab.statusValue);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusChange(tab.statusValue || tab.id)}
              data-testid={`filter-tab-${tab.id.toLowerCase()}`}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition duration-150 cursor-pointer inline-flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-teal-700 text-white shadow-xs font-semibold'
                  : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
