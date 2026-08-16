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
import { Briefcase, ArrowRight, Calendar, FileText, CheckCircle2 } from "lucide-react";

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
        app.status === ApplicationStatus.HIRED ||
        app.status === ApplicationStatus.COMPLIANCE ||
        app.status === ApplicationStatus.ONBOARDING
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
    { key: "ALL", label: "All Submissions", count: allApplications.length },
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
      label: "Pre-Employment / 201",
      count: allApplications.filter(
        (a) =>
          a.status === ApplicationStatus.HIRED ||
          a.status === ApplicationStatus.COMPLIANCE ||
          a.status === ApplicationStatus.ONBOARDING
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
        title="Application Status Tracker"
        description="Monitor real-time status progression, scheduled interviews, and compliance requirements"
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Applications" },
        ]}
        actions={
          <Link to="/app/jobs">
            <Button variant="primary" size="sm" leftIcon={<Briefcase className="w-3.5 h-3.5" />}>
              Find More Jobs
            </Button>
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
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors flex items-center gap-2 ${
              statusFilter === tab.key
                ? "bg-teal-700 text-white border border-teal-800"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full ${
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
            title="No applications submitted yet"
            description="You haven't applied to any job requisitions. Browse open positions to submit your candidate profile."
            action={
              <Link to="/app/jobs">
                <Button variant="primary" size="sm">
                  Browse Open Positions
                </Button>
              </Link>
            }
          />
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Briefcase className="w-5 h-5" />}
            title="No applications in this category"
            description="You don't have any application records matching the selected status filter."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("ALL");
                  setPage(1);
                }}
              >
                Show All Submissions
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedApplications.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-slate-300 p-4 space-y-4 hover:border-slate-400 transition-colors"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-bold font-mono uppercase text-slate-950">
                      {app.jobPosting?.title || "Job Requisition"}
                    </h3>
                    <StatusBadge status={app.status} size="sm" />
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-3">
                    <span>Submitted: {formatDate(app.createdAt)}</span>
                    {app.jobPosting?.location && <span>• {app.jobPosting.location}</span>}
                  </div>
                </div>

                <Link
                  to="/app/applications/$applicationId"
                  params={{ applicationId: String(app.id) }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    View Details
                  </Button>
                </Link>
              </div>

              {/* Hiring Pipeline Visual Progression */}
              <div className="px-1 py-1">
                <PipelineIndicator currentStatus={app.status} />
              </div>

              {/* Status Specific Action / Alert Bar */}
              {(app.status === ApplicationStatus.INITIAL_SCREENING ||
                app.status === ApplicationStatus.FINAL_INTERVIEW) && (
                <div className="p-3 bg-blue-50 border-l-4 border-blue-700 border border-slate-300 flex items-center justify-between gap-3 text-xs text-blue-950 font-mono">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>
                      Interview Scheduled / In Progress. Check your email or notifications for meeting link and coordinator notes.
                    </span>
                  </div>
                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                  >
                    <span className="font-bold text-blue-800 hover:underline shrink-0 uppercase">
                      Schedule Details →
                    </span>
                  </Link>
                </div>
              )}

              {app.status === ApplicationStatus.COMPLIANCE && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-600 border border-slate-300 flex items-center justify-between gap-3 text-xs text-amber-950 font-mono">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Pre-Employment 201 Compliance Checklist active. Please submit required government clearances.
                    </span>
                  </div>
                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(app.id) }}
                  >
                    <span className="font-bold text-amber-900 hover:underline shrink-0 uppercase">
                      Submit Clearances →
                    </span>
                  </Link>
                </div>
              )}

              {app.status === ApplicationStatus.DEPLOYED && (
                <div className="p-3 bg-emerald-50 border-l-4 border-emerald-700 border border-slate-300 flex items-center gap-2 text-xs text-emerald-950 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Successfully Deployed to client site. Active manpower record generated.
                  </span>
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
