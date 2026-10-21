import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  JobContentRenderer,
  JobImage,
  DataTable,
  ConfirmDialog,
  StatusBadge,
} from "../../components/common";
import type { DataTableColumn } from "../../components/common";
import { Button, Dialog, Input, Textarea, ComboBox } from "../../components/ui";
import { FieldWarning } from "../../components/ta/FieldWarning";
import { LOCATION_HINT, LOCATION_UNCLEAR_WARNING, locationLooksUnclear } from "../../lib/requirement-hints";
import { formatDate, cn } from "../../lib/utils";
import { JobStatus } from "../../lib/types/enums";
import { Plus } from "lucide-react";

import { notify, fieldErrorsFrom } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import {
  validateStandardText,
  validateProseText,
} from "../../lib/statutory-validation";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useDirtyGuard } from "../../hooks/useDirtyGuard";
import { buildJobDescriptionDraft } from "../../lib/job-description-draft";
import {
  normalizeServerSearch,
  REFERENCE_QUERY_STALE_TIME_MS,
  SERVER_SEARCH_DEBOUNCE_MS,
} from "../../lib/query-policies";

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

// Backend fields that have an inline input on this form. Any other field's message goes in the toast.
const JOB_INLINE_FIELDS = ["title", "location", "imageUrl", "description", "requirements", "mrfId"];

type JobRow = any;

