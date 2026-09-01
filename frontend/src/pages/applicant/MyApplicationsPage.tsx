import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  StatusBadge,
  PipelineIndicator,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import {
  Briefcase,
  Calendar,
  FileText,
  CheckCircle2,
  Bookmark,
  MapPin,
} from "lucide-react";

export const MyApplicationsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: applicantJobsApi.getMyApplications,
  });

  const allApplications = applicationsQuery.data || [];

  const filteredApplications = allApplications.filter((app) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") {
      return (
        app.status === ApplicationStatus.SUBMITTED ||
        app.status === ApplicationStatus.PARSING ||
        app.status === ApplicationStatus.REVIEW ||
        app.status === ApplicationStatus.MATCHED
      );
    }
    if (statusFilter === "INTERVIEWS") {
      return (
        app.status === ApplicationStatus.INITIAL_SCREENING ||
        app.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
        app.status === ApplicationStatus.FINAL_INTERVIEW
      );
    }
    if (statusFilter === "COMPLIANCE") {
      return (
        app.status === ApplicationStatus.COMPLIANCE ||
        app.status === ApplicationStatus.CONTRACT_AND_ORIENTATION
      );
    }
    if (statusFilter === "DEPLOYED") {
      return app.status === ApplicationStatus.DEPLOYED;
    }
    if (statusFilter === "ARCHIVED") {
      return (
        app.status === ApplicationStatus.ARCHIVED ||
        app.status === ApplicationStatus.BACKOUT ||
        app.isArchived
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const paginatedApplications = filteredApplications.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const filterTabs = [
    { key: "ALL", label: "All applications", count: allApplications.length },
    {
      key: "ACTIVE",
      label: "In Review",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.SUBMITTED ||
          a.status === ApplicationStatus.PARSING ||
          a.status === ApplicationStatus.REVIEW ||
          a.status === ApplicationStatus.MATCHED
      ).length,
    },
    {
      key: "INTERVIEWS",
      label: "Interviews",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.INITIAL_SCREENING ||
          a.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
          a.status === ApplicationStatus.FINAL_INTERVIEW
      ).length,
    },
    {
      key: "COMPLIANCE",
      label: "Requirements & Onboarding",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.COMPLIANCE ||
          a.status === ApplicationStatus.CONTRACT_AND_ORIENTATION
      ).length,
    },
    {
      key: "DEPLOYED",
      label: "Deployed",
      count: allApplications.filter((a) => a.status === ApplicationStatus.DEPLOYED).length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My applications"
        description="See your application progress, interviews, and next steps."
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: "Applications" },
        ]}
        actions={
          <Link
            to="/app/jobs"
            className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Explore jobs
          </Link>
        }
      />

      {/* Filter Tabs Ribbon */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-300 pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={`min-h-11 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
              statusFilter === tab.key
                ? "bg-teal-700 text-white border border-teal-800"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full ${
                statusFilter === tab.key ? "bg-teal-900 text-teal-100" : "bg-slate-100 text-slate-600"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {applicationsQuery.isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : applicationsQuery.isError ? (
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => applicationsQuery.refetch()}
        />
      ) : allApplications.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Briefcase className="w-5 h-5" />}
            title="No applications yet"
            description="Explore current jobs and apply when a role suits you."
            action={
              <Link
                to="/app/jobs"
                className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
              >
                Explore jobs
              </Link>
            }
          />
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Briefcase className="w-5 h-5" />}
            title="No applications in this category"
            description="There are currently no job applications matching this filter category."
            action={
              <Button variant="outline" size="sm" onClick={() => setStatusFilter("ALL")}>
                View All Applications
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedApplications.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-slate-300 p-5 space-y-4 hover:border-slate-400 transition-colors rounded-lg shadow-xs"
            >
              {/* Top line: role title, company & date */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">
                      {app.jobPosting?.title || `Position reference #${app.jobPostingId}`}
                    </h3>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {app.jobPosting?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{app.jobPosting.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Applied on {formatDate(app.createdAt)}</span>
                    </span>
                    <span className="font-mono text-slate-400">
                      Reference: #{app.id}
                    </span>
                  </div>
                </div>

                <Link
                  to="/app/applications/$applicationId"
                  params={{ applicationId: String(app.id) }}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 shrink-0"
                >
                  View application progress
                </Link>
              </div>

              {/* Pipeline Stepper */}
              <div className="pt-2 border-t border-slate-200">
                <PipelineIndicator currentStatus={app.status} audience="applicant" />
              </div>

              {/* Stage-specific contextual notices */}
              {app.status === ApplicationStatus.INITIAL_SCREENING && (
                <div className="p-3 bg-teal-50 border-l-4 border-teal-700 border border-slate-300 flex items-center gap-2 text-sm text-teal-950">
                  <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>
                    Your screening interview has been queued. Our recruitment team will coordinate with you regarding the schedule.
                  </span>
                </div>
              )}

              {app.status === ApplicationStatus.FINAL_INTERVIEW && (
                <div className="p-3 bg-teal-50 border-l-4 border-teal-700 border border-slate-300 flex items-center gap-2 text-sm text-teal-950">
                  <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>
                    You have advanced to the client final interview. Please prepare for your scheduled discussion.
                  </span>
                </div>
              )}

              {app.status === ApplicationStatus.COMPLIANCE && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-600 border border-slate-300 flex items-center justify-between gap-3 text-sm text-amber-950">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Employment documents (201) are needed. Please submit the documents requested for you.
                    </span>
                  </div>
                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                  >
                    <span className="font-medium text-amber-900 hover:underline shrink-0">
                      Submit documents
                    </span>
                  </Link>
                </div>
              )}

              {app.status === ApplicationStatus.DEPLOYED && (
                <div className="p-3 bg-emerald-50 border-l-4 border-emerald-700 border border-slate-300 flex items-center gap-2 text-sm text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    You have been placed at your work site. Your employee record is ready.
                  </span>
                </div>
              )}

              {app.status === ApplicationStatus.TALENT_POOL && (
                <div className="p-3 bg-violet-50 border-l-4 border-violet-700 border border-slate-300 flex items-center justify-between gap-3 text-sm text-violet-950">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-violet-700 shrink-0" />
                    <span>
                      You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.
                    </span>
                  </div>
                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                  >
                    <span className="font-medium text-violet-900 hover:underline shrink-0">
                      View details
                    </span>
                  </Link>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          <div className="bg-white border border-slate-300 p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredApplications.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
