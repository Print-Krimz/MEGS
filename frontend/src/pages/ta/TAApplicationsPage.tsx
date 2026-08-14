import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { ApplicationFilters } from './components/ApplicationFilters';
import { ApplicationTable } from './components/ApplicationTable';
import { taApi } from '../../lib/api/ta';
import { ApplicationStatus } from '../../lib/types/enums';
import type { ApplicationListItem } from '../../lib/types/api';

const ITEMS_PER_PAGE = 10;

export default function TAApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL search params
  const statusParam = searchParams.get('status') || 'ALL';
  const searchParam = searchParams.get('search') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Query all applications from backend
  const {
    data: applicationsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ta', 'applications', statusParam, searchParam],
    queryFn: () =>
      taApi.listApplications({
        status: statusParam !== 'ALL' ? (statusParam as ApplicationStatus) : undefined,
        search: searchParam || undefined,
      }),
  });

  const applications: ApplicationListItem[] = applicationsRes?.data || [];

  // Client-side filtering & search matching for instant responsive UX
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Status filter matching
      const matchesStatus =
        statusParam === 'ALL' || !statusParam || app.status === statusParam;

      // Text search matching across candidate name, email, job title, and location
      const query = searchParam.trim().toLowerCase();
      if (!query) return matchesStatus;

      const profile = app.user.applicantProfile;
      const candidateName = profile
        ? `${profile.firstName} ${profile.lastName}`.toLowerCase()
        : '';
      const email = app.user.email.toLowerCase();
      const jobTitle = app.jobPosting.title.toLowerCase();
      const location = app.jobPosting.location?.toLowerCase() || '';

      const matchesSearch =
        candidateName.includes(query) ||
        email.includes(query) ||
        jobTitle.includes(query) ||
        location.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [applications, statusParam, searchParam]);

  // Pagination calculation
  const totalItems = filteredApplications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedApplications = filteredApplications.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // URL state update helpers
  const handleStatusChange = (newStatus: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (newStatus === 'ALL') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', newStatus);
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handleSearchChange = (newSearch: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!newSearch.trim()) {
      nextParams.delete('search');
    } else {
      nextParams.set('search', newSearch.trim());
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(newPage));
    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    setSearchParams({});
  };

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Application Pipeline"
          description="Filter, review, and advance candidate applications across all hiring stages."
          breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Applications' }]}
        />
        <ErrorState
          title="Failed to load applications"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="ta-applications-page">
      <PageHeader
        title="Application Pipeline"
        description="Operational candidate management, stage transitions, interview coordination, and pre-employment tracking."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Applications' }]}
      />

      {/* Filter and Search Bar */}
      <ApplicationFilters
        selectedStatus={statusParam}
        searchQuery={searchParam}
        onStatusChange={handleStatusChange}
        onSearchChange={handleSearchChange}
        onReset={handleResetFilters}
      />

      {/* Pipeline Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-teal-700" />
            <span>
              Showing{' '}
              <strong className="font-mono text-foreground font-bold">
                {totalItems === 0 ? 0 : startIndex + 1} -{' '}
                {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
              </strong>{' '}
              of <strong className="font-mono text-foreground font-bold">{totalItems}</strong> candidate
              applications
            </span>
          </div>

          {statusParam !== 'ALL' && (
            <span className="font-mono font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Filter: {statusParam}
            </span>
          )}
        </div>

        <ApplicationTable
          applications={paginatedApplications}
          isLoading={isLoading}
          emptyTitle="No matching applications found"
          emptyDescription="Try adjusting your status tab, clearing search filters, or checking back once new candidates apply."
        />

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3" data-testid="applications-pagination">
            <div className="text-xs text-muted-foreground">
              Page <span className="font-mono font-bold text-foreground">{safePage}</span> of{' '}
              <span className="font-mono font-bold text-foreground">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage <= 1}
                data-testid="pagination-prev"
                className="h-9 px-3.5 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition duration-150 inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  // Show current, first, last, or adjacent pages
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= safePage - 1 && pageNum <= safePage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        className={`h-9 min-w-9 px-2 rounded-lg text-sm font-medium font-mono transition duration-150 cursor-pointer flex items-center justify-center ${
                          safePage === pageNum
                            ? 'bg-teal-700 text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (pageNum === safePage - 2 || pageNum === safePage + 2) {
                    return (
                      <span key={pageNum} className="h-9 min-w-9 flex items-center justify-center text-xs text-slate-400 px-0.5 font-mono">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                data-testid="pagination-next"
                className="h-9 px-3.5 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition duration-150 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { TAApplicationsPage as ApplicationsPage };
