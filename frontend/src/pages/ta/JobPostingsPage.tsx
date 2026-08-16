import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button, Dialog, Input, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { JobStatus } from "../../lib/types/enums";
import {
  Briefcase,
  Plus,
  Sparkles,
  MapPin,
  Users,
} from "lucide-react";

export const JobPostingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRequirements, setFormRequirements] = useState("");

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", { search, filterValues }],
    queryFn: () =>
      taApi.listJobs({
        search: search || undefined,
        status: filterValues.status || undefined,
      }),
  });

  const createJobMutation = useMutation({
    mutationFn: taApi.createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      setCreateModalOpen(false);
      setFormTitle("");
      setFormLocation("");
      setFormDescription("");
      setFormRequirements("");
    },
  });

  const jobs = jobsQuery.data || [];
  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const paginatedJobs = jobs.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (k: string, v: string) => {
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Postings & Requisitions"
        description="Manage active job postings, candidate evaluations, and recruitment allocations"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Job Postings" },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Requisition
          </Button>
        }
      />

      {/* Filter Bar */}
      <SearchFilters
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Requisition Status",
            options: [
              { value: JobStatus.OPEN, label: "OPEN" },
              { value: JobStatus.DRAFT, label: "DRAFT" },
              { value: JobStatus.CLOSED, label: "CLOSED" },
            ],
          },
        ]}
      />

      {/* Jobs Grid / Table */}
      {jobsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : jobsQuery.isError ? (
        <ErrorState error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Briefcase className="w-6 h-6" />}
            title="No job requisitions found"
            description="Create a new job posting to begin receiving candidate applications."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create Requisition
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {job.title}
                      </h3>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{job.location || "Philippines"}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                        job.status === JobStatus.OPEN
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : job.status === JobStatus.DRAFT
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 font-mono pt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job._count?.applications || 0} Applicants</span>
                    </span>
                    <span>•</span>
                    <span>Posted {formatDate(job.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Requisition #{job.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/ta/jobs/$jobId"
                      params={{ jobId: String(job.id) }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-600" />}
                      >
                        Candidate Matches
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="bg-white border border-slate-300 p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={jobs.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Job Requisition"
        description="Publish a new manpower opening for applicant intake"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createJobMutation.mutate({
              title: formTitle,
              location: formLocation || undefined,
              description: formDescription,
              requirements: formRequirements,
              status: JobStatus.OPEN,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Job Requisition Title"
            placeholder="e.g. Senior Electrician / Line Specialist"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />
          <Input
            label="Workplace Location"
            placeholder="e.g. Batangas City Facility"
            value={formLocation}
            onChange={(e) => setFormLocation(e.target.value)}
          />
          <Textarea
            label="Job Description & Responsibilities"
            placeholder="Describe role responsibilities..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
            required
          />
          <Textarea
            label="Qualifications & Criteria"
            placeholder="e.g. TESDA NC II, 2+ years experience..."
            value={formRequirements}
            onChange={(e) => setFormRequirements(e.target.value)}
            rows={3}
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={createJobMutation.isPending}
            >
              Publish Requisition
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
