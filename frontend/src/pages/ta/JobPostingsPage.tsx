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
  JobImage,
  JobContentRenderer,
} from "../../components/common";
import { Button, Dialog, Input, Textarea, ComboBox } from "../../components/ui";
import { formatDate, formatSalaryRange, formatEmploymentType, cn } from "../../lib/utils";
import { JobStatus } from "../../lib/types/enums";
import {
  Briefcase,
  Plus,
  MapPin,
  Users,
  FileSpreadsheet,
  Edit,
  Eye,
  FileText,
} from "lucide-react";

import { notify } from "../../lib/feedback";
import { TA_COPY, formatTaStatus } from "../../lib/ta-copy";

const JOB_TEMPLATE_DESCRIPTION = `### About the Role
We are seeking a dedicated and qualified professional to join our operations team. In this position, you will collaborate with cross-functional team members and client stakeholders to deliver exceptional outcomes and maintain operational standards.

### Key Responsibilities
- Execute day-to-day operational responsibilities ensuring high standards of quality and accuracy
- Collaborate closely with site leads, supervisors, and client representatives to resolve issues promptly
- Prepare and maintain accurate activity logs, status reports, and required documentation
- Follow all safety, compliance, and procedural standards established for the facility

### Work Environment
- Collaborative on-site work environment with modern equipment and safety standards
- Structured onboarding with opportunities for skill building and career progression`;

const JOB_TEMPLATE_REQUIREMENTS = `### Qualifications
- Relevant vocational diploma, technical certification, or bachelor's degree
- 2+ years of relevant practical experience in a similar operational capacity
- Strong track record of reliability, attention to detail, and safety adherence
- Effective communication and problem-solving skills

### Preferred Skills
- Safety compliance, operational reporting, equipment handling, quality inspection`;

const EMPTY_LIST: any[] = [];

