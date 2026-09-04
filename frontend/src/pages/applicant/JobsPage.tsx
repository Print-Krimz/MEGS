import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button } from "../../components/ui";
import { Briefcase, Bookmark, Sparkles } from "lucide-react";
import { notify } from "../../lib/feedback";
import { JobCard } from "../../components/applicant/JobCard";
import { GuestApplyModal } from "../../components/applicant/GuestApplyModal";
import { AuthContext } from "../../context/AuthContext";

export const JobsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = React.useContext(AuthContext);
  const isAuthenticated = Boolean(auth?.isAuthenticated);

  const [scope, setScope] = useState<"all" | "saved">("all");
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Guest apply intercept modal state
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<{ id: number; title: string } | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["applicant", "jobs", searchValue, filterValues],
    queryFn: () =>
      applicantJobsApi.getJobs({
        search: searchValue || undefined,
        location: filterValues.location || undefined,
      }),
  });

  const savedJobIdsQuery = useQuery({
    queryKey: ["applicant", "saved-jobs", "ids"],
    queryFn: applicantJobsApi.getSavedJobIds,
    enabled: isAuthenticated,
  });

  const savedJobIds = new Set(savedJobIdsQuery.data || []);

  const saveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.saveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Saved", "Position added to your saved jobs.");
    },
    onError: (err: any) => notify.error("Action Failed", err),
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.unsaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Removed", "Position removed from your saved jobs.");
    },
    onError: (err: any) => notify.error("Action Failed", err),
  });

  const rawJobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : [];

  const toggleBookmark = (jobId: number) => {
    if (!isAuthenticated) {
      const job = rawJobs.find((j) => j.id === jobId);
      setTargetJob({ id: jobId, title: job?.title || "Job opening" });
      setGuestModalOpen(true);
      return;
    }

    if (savedJobIds.has(jobId)) {
      unsaveMutation.mutate(jobId);
    } else {
      saveMutation.mutate(jobId);
    }
  };

  const handleApplyClick = (jobId: number) => {
    if (!isAuthenticated) {
      const job = rawJobs.find((j) => j.id === jobId);
      setTargetJob({ id: jobId, title: job?.title || "Job opening" });
      setGuestModalOpen(true);
      return;
    }
    navigate({ to: `/app/jobs/${jobId}` });
  };

  const displayedJobs = scope === "saved"
    ? rawJobs.filter((job) => savedJobIds.has(job.id))
    : rawJobs;

  const totalPages = Math.max(1, Math.ceil(displayedJobs.length / pageSize));
  const paginatedJobs = displayedJobs.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    setPage(1);
  };

  const handleFilterChange = (key: string, val: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handleReset = () => {
    setSearchValue("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "all" ? "Explore Opportunities" : "Saved Jobs"}
        description={
          scope === "all"
            ? "Discover verified job openings across leading Philippine employers."
            : "Review bookmarked job openings and continue your applications."
        }
        breadcrumbs={[
          { label: "My career", href: isAuthenticated ? "/app" : "/" },
          { label: scope === "all" ? "Explore jobs" : "Saved Jobs" },
        ]}
        actions={
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                scope === "all"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span>All Openings ({rawJobs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  setGuestModalOpen(true);
                  return;
                }
                setScope("saved");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                scope === "saved"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Saved Jobs ({savedJobIds.size})</span>
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <SearchFilters
          searchLabel="Search jobs"
          searchPlaceholder="Search by job title, skill, or keyword (e.g. Backend, React, Electrician)..."
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onReset={handleReset}
          className="border-0 p-0 mb-0 bg-transparent"
          filters={[
            {
              key: "location",
              label: "Location",
              options: [
                { value: "Valenzuela", label: "Valenzuela (Central HQ)" },
                { value: "Quezon City", label: "Quezon City" },
                { value: "Laguna", label: "Laguna" },
                { value: "Batangas", label: "Batangas" },
                { value: "Cavite", label: "Cavite" },
                { value: "Cebu", label: "Cebu" },
                { value: "Davao", label: "Davao" },
                { value: "Metro Manila", label: "Metro Manila" },
              ],
            },
          ]}
        />
      </div>

      {/* Content */}
      {jobsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : jobsQuery.isError ? (
        <ErrorState error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
      ) : displayedJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-xs">
          {scope === "saved" ? (
            <EmptyState
              icon={<Bookmark className="w-8 h-8 text-blue-600" />}
              title="No saved jobs yet"
              description="Bookmark job openings while exploring careers so you can review and apply when ready."
              action={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setScope("all")}
                >
                  Explore all openings
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Briefcase className="w-8 h-8 text-slate-400" />}
              title="No matching jobs found"
              description="Try clearing search filters or check back later as new positions are posted daily."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  Reset Filters
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Showing {paginatedJobs.length} of {displayedJobs.length} {displayedJobs.length === 1 ? "position" : "positions"}</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Verified Employers</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedJobs.map((job) => (
              <JobCard
                key={job.id}
                id={job.id}
                title={job.title}
                company={(job as any).client?.name || (job as any).company || "MAR Employment (MEGS)"}
                location={job.location || "Philippines"}
                workSetup={(job as any).workSetup || "ON_SITE"}
                salaryRange={(job as any).salaryRange}
                employmentType={(job as any).employmentType || "Full-time"}
                description={job.description}
                requirements={job.requirements}
                skills={(job as any).skills}
                createdAt={job.createdAt}
                status={(job as any).status}
                isSaved={savedJobIds.has(job.id)}
                onToggleSave={() => toggleBookmark(job.id)}
                onApply={() => handleApplyClick(job.id)}
                detailUrl={isAuthenticated ? `/app/jobs/${job.id}` : `/jobs/${job.id}`}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* Guest Apply Intercept Modal */}
      <GuestApplyModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        jobId={targetJob?.id}
        jobTitle={targetJob?.title}
      />
    </div>
  );
};