export const JobPostingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const urlSearch = useSearch({ strict: false }) as { mrfId?: number | string };
  const prefillMrfId = Number(urlSearch?.mrfId) || null;
  const prefilledFromUrl = useRef<number | null>(null);

  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<"edit" | "preview">("edit");
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);

  const [selectedMrfId, setSelectedMrfId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRequirements, setFormRequirements] = useState("");
  const [formIsEvergreen, setFormIsEvergreen] = useState(false);
  // What the selected request filled in, so only edits on top of it count as unsaved work.
  const [baseline, setBaseline] = useState({ title: "", location: "", requirements: "", description: "" });
  const [justSavedJobId, setJustSavedJobId] = useState<number | null>(null);

  const isFormDirty =
    createModalOpen &&
    justSavedJobId === null &&
    (formTitle !== baseline.title ||
      formLocation !== baseline.location ||
      formRequirements !== baseline.requirements ||
      formImageUrl.trim() !== "" ||
      formDescription.trim() !== baseline.description.trim() ||
      formIsEvergreen);
  const { confirmDiscard, discardDialog } = useDirtyGuard({
    isDirty: isFormDirty,
    message: "You have unsaved changes in this job opening.",
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: () => taApi.listClients(),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const clients = clientsQuery.data ?? EMPTY_LIST;

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", {
      search: debouncedSearch,
      status: filterValues.status || "",
      clientId: filterValues.clientId || "",
      page,
      pageSize,
    }],
    queryFn: ({ signal }) =>
      taApi.listJobsPage({
        search: debouncedSearch || undefined,
        status: filterValues.status || undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        page,
        limit: pageSize,
      }, { signal }),
    placeholderData: keepPreviousData,
  });

  const jobData = jobsQuery.data;
  const jobs = jobData?.items ?? EMPTY_LIST;

  // Dynamically derive client options for current TA scope (deduplicated)
  const availableClients = React.useMemo(() => {
    const seen = new Set<number>();
    const list: typeof clients = [];
    clients.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        list.push(c);
      }
    });
    return list;
  }, [clients]);

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs", "link-picker"],
    queryFn: () => taApi.listMRFs({ sortBy: "created_desc" }),
    enabled: createModalOpen,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const mrfs = mrfsQuery.data || [];

  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) =>
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleSelectMRF = (val: string) => {
    const id = Number(val) || null;
    setSelectedMrfId(id);
    if (id) {
      const chosen = mrfs.find((m) => m.id === id);
      if (chosen) {
        const sections: string[] = [];
        if (chosen.requiredSkills) sections.push(`Required skills:\n${chosen.requiredSkills}`);
        if (chosen.requiredExperience) sections.push(`Required experience:\n${chosen.requiredExperience}`);
        if (chosen.requiredEducation) sections.push(`Minimum education:\n${chosen.requiredEducation}`);
        if (chosen.requiredCertifications) sections.push(`Certifications & licenses:\n${chosen.requiredCertifications}`);
        const next = {
          title: chosen.title || "",
          location: chosen.location || "",
          requirements: sections.join("\n\n") || chosen.requiredSkills || "",
          // Role facts only. The request's client notes are internal and are never copied here.
          description: buildJobDescriptionDraft(chosen),
        };
        setFormTitle(next.title);
        setFormLocation(next.location);
        setFormRequirements(next.requirements);
        setFormDescription(next.description);
        setBaseline(next);
        clearServerFieldError("description");
      }
    }
  };

  const resetForm = () => {
    setSelectedMrfId(null);
    setFormTitle("");
    setFormLocation("");
    setFormImageUrl("");
    setFormDescription("");
    setFormRequirements("");
    setFormIsEvergreen(false);
    setBaseline({ title: "", location: "", requirements: "", description: "" });
    setCreateModalTab("edit");
    setServerFieldErrors({});
  };

  const openCreateDialog = () => {
    setJustSavedJobId(null);
    setFormIsEvergreen(false);
    setCreateModalTab("edit");
    setCreateModalOpen(true);
  };

  const closeCreateDialog = async () => {
    if (!(await confirmDiscard())) return;
    setCreateModalOpen(false);
    resetForm();
  };

  // Deep link from a manpower request: /ta/jobs?mrfId=12 opens the dialog with that request filled in.
  useEffect(() => {
    if (!prefillMrfId) {
      prefilledFromUrl.current = null;
      return;
    }
    if (prefilledFromUrl.current === prefillMrfId) return;
    if (!createModalOpen) {
      openCreateDialog();
      return;
    }
    if (!mrfsQuery.data) return;
    prefilledFromUrl.current = prefillMrfId;
    if (mrfsQuery.data.some((m) => m.id === prefillMrfId)) handleSelectMRF(String(prefillMrfId));
    navigate({ to: "/ta/jobs", search: {} as never, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillMrfId, createModalOpen, mrfsQuery.data]);

  // After a save the form is clean, so the router no longer blocks the jump to the new opening.
  useEffect(() => {
    if (justSavedJobId === null) return;
    navigate({ to: "/ta/jobs/$jobId", params: { jobId: String(justSavedJobId) } });
  }, [justSavedJobId, navigate]);

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
    onSuccess: (newJob, payload) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      setCreateModalOpen(false);
      resetForm();
      notify.success(
        payload?.status === JobStatus.DRAFT ? "Draft saved" : "Job opening published",
        payload?.status === JobStatus.DRAFT ? "Publish it from the opening when it is ready." : undefined
      );
      if (newJob?.id) setJustSavedJobId(newJob.id);
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const entries = Object.entries(fieldErrors);
      if (entries.length > 0) {
        setServerFieldErrors(fieldErrors);
        const toastEntry = entries.find(([field]) => !JOB_INLINE_FIELDS.includes(field)) ?? entries[0];
        notify.error("Check the highlighted fields", toastEntry[1]);
        return;
      }
      notify.error("Unable to create job opening", err);
    },
  });

  const submitJob = (status: JobStatus) => {
    const errors: Record<string, string> = {};
    if (!selectedMrfId) errors.mrfId = "Choose the manpower request this opening is posted under.";
    if (!formTitle.trim()) errors.title = "Enter a job opening title.";
    else {
      const titleErr = validateStandardText(formTitle, "Job opening title", { maxLength: 200 });
      if (titleErr) errors.title = titleErr;
    }
    if (formLocation.trim()) {
      const locErr = validateStandardText(formLocation, "Work site", { maxLength: 200 });
      if (locErr) errors.location = locErr;
    }
    if (!formDescription.trim()) errors.description = "Describe the role and its responsibilities.";
    else if (status !== JobStatus.DRAFT && baseline.description && formDescription.trim() === baseline.description.trim()) {
      errors.description = "Add the responsibilities for this role. The text so far only lists the request's details.";
    } else {
      const descErr = validateProseText(formDescription, "Description and responsibilities", { maxLength: 10000 });
      if (descErr) errors.description = descErr;
    }
    if (!formRequirements.trim()) errors.requirements = "List the required skills and qualifications.";
    else {
      const reqErr = validateProseText(formRequirements, "Required skills and qualifications", { maxLength: 10000 });
      if (reqErr) errors.requirements = reqErr;
    }
    if (Object.keys(errors).length > 0) {
      setServerFieldErrors(errors);
      setCreateModalTab("edit");
      notify.error("Check the highlighted fields", Object.values(errors)[0]);
      return;
    }

    createJobMutation.mutate({
      title: formTitle.trim(),
      location: formLocation.trim() || undefined,
      imageUrl: formImageUrl.trim() || undefined,
      description: formDescription.trim(),
      requirements: formRequirements.trim(),
      mrfId: selectedMrfId || undefined,
      isEvergreen: formIsEvergreen,
      status,
    });
  };

  const applyTemplate = () => {
    setFormDescription(JOB_TEMPLATE_DESCRIPTION);
    setFormRequirements(JOB_TEMPLATE_REQUIREMENTS);
    clearServerFieldError("description");
    clearServerFieldError("requirements");
    notify.info("Template loaded", "Job posting outline inserted into description and requirements.");
  };

  const handleLoadTemplate = () => {
    if (formDescription.trim() || formRequirements.trim()) {
      setTemplateConfirmOpen(true);
      return;
    }
    applyTemplate();
  };

  const totalItems = jobData?.total ?? 0;
  const totalPages = jobData?.totalPages ?? 1;

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

  const hasFilters = Boolean(debouncedSearch || filterValues.status || filterValues.clientId);

  const poolLink = (job: JobRow, className?: string) =>
    job.status === JobStatus.OPEN ? (
      <Link
        to="/ta/jobs/$jobId"
        params={{ jobId: String(job.id) }}
        search={{ tab: "talentPool" }}
        className={cn(
          "inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline focus-ring md:min-h-0",
          className
        )}
      >
        View matches
      </Link>
    ) : (
      <span className="text-slate-600">None</span>
    );

  const columns: DataTableColumn<JobRow>[] = [
    {
      key: "title",
      header: "Job opening",
      primary: true,
      cell: (job) => job.title,
    },
    {
      key: "client",
      header: "Client",
      cell: (job) => job.mrf?.client?.name || "Not linked",
    },
    {
      key: "site",
      header: "Work site",
      hideBelow: "lg",
      cell: (job) => job.location || "Philippines",
    },
    {
      key: "status",
      header: "Status",
      cell: (job) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <StatusBadge status={job.status} type="raw" size="sm" />
          {job.isEvergreen && <span className="text-xs text-slate-600">Always open</span>}
        </span>
      ),
    },
    {
      key: "applicants",
      header: "Applicants",
      align: "right",
      cell: (job) => job._count?.applications || 0,
    },
    {
      key: "pool",
      header: "Pool matches",
      cell: (job) => poolLink(job),
    },
    {
      key: "posted",
      header: "Posted",
      cell: (job) => formatDate(job.createdAt),
    },
  ];

  const renderCard = (job: JobRow) => (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/ta/jobs/$jobId"
          params={{ jobId: String(job.id) }}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline-offset-2 hover:underline focus-ring"
        >
          {job.title}
        </Link>
        <StatusBadge status={job.status} type="raw" size="sm" />
      </div>
      <p className="text-sm text-slate-600">
        {[job.mrf?.client?.name, job.location || "Philippines"].filter(Boolean).join(" · ")}
        {job.isEvergreen ? " · Always open" : ""}
      </p>
      <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
        <span>
          {plural(job._count?.applications || 0, "applicant")} · Posted {formatDate(job.createdAt)}
        </span>
        {poolLink(job)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title="Job openings"
        breadcrumbs={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
          { label: TA_COPY.navigation.openings },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={openCreateDialog}
          >
            Create job opening
          </Button>
        }
      />

      {/* Filter Bar */}
      <SearchFilters
        className="!mb-0"
        searchLabel="Search job openings"
        searchPlaceholder="Search by title, site, or client"
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
            placeholder: "All clients",
            searchable: true,
            options: availableClients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            })),
          },
        ]}
      />

      {jobsQuery.isLoading ? (
        <LoadingState variant="table" />
      ) : jobsQuery.isError ? (
        <ErrorState subject="job openings" error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
      ) : (
        <DataTable
          density="compact"
          caption="Job openings"
          columns={columns}
          rows={jobs}
          getRowId={(job) => String(job.id)}
          renderCard={renderCard}
          cardsBelow="lg"
          rowHref={(job) => `/ta/jobs/${job.id}`}
          isFetching={jobsQuery.isFetching}
          empty={
            hasFilters ? (
              <EmptyState
                bare
                title="No job openings match these filters"
                description="Try a different search or clear the filters."
                action={
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                bare
                title="No job openings yet"
                description="Create a job opening to start receiving candidate applications."
                action={
                  <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateDialog}>
                    Create job opening
                  </Button>
                }
              />
            )
          }
          footer={
            <Pagination
              variant="inset"
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onPageChange={setPage}
              itemLabel="job openings"
            />
          }
        />
      )}

      {/* Create Job Modal */}
      <Dialog
        open={createModalOpen}
        onClose={closeCreateDialog}
        title="Create job opening"
        description="Publish an opening so applicants can apply, or save it as a draft."
        size="xl"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitJob(JobStatus.OPEN);
          }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
            <div className="inline-flex gap-1 bg-slate-100 p-1 text-sm font-medium text-slate-700" role="group" aria-label="Form view">
              {(
                [
                  ["edit", "Edit details"],
                  ["preview", "Preview"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={createModalTab === id}
                  onClick={() => setCreateModalTab(id)}
                  className={cn(
                    "min-h-11 px-3 py-1.5 transition-colors focus-ring md:min-h-9",
                    createModalTab === id
                      ? "bg-white font-semibold text-navy shadow-xs"
                      : "text-slate-700 hover:text-slate-950"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={handleLoadTemplate}>
              Load template
            </Button>
          </div>

          {createModalTab === "edit" ? (
            <div className="space-y-4">
              <ComboBox
                label="Manpower request"
                placeholder="Search requests"
                value={selectedMrfId ? String(selectedMrfId) : ""}
                error={serverFieldErrors.mrfId}
                onChange={(val) => {
                  clearServerFieldError("mrfId");
                  handleSelectMRF(val);
                }}
                options={mrfs.map((m) => ({
                  value: String(m.id),
                  label: `${m.title} (Request #${m.id})`,
                  subtitle: `Client: ${m.client?.name || "Client"} • ${m.location || "Nationwide"} • ${plural(m.headcount, "position")}`,
                  badge: formatStatusWord(m.status),
                }))}
                helperText="The opening is posted under this request. Choosing one fills the title, work site, skills, and the start of the description."
                required
                emptyText="No open manpower requests found"
              />

              <Input
                label="Job opening title"
                placeholder="e.g. Senior Electrician / Line Specialist"
                value={formTitle}
                error={serverFieldErrors.title}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  clearServerFieldError("title");
                }}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Input
                    label="Work site"
                    placeholder="e.g. Batangas City, Batangas"
                    helperText={LOCATION_HINT}
                    value={formLocation}
                    error={serverFieldErrors.location}
                    onChange={(e) => {
                      setFormLocation(e.target.value);
                      clearServerFieldError("location");
                    }}
                  />
                  <FieldWarning show={locationLooksUnclear(formLocation)}>{LOCATION_UNCLEAR_WARNING}</FieldWarning>
                </div>
                <Input
                  label="Image web address (optional)"
                  placeholder="https://example.com/company-banner.jpg"
                  value={formImageUrl}
                  error={serverFieldErrors.imageUrl}
                  onChange={(e) => {
                    setFormImageUrl(e.target.value);
                    clearServerFieldError("imageUrl");
                  }}
                />
              </div>

              <Textarea
                label="Description and responsibilities"
                placeholder="Describe role responsibilities..."
                value={formDescription}
                error={serverFieldErrors.description}
                onChange={(e) => {
                  setFormDescription(e.target.value);
                  clearServerFieldError("description");
                }}
                rows={4}
                maxLength={10000}
                helperText={
                  baseline.description && formDescription.trim() === baseline.description.trim()
                    ? "Drafted from the request's details. Add the day-to-day responsibilities before you publish."
                    : undefined
                }
                required
              />
              <Textarea
                label="Required skills and qualifications"
                placeholder="e.g. TESDA NC II, 2+ years experience..."
                value={formRequirements}
                error={serverFieldErrors.requirements}
                onChange={(e) => {
                  setFormRequirements(e.target.value);
                  clearServerFieldError("requirements");
                }}
                rows={4}
                maxLength={10000}
                required
              />

              <div className="pt-2 border-t border-slate-100">
                <label className="flex min-h-11 items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy focus-ring"
                    checked={formIsEvergreen}
                    onChange={(e) => setFormIsEvergreen(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Keep open after positions are filled</span>
                    <span className="block text-xs text-slate-600 leading-tight">
                      Leave this opening open for future applicants.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
                  <JobImage src={formImageUrl} title={formTitle || "Job opening"} alt={formTitle || "Job opening"} size="md" />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">{formTitle || "Untitled job opening"}</h3>
                    <p className="text-sm text-slate-600">
                      {formLocation || "Philippines"}
                      {formIsEvergreen ? " · Always open" : ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-7 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-800">Description and responsibilities</h4>
                    <div className="p-4 bg-white border border-slate-200 rounded-md min-h-[160px]">
                      {formDescription ? (
                        <JobContentRenderer content={formDescription} variant="ta" />
                      ) : (
                        <p className="text-sm text-slate-600 italic">No description entered yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-5 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-800">Required skills and qualifications</h4>
                    <div className="p-4 bg-white border border-slate-200 rounded-md min-h-[160px]">
                      {formRequirements ? (
                        <JobContentRenderer content={formRequirements} variant="ta" />
                      ) : (
                        <p className="text-sm text-slate-600 italic">No requirements entered yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={closeCreateDialog}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={createJobMutation.isPending}
              onClick={() => submitJob(JobStatus.DRAFT)}
            >
              Save as draft
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createJobMutation.isPending}>
              Publish job opening
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={templateConfirmOpen}
        onClose={() => setTemplateConfirmOpen(false)}
        onConfirm={() => {
          setTemplateConfirmOpen(false);
          applyTemplate();
        }}
        title="Replace your text with the template?"
        description="The description and requirements you typed will be replaced by the standard job posting outline."
        confirmLabel="Replace with template"
        variant="warning"
      />

      {discardDialog}
    </div>
  );
};

function formatStatusWord(status?: string | null): string | undefined {
  if (!status) return undefined;
  const text = status.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