export const JobPostingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<"edit" | "preview">("edit");

  const [selectedMrfId, setSelectedMrfId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRequirements, setFormRequirements] = useState("");
  const [formIsEvergreen, setFormIsEvergreen] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients", "dropdown"],
    queryFn: () => taApi.listClients(),
  });

  const clients = clientsQuery.data ?? EMPTY_LIST;

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", { search, filterValues, mineOnly }],
    queryFn: () =>
      taApi.listJobs({
        search: search || undefined,
        status: filterValues.status || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        mineOnly: mineOnly ? true : undefined,
      }),
  });

  const jobs = jobsQuery.data ?? EMPTY_LIST;

  // Dynamically derive client options for current TA scope (deduplicated)
  const availableClients = React.useMemo(() => {
    const seen = new Set<number>();
    if (mineOnly) {
      const list: Array<{ id: number; name: string; industry?: string | null; address?: string | null }> = [];
      jobs.forEach((j: any) => {
        const client = j.mrf?.client;
        if (client && !seen.has(client.id)) {
          seen.add(client.id);
          list.push(client);
        }
      });
      return list;
    }

    const list: typeof clients = [];
    clients.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        list.push(c);
      }
    });
    return list;
  }, [mineOnly, jobs, clients]);

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs"],
    queryFn: () => taApi.listMRFs(),
    enabled: createModalOpen,
  });

  const mrfs = mrfsQuery.data || [];

  const handleSelectMRF = (val: string) => {
    const id = Number(val) || null;
    setSelectedMrfId(id);
    if (id) {
      const chosen = mrfs.find((m) => m.id === id);
      if (chosen) {
        setFormTitle(chosen.title || "");
        setFormLocation(chosen.location || "");
        setFormDescription(chosen.description || "");
        const sections: string[] = [];
        if (chosen.requiredSkills) sections.push(`Required skills:\n${chosen.requiredSkills}`);
        if (chosen.requiredExperience) sections.push(`Required experience:\n${chosen.requiredExperience}`);
        if (chosen.requiredEducation) sections.push(`Minimum education:\n${chosen.requiredEducation}`);
        if (chosen.requiredCertifications) sections.push(`Certifications & licenses:\n${chosen.requiredCertifications}`);
        setFormRequirements(sections.join("\n\n") || chosen.requiredSkills || "");
      }
    }
  };

  const createJobMutation = useMutation({
    mutationFn: async (payload: any) => {
      const created = await taApi.createJob(payload);
      if (selectedMrfId && created?.id) {
        try {
          await taApi.linkJobToMRF(selectedMrfId, created.id);
        } catch {
          // Non-blocking link error
        }
      }
      return created;
    },
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      setCreateModalOpen(false);
      setSelectedMrfId(null);
      setFormTitle("");
      setFormLocation("");
      setFormImageUrl("");
      setFormDescription("");
      setFormRequirements("");
      setFormIsEvergreen(false);
      setCreateModalTab("edit");
      notify.success("Job opening created", `Job opening #${newJob?.id || ""} is ready.`);
    },
    onError: (err: any) => {
      notify.error("Unable to create job opening", err);
    },
  });

  const handleLoadTemplate = () => {
    const hasExisting = Boolean(formDescription.trim() || formRequirements.trim());
    if (
      hasExisting &&
      !window.confirm("Replace current description and requirements with the job template outline?")
    ) {
      return;
    }
    setFormDescription(JOB_TEMPLATE_DESCRIPTION);
    setFormRequirements(JOB_TEMPLATE_REQUIREMENTS);
    notify.info("Template loaded", "Job posting outline inserted into description and requirements.");
  };

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
        title="Job openings"
        description="Create openings, set requirements, and review incoming candidates."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.openings },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setFormIsEvergreen(false);
              setCreateModalTab("edit");
              setCreateModalOpen(true);
            }}
          >
            Create job opening
          </Button>
        }
      />

      {/* Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search job openings by title, location, or client..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Opening status",
            options: [
              { value: JobStatus.OPEN, label: "Open" },
              { value: JobStatus.DRAFT, label: "Draft" },
              { value: JobStatus.CLOSED, label: "Closed" },
            ],
          },
          {
            key: "clientId",
            label: "Client",
            placeholder: mineOnly ? "My clients" : "All clients",
            searchable: true,
            options: availableClients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            })),
          },
        ]}
        actions={
          <div className="flex items-center border border-slate-300 bg-slate-100 p-0.5 rounded text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMineOnly(false);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                !mineOnly
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All openings
            </button>
            <button
              type="button"
              onClick={() => {
                setMineOnly(true);
                setFilterValues((prev) => {
                  const next = { ...prev };
                  delete next.clientId;
                  return next;
                });
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                mineOnly
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My openings
            </button>
          </div>
        }
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
            title="No job openings found"
            description="Create a job opening to begin receiving candidate applications."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setFormIsEvergreen(false);
                  setCreateModalOpen(true);
                }}
              >
                Create job opening
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="md" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {job.title}
                        </h3>
                        <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-2 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{job.location || "Philippines"}</span>
                          </span>
                          {job.mrf?.client?.name && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">{job.mrf.client.name}</span>
                            </>
                          )}
                          {job.mrf?.salaryRangeMin || job.mrf?.salaryRangeMax ? (
                            <span className="font-medium text-[#047857] bg-[#ECFDF5] px-2 py-0.5 rounded text-[11px] border border-[#A7F3D0]">
                              {formatSalaryRange(job.mrf.salaryRangeMin, job.mrf.salaryRangeMax)}
                            </span>
                          ) : null}
                          {job.mrf?.employmentType && (
                            <span className="text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                              {formatEmploymentType(job.mrf.employmentType)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.isEvergreen && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-teal-50 text-teal-700 border border-teal-200">
                          Always open
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                          job.status === JobStatus.OPEN
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : job.status === JobStatus.DRAFT
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatTaStatus(job.status)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-1">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job._count?.applications || 0} applicants</span>
                      </span>
                      <span>•</span>
                      <span>Posted {formatDate(job.createdAt)}</span>
                    </div>

                    {job.status === JobStatus.OPEN && (
                      <Link
                        to="/ta/jobs/$jobId"
                        params={{ jobId: String(job.id) }}
                        search={{ tab: "talentPool" }}
                        className="inline-flex items-center gap-1 text-[11px] text-teal-700 font-semibold hover:underline"
                      >
                        <Users className="w-3 h-3 text-teal-600" />
                        <span>Pool Matches</span>
                      </Link>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Job opening #{job.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/ta/jobs/$jobId"
                      params={{ jobId: String(job.id) }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Briefcase className="w-3.5 h-3.5 text-teal-600" />}
                      >
                        View opening
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
              itemLabel="job openings"
            />
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create job opening"
        description="Publish an opening so applicants can apply."
        size="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createJobMutation.mutate({
              title: formTitle,
              location: formLocation || undefined,
              imageUrl: formImageUrl || undefined,
              description: formDescription,
              requirements: formRequirements,
              mrfId: selectedMrfId || undefined,
              isEvergreen: formIsEvergreen,
              status: JobStatus.OPEN,
            });
          }}
          className="space-y-4"
        >
          {/* Top Bar with View Tabs and Load Template */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
            <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setCreateModalTab("edit")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                  createModalTab === "edit"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateModalTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                  createModalTab === "preview"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5 text-teal-600" />}
              onClick={handleLoadTemplate}
              title="Insert standard job posting structure"
            >
              Load Template
            </Button>
          </div>

          {createModalTab === "edit" ? (
            <div className="space-y-4">
              {/* Optional MRF Auto-Population Selector */}
              <ComboBox
                label="Link to a manpower request (optional)"
                placeholder="Search requests to fill this opening automatically..."
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />}
                value={selectedMrfId ? String(selectedMrfId) : ""}
                onChange={handleSelectMRF}
                options={mrfs.map((m) => ({
                  value: String(m.id),
                  label: `${m.title} (Request #${m.id})`,
                  subtitle: `Client: ${m.client?.name || "Client"} • ${m.location || "Nationwide"} • ${m.headcount} positions`,
                  badge: m.status,
                }))}
                helperText="Selecting a request fills the title, location, description, and skills."
                emptyText="No open manpower requests found"
              />

              <Input
                label="Job opening title"
                placeholder="e.g. Senior Electrician / Line Specialist"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Work site"
                  placeholder="e.g. Batangas City Facility"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                />
                <Input
                  label="Image web address (optional)"
                  placeholder="https://example.com/company-banner.jpg"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                />
              </div>


              <Textarea
                label="Description and responsibilities"
                placeholder="Describe role responsibilities..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
                required
              />
              <Textarea
                label="Required skills and qualifications"
                placeholder="e.g. TESDA NC II, 2+ years experience..."
                value={formRequirements}
                onChange={(e) => setFormRequirements(e.target.value)}
                rows={4}
                required
              />

              {/* Keep Open After Fill Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    checked={formIsEvergreen}
                    onChange={(e) => setFormIsEvergreen(e.target.checked)}
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Keep open after positions are filled</span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Leave this opening open for future applicants.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            /* Live Preview Mode */
            <div className="space-y-4">
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
                  <JobImage src={formImageUrl} title={formTitle || "Job Title"} alt={formTitle || "Job Title"} size="md" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">{formTitle || "Untitled Job Opening"}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formLocation || "Philippines"}</span>
                      </span>
                      <span>•</span>
                      <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
                        Open
                      </span>
                      {formIsEvergreen && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                          Always open
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-7 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Role Description & Responsibilities
                    </h4>
                    <div className="p-4 bg-white rounded-lg border border-slate-200 min-h-[160px]">
                      {formDescription ? (
                        <JobContentRenderer content={formDescription} variant="ta" />
                      ) : (
                        <p className="text-xs text-slate-400 italic">No description entered yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-5 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Required Skills & Qualifications
                    </h4>
                    <div className="p-4 bg-white rounded-lg border border-slate-200 min-h-[160px]">
                      {formRequirements ? (
                        <JobContentRenderer content={formRequirements} variant="ta" />
                      ) : (
                        <p className="text-xs text-slate-400 italic">No requirements entered yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              Publish job opening
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
