import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  SearchFilters,
  Pagination,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Textarea } from "../../components/ui";
import { formatDate, getApplicationStatusMeta } from "../../lib/utils";
import {
  ApplicationStatus,
  PIPELINE_FILTER_STAGES,
} from "../../lib/types/enums";
import {
  Users,
  Eye,
  Archive,
  RotateCcw,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import type { TAApplicationSearch } from "../../routes";
import { TA_COPY } from "../../lib/ta-copy";

const EMPTY_LIST: any[] = [];

const readApplicationSearch = (): TAApplicationSearch => {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const stage = params.get("stage");
  const number = (value: string | null) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  };
  return {
    q: params.get("q") || undefined,
    stage: stage && PIPELINE_FILTER_STAGES.includes(stage as ApplicationStatus) ? stage as ApplicationStatus : undefined,
    clientId: number(params.get("clientId")),
    jobId: number(params.get("jobId")),
    mine: params.get("mine") === "true" || params.get("mine") === "1" ? true : undefined,
    archived: params.get("archived") === "true" || params.get("archived") === "1" ? true : undefined,
    page: number(params.get("page")),
  };
};

export const ApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Re-read on router renders so browser back/forward and in-place search
  // navigation restore the visible filters instead of keeping a stale snapshot.
  const routeSearch = readApplicationSearch();

  const [page, setPage] = useState(routeSearch.page || 1);
  const pageSize = 10;
  const [search, setSearch] = useState(routeSearch.q || "");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => ({
    ...(routeSearch.stage ? { status: routeSearch.stage } : {}),
    ...(routeSearch.clientId ? { clientId: String(routeSearch.clientId) } : {}),
    ...(routeSearch.jobId ? { jobId: String(routeSearch.jobId) } : {}),
  }));
  const [showArchived, setShowArchived] = useState(Boolean(routeSearch.archived));
  const [mineOnly, setMineOnly] = useState(Boolean(routeSearch.mine));

  useEffect(() => {
    setPage(routeSearch.page || 1);
    setSearch(routeSearch.q || "");
    setFilterValues({
      ...(routeSearch.stage ? { status: routeSearch.stage } : {}),
      ...(routeSearch.clientId ? { clientId: String(routeSearch.clientId) } : {}),
      ...(routeSearch.jobId ? { jobId: String(routeSearch.jobId) } : {}),
    });
    setShowArchived(Boolean(routeSearch.archived));
    setMineOnly(Boolean(routeSearch.mine));
  }, [routeSearch.page, routeSearch.q, routeSearch.stage, routeSearch.clientId, routeSearch.jobId, routeSearch.archived, routeSearch.mine]);

  const updateListUrl = (next: Partial<TAApplicationSearch>) => {
    const valueFor = <K extends keyof TAApplicationSearch>(key: K, fallback: TAApplicationSearch[K]) =>
      Object.prototype.hasOwnProperty.call(next, key) ? next[key] : fallback;
    void navigate({
      to: "/ta/applications",
      search: {
        q: valueFor("q", search || undefined),
        stage: valueFor("stage", filterValues.status as ApplicationStatus | undefined),
        clientId: valueFor("clientId", filterValues.clientId ? Number(filterValues.clientId) : undefined),
        jobId: valueFor("jobId", filterValues.jobId ? Number(filterValues.jobId) : undefined),
        mine: valueFor("mine", mineOnly || undefined),
        archived: valueFor("archived", showArchived || undefined),
        page: valueFor("page", page > 1 ? page : undefined),
      },
      replace: true,
    });
  };

  const listSearch = {
    q: search || undefined,
    stage: (filterValues.status as ApplicationStatus | undefined) || undefined,
    clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
    jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
    mine: mineOnly || undefined,
    archived: showArchived || undefined,
    page: page > 1 ? page : undefined,
  };

  // Modal states for archive
  const [archiveModalApp, setArchiveModalApp] = useState<{ id: number; name: string; isArchived: boolean } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ["ta", "applications", { page, pageSize, search, filterValues, showArchived, mineOnly }],
    queryFn: () =>
      taApi.listApplications({
        page,
        limit: pageSize,
        search: search || undefined,
        status: (filterValues.status as ApplicationStatus) || undefined,
        jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
        clientId: filterValues.clientId ? Number(filterValues.clientId) : undefined,
        isArchived: showArchived,
        mineOnly: mineOnly ? true : undefined,
      }),
  });

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown", { mineOnly }],
    queryFn: () => taApi.listJobs({ mineOnly: mineOnly ? true : undefined }),
  });

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients", "dropdown"],
    queryFn: () => taApi.listClients(),
  });

  // Mutations
  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      taApi.archiveApplication(id, { reason }),
    onSuccess: (_, vars) => {
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (item.id === vars.id ? { ...item, isArchived: true, status: ApplicationStatus.ARCHIVED } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (item.id === vars.id ? { ...item, isArchived: true, status: ApplicationStatus.ARCHIVED } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(vars.id)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setArchiveModalApp(null);
      setArchiveReason("");
      const msg = "Application archived successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("Application Archived", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to archive this application. Please try again." });
      notify.error("Unable to archive application", err);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      taApi.restoreApplication(id, { reason }),
    onSuccess: (_, vars) => {
      queryClient.setQueriesData<any>({ queryKey: ["ta", "applications"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item) => (item.id === vars.id ? { ...item, isArchived: false, status: ApplicationStatus.SUBMITTED } : item));
        }
        if (Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (item.id === vars.id ? { ...item, isArchived: false, status: ApplicationStatus.SUBMITTED } : item)),
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(vars.id)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setArchiveModalApp(null);
      setArchiveReason("");
      const msg = "Application restored to pipeline.";
      setFeedback({ type: "success", message: msg });
      notify.success("Application Restored", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to restore this application. Please try again." });
      notify.error("Unable to restore application", err);
    },
  });

  const queryData = applicationsQuery.data;
  const applications = Array.isArray(queryData) ? queryData : queryData?.data || [];
  const totalItems = Array.isArray(queryData) ? queryData.length : queryData?.total || 0;
  const totalPages = Array.isArray(queryData)
    ? Math.max(1, Math.ceil(queryData.length / pageSize))
    : queryData?.totalPages || 1;
  const jobs = jobsQuery.data ?? EMPTY_LIST;
  const clients = clientsQuery.data ?? EMPTY_LIST;

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

  const filteredJobs = React.useMemo(() => {
    return filterValues.clientId
      ? jobs.filter((j: any) => j.mrf?.clientId === Number(filterValues.clientId))
      : jobs;
  }, [jobs, filterValues.clientId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.navigation.applications}
        description="Review applications, see their current stage, and continue the next hiring action."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.applications },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? "primary" : "outline"}
              size="sm"
              leftIcon={<Archive className="w-3.5 h-3.5" />}
              onClick={() => {
                const nextArchived = !showArchived;
                setShowArchived(nextArchived);
                setPage(1);
                updateListUrl({ archived: nextArchived || undefined, page: undefined });
              }}
            >
              {showArchived ? "Viewing archived" : "View archived"}
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <SearchFilters
        searchPlaceholder="Search applications by candidate, email, job title..."
        searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
            updateListUrl({ q: v || undefined, page: undefined });
          }}
        filterValues={filterValues}
          onFilterChange={(k, v) => {
            const nextValues = { ...filterValues };
            if (v) nextValues[k] = v;
            else delete nextValues[k];
            // If changing client, clear selected job if it no longer belongs to that client.
            if (k === "clientId" && nextValues.jobId) {
              const jobBelongs = jobs.some((j: any) => String(j.id) === nextValues.jobId && (!v || j.mrf?.clientId === Number(v)));
              if (!jobBelongs) delete nextValues.jobId;
            }
            setFilterValues(nextValues);
            setPage(1);
            updateListUrl({
              stage: k === "status" ? (v as ApplicationStatus) || undefined : (nextValues.status as ApplicationStatus | undefined),
              clientId: nextValues.clientId ? Number(nextValues.clientId) : undefined,
              jobId: nextValues.jobId ? Number(nextValues.jobId) : undefined,
              page: undefined,
            });
          }}
        onReset={() => {
          setSearch("");
          setFilterValues({});
          setPage(1);
          updateListUrl({ q: undefined, stage: undefined, clientId: undefined, jobId: undefined, page: undefined });
        }}
        filters={[
          {
            key: "status",
            label: "Application stage",
            placeholder: "All application stages",
            options: PIPELINE_FILTER_STAGES.map((s) => ({
              value: s,
              label: getApplicationStatusMeta(s).label,
            })),
          },
          {
            key: "clientId",
            label: "Client account",
            placeholder: mineOnly ? "My client accounts" : "All client accounts",
            searchable: true,
            options: availableClients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            })),
          },
          {
            key: "jobId",
            label: "Job opening",
            placeholder: mineOnly ? "My job openings" : "All job openings",
            searchable: true,
            options: filteredJobs.map((j) => ({
              value: String(j.id),
              label: j.title,
              subtitle: `Reference ${j.id} • ${j.location || "Philippines"}`,
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
                updateListUrl({ mine: undefined, clientId: undefined, jobId: undefined, page: undefined });
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                !mineOnly
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All candidates
            </button>
            <button
              type="button"
              onClick={() => {
                setMineOnly(true);
                setFilterValues((prev) => {
                  const next = { ...prev };
                  delete next.clientId;
                  delete next.jobId;
                  return next;
                });
                setPage(1);
                updateListUrl({ mine: true, clientId: undefined, jobId: undefined, page: undefined });
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                mineOnly
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My candidates
            </button>
          </div>
        }
      />

      {/* Table Section */}
      {applicationsQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : applicationsQuery.isError ? (
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => applicationsQuery.refetch()}
        />
      ) : applications.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={showArchived ? "No archived applications" : "No candidates found in pipeline"}
            description={
              search || Object.keys(filterValues).length > 0
                ? "No applications matched your search filters. Try clearing filters to see all records."
                : "Candidate applications submitted through the applicant portal will appear here."
            }
            action={
              (search || Object.keys(filterValues).length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setFilterValues({});
                    setPage(1);
                    updateListUrl({ q: undefined, stage: undefined, clientId: undefined, jobId: undefined, page: undefined });
                  }}
                >
                  Reset All Filters
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-300 overflow-hidden">
          <div className="divide-y divide-slate-200 md:hidden">
            {applications.map((app) => {
              const p = app.user?.applicantProfile;
              const candidateName = p
                ? `${p.firstName} ${p.lastName}`
                : app.user?.email || "Candidate";

              return (
                <article key={app.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-950">{candidateName}</h2>
                      <p className="mt-0.5 break-words text-sm text-slate-600">{app.jobPosting?.title || "Job opening"}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-slate-500">Match score</dt>
                      <dd className="mt-0.5"><ScoreBadge score={app.candidateFitScore ?? app.candidateScores?.[0]?.finalFitScore ?? app.aiScore} size="sm" /></dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Applied</dt>
                      <dd className="mt-0.5 text-slate-800">{formatDate(app.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    <Link
                      to="/ta/applications/$applicationId"
                      params={{ applicationId: String(app.id) }}
                      search={listSearch}
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                    >
                      View application
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setArchiveModalApp({ id: app.id, name: candidateName, isArchived: Boolean(app.isArchived) })}
                    >
                      {app.isArchived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Applicant</th>
                  <th className="px-3.5 py-2.5 font-bold">Job opening</th>
                  <th className="px-3.5 py-2.5 font-bold">Current stage</th>
                  <th className="px-3.5 py-2.5 font-bold text-center">Match Score</th>
                  <th className="px-3.5 py-2.5 font-bold">Submission Date</th>
                  <th className="px-3.5 py-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {applications.map((app) => {
                  const p = app.user?.applicantProfile;
                  const candidateName = p
                    ? `${p.firstName} ${p.lastName}`
                    : app.user?.email || "Candidate";

                  return (
                    <tr key={app.id} className="hover:bg-slate-100/70 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-950">{candidateName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {app.user?.email} {p?.mobileNumber ? `• ${p.mobileNumber}` : ""}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {app.jobPosting?.title || "Job opening"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {app.jobPosting?.location || "Philippines"}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <ScoreBadge
                          score={app.candidateFitScore ?? app.candidateScores?.[0]?.finalFitScore ?? app.aiScore}
                          size="sm"
                        />
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 text-[11px]">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to="/ta/applications/$applicationId"
                            params={{ applicationId: String(app.id) }}
                            search={listSearch}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              View application
                            </Button>
                          </Link>                          {!app.isArchived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setArchiveModalApp({
                                  id: app.id,
                                  name: candidateName,
                                  isArchived: false,
                                })
                              }
                              title="Archive Application"
                              className="text-slate-400 hover:text-slate-700"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                              onClick={() =>
                                setArchiveModalApp({
                                  id: app.id,
                                  name: candidateName,
                                  isArchived: true,
                                })
                              }
                              title="Restore Application"
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-slate-300 bg-slate-50">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                updateListUrl({ page: nextPage > 1 ? nextPage : undefined });
              }}
              itemLabel="applications"
            />
          </div>
        </div>
      )}

      {/* Archive / Restore Modal */}
      <Dialog
        open={Boolean(archiveModalApp)}
        onClose={() => setArchiveModalApp(null)}
        title={archiveModalApp?.isArchived ? "Restore Application" : "Archive Application"}
        description={`Record administrative reason to ${archiveModalApp?.isArchived ? "restore" : "archive"} ${archiveModalApp?.name}'s application`}
      >
        <div className="space-y-4">
          <Textarea
            label="Reason for this change"
            placeholder={
              archiveModalApp?.isArchived
                ? "e.g. Candidate recontacted and available for consideration"
                : "e.g. Position filled, candidate unresponsive, or withdrew application"
            }
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={3}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setArchiveModalApp(null)}>
              Cancel
            </Button>
            <Button
              variant={archiveModalApp?.isArchived ? "primary" : "danger"}
              size="sm"
              disabled={!archiveReason.trim()}
              loading={archiveMutation.isPending || restoreMutation.isPending}
              onClick={() => {
                if (!archiveModalApp) return;
                if (archiveModalApp.isArchived) {
                  restoreMutation.mutate({ id: archiveModalApp.id, reason: archiveReason });
                } else {
                  archiveMutation.mutate({ id: archiveModalApp.id, reason: archiveReason });
                }
              }}
            >
              {archiveModalApp?.isArchived ? "Restore Application" : "Archive Application"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
