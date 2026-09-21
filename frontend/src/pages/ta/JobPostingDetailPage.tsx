import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  ScoreBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  JobImage,
  StatusBadge,
  Tabs,
  JobContentRenderer,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate, formatSalaryRange, formatEmploymentType, cn } from "../../lib/utils";
import { ApplicationStatus, JobStatus } from "../../lib/types/enums";

const ACTIVE_STAGES: string[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.PARSING,
  ApplicationStatus.REVIEW,
  ApplicationStatus.NEEDS_ATTENTION,
  ApplicationStatus.MATCHED,
  ApplicationStatus.INITIAL_SCREENING,
  ApplicationStatus.CLIENT_ENDORSEMENT,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.CONTRACT_AND_ORIENTATION,
];

const DEPLOYED_STAGES: string[] = [
  ApplicationStatus.DEPLOYED,
  ApplicationStatus.HIRED,
];
import {
  RefreshCw,
  ArrowLeft,
  MapPin,
  Clock,
  Edit,
  ExternalLink,
  Users,
  Briefcase,
  Send,
  ListOrdered,
  Eye,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TalentPoolCandidate } from "../../lib/types/ta.types";
import { SendInvitationModal } from "../../components/ta/SendInvitationModal";
import { InvitationsTrackerDrawer } from "../../components/ta/InvitationsTrackerDrawer";
import { TA_COPY, formatTaStatus } from "../../lib/ta-copy";

export const JobPostingDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { jobId } = useParams({ strict: false }) as { jobId: string };

  const [activeTab, setActiveTab] = useState<"applicants" | "talentPool">("applicants");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editStatus, setEditStatus] = useState<JobStatus>(JobStatus.OPEN);
  const [editIsEvergreen, setEditIsEvergreen] = useState(false);
  const [editModalTab, setEditModalTab] = useState<"edit" | "preview">("edit");

  // Invitation Modal & Tracker Drawer State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [trackerDrawerOpen, setTrackerDrawerOpen] = useState(false);
  const [candidateToInvite, setCandidateToInvite] = useState<TalentPoolCandidate | null>(null);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("tab") === "talentPool") {
      setActiveTab("talentPool");
    }
  }, []);

  const [candidatePage, setCandidatePage] = useState(1);
  const candidatePageSize = 10;
  const [applicantFilter, setApplicantFilter] = useState<"active" | "deployed" | "all">("active");

  const jobQuery = useQuery({
    queryKey: ["ta", "job", jobId],
    queryFn: () => taApi.getJob(jobId),
    enabled: Boolean(jobId),
  });

  const rankedCandidatesQuery = useQuery({
    queryKey: ["ta", "job", jobId, "ranked"],
    queryFn: () => taApi.getRankedCandidates(jobId),
    enabled: Boolean(jobId),
  });

  const talentPoolQuery = useQuery({
    queryKey: ["ta", "job", jobId, "talent-pool"],
    queryFn: () => taApi.getJobTalentPool(jobId),
    enabled: Boolean(jobId),
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const rankCandidatesMutation = useMutation({
    mutationFn: () => taApi.rankCandidates(jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "ranked"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "talent-pool"] });
      const count = data?.rankedCount ?? 0;
      const msg = `Candidate matches updated. Reviewed ${count} candidate profile${count === 1 ? "" : "s"}.`;
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Candidate matches updated", msg);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Unable to update candidate matches. Please try again.",
      });
      notify.error("Unable to update candidate matches", err);
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: (data: any) => taApi.updateJob(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      setEditModalOpen(false);
      notify.success("Job opening updated", "The job details were saved.");
    },
    onError: (err: any) => {
      notify.error("Unable to update job opening", err);
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: taApi.sendTalentPoolInvitation,
    onSuccess: () => {
      setInviteModalOpen(false);
      setCandidateToInvite(null);
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      const msg = "Job invitation sent successfully via in-app notification and email.";
      setFeedback({ type: "success", message: msg });
      notify.success("Invitation Sent", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Unable to send this invitation. Please try again." });
      notify.error("Unable to send invitation", err);
    },
  });

  const job = jobQuery.data;

  // Initialize edit form when job loads
  React.useEffect(() => {
    if (job) {
      setEditTitle(job.title);
      setEditLocation(job.location || "");
      setEditImageUrl(job.imageUrl || "");
      setEditDescription(job.description);
      setEditRequirements(job.requirements);
      setEditStatus(job.status);
      setEditIsEvergreen(Boolean(job.isEvergreen));
    }
  }, [job]);

  const rankedScores = React.useMemo(
    () => rankedCandidatesQuery.data || [],
    [rankedCandidatesQuery.data]
  );
  const talentPoolMatches = React.useMemo(
    () => talentPoolQuery.data || [],
    [talentPoolQuery.data]
  );

  const activeScores = React.useMemo(() => {
    return rankedScores.filter((s) => {
      const st = s.candidate?.applicationStatus || ApplicationStatus.SUBMITTED;
      return ACTIVE_STAGES.includes(st);
    });
  }, [rankedScores]);

  const deployedScores = React.useMemo(() => {
    return rankedScores.filter((s) => {
      const st = s.candidate?.applicationStatus;
      return Boolean(st && DEPLOYED_STAGES.includes(st));
    });
  }, [rankedScores]);

  const filteredScores = React.useMemo(() => {
    if (applicantFilter === "active") return activeScores;
    if (applicantFilter === "deployed") return deployedScores;
    return rankedScores;
  }, [applicantFilter, activeScores, deployedScores, rankedScores]);

  const totalPages = Math.max(1, Math.ceil(filteredScores.length / candidatePageSize));
  const paginatedScores = filteredScores.slice(
    (candidatePage - 1) * candidatePageSize,
    candidatePage * candidatePageSize
  );

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={TA_COPY.navigation.openings} description="Loading job opening details..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="space-y-6">
        <PageHeader title={TA_COPY.navigation.openings} description="Job opening details" />
        <ErrorState error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={`Job opening #${job.id} • Posted ${formatDate(job.createdAt)}`}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.openings, href: "/ta/jobs" },
          { label: job.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/jobs">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to job openings
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => {
                if (job) {
                  setEditTitle(job.title);
                  setEditLocation(job.location || "");
                  setEditImageUrl(job.imageUrl || "");
                  setEditDescription(job.description);
                  setEditRequirements(job.requirements);
                  setEditStatus(job.status);
                  setEditIsEvergreen(Boolean(job.isEvergreen));
                }
                setEditModalTab("edit");
                setEditModalOpen(true);
              }}
            >
              Edit job opening
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              loading={rankCandidatesMutation.isPending}
              onClick={() => rankCandidatesMutation.mutate()}
            >
              Recalculate match scores
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between ${
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

      {/* Position Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-4">
            <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="lg" />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600">Status</span>
                <div className="flex items-center gap-1.5">
                  {job.isEvergreen && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                      Always open
                    </span>
                  )}
                  <StatusBadge status={formatTaStatus(job.status)} type="raw" size="sm" />
                </div>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
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
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Created {formatDate(job.createdAt)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ATS Multi-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">
          {/* Main / Narrative Column (7 of 12) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="border border-slate-200 rounded-lg p-5 bg-white shadow-xs">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Job Overview & Responsibilities
              </h4>
              <JobContentRenderer content={job.description} variant="ta" />
            </div>
          </div>

          {/* Sidebar / Auxiliary Column (5 of 12) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card 1: Required Skills & Qualifications */}
            <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50 shadow-xs">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
                Required Skills & Qualifications
              </h4>
              <JobContentRenderer content={job.requirements} variant="ta" />
            </div>

            {/* Card 2: Requisition Specifications */}
            <div className="border border-slate-200 rounded-lg p-5 bg-white shadow-xs space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                Requisition Specifications
              </h4>

              <dl className="grid grid-cols-1 gap-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">Client</dt>
                  <dd className="font-semibold text-slate-800 text-right">
                    {job.mrf?.client?.name || "Unassigned"}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">Work site location</dt>
                  <dd className="font-semibold text-slate-800 text-right">
                    {job.location || "Philippines"}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">Monthly compensation</dt>
                  <dd className="text-right">
                    {job.mrf?.salaryRangeMin || job.mrf?.salaryRangeMax ? (
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">
                        {formatSalaryRange(job.mrf.salaryRangeMin, job.mrf.salaryRangeMax)}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Not specified</span>
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">Employment type</dt>
                  <dd className="font-semibold text-slate-800 text-right">
                    {job.mrf?.employmentType ? formatEmploymentType(job.mrf.employmentType) : "Not specified"}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">Work arrangement</dt>
                  <dd className="font-semibold text-slate-800 text-right">
                    {job.mrf?.workArrangement || "On-site"}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">Evergreen status</dt>
                  <dd className="text-right">
                    {job.isEvergreen ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                        Always open (Continuous recruitment)
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">Standard requisition</span>
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1">
                  <dt className="text-slate-500 font-medium">Linked MRF reference</dt>
                  <dd className="text-right">
                    {job.mrf?.id ? (
                      <Link
                        to="/ta/mrfs/$mrfId"
                        params={{ mrfId: String(job.mrf.id) }}
                        className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                      >
                        <span>Request #{job.mrf.id}</span>
                        <ExternalLink className="w-3 h-3 text-teal-600" />
                      </Link>
                    ) : job.mrfId ? (
                      <Link
                        to="/ta/mrfs/$mrfId"
                        params={{ mrfId: String(job.mrfId) }}
                        className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                      >
                        <span>Request #{job.mrfId}</span>
                        <ExternalLink className="w-3 h-3 text-teal-600" />
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs">None (Direct posting)</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Sourcing & Matching Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            value={activeTab}
            onChange={(tab) => setActiveTab(tab as "applicants" | "talentPool")}
            ariaLabel="Job opening candidate views"
            items={[
              { id: "applicants", label: `Applicants (${rankedScores.length})`, icon: Users, panelId: "job-applicants" },
              { id: "talentPool", label: `Candidate pool matches (${talentPoolMatches.length})`, icon: Users, panelId: "job-talent-pool" },
            ]}
            className="border-b-0 flex-1"
          />

          <div className="flex items-center gap-2 px-4 pb-3 sm:pb-0">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ListOrdered className="w-3.5 h-3.5 text-slate-500" />}
              onClick={() => setTrackerDrawerOpen(true)}
            >
              Sent invitations
            </Button>
          </div>
        </div>

        {/* Tab 1: Direct Applicants */}
        {activeTab === "applicants" && (
          <div id="job-applicants" role="tabpanel" tabIndex={0}>
            {rankedCandidatesQuery.isLoading ? (
              <LoadingState variant="table" rows={4} />
            ) : rankedScores.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users className="w-6 h-6" />}
                  title="No applicant matches yet"
                  description="Recalculate match scores to compare applicants with this opening’s requirements."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      loading={rankCandidatesMutation.isPending}
                      onClick={() => rankCandidatesMutation.mutate()}
                    >
                      Recalculate match scores
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {/* Segmented Pipeline Stage Filter */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/70 border-b border-slate-200">
                  <div className="inline-flex items-center p-1 bg-slate-200/60 rounded-lg text-xs font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setApplicantFilter("active");
                        setCandidatePage(1);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md transition-all",
                        applicantFilter === "active"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {`Active (${activeScores.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApplicantFilter("deployed");
                        setCandidatePage(1);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md transition-all",
                        applicantFilter === "deployed"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {`Deployed (${deployedScores.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApplicantFilter("all");
                        setCandidatePage(1);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md transition-all",
                        applicantFilter === "all"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {`All (${rankedScores.length})`}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Showing {filteredScores.length} of {rankedScores.length} applicants
                  </div>
                </div>

                {filteredScores.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      icon={<Users className="w-6 h-6 text-slate-400" />}
                      title={
                        applicantFilter === "active"
                          ? "No active applicants in pipeline"
                          : applicantFilter === "deployed"
                          ? "No deployed personnel for this opening yet"
                          : "No applicants found"
                      }
                      description={
                        applicantFilter === "active" && deployedScores.length > 0
                          ? `All ${deployedScores.length} applicant(s) have completed deployment. Switch to Deployed or All to view fulfilled applications.`
                          : "Applicants will appear here once they apply or are matched."
                      }
                      action={
                        applicantFilter === "active" && deployedScores.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setApplicantFilter("deployed");
                              setCandidatePage(1);
                            }}
                          >
                            {`View Deployed (${deployedScores.length})`}
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-center w-12">Rank</th>
                            <th className="px-4 py-3 font-semibold">Candidate</th>
                            <th className="px-4 py-3 font-semibold text-center">Status</th>
                            <th className="px-4 py-3 font-semibold text-center">Match Score</th>
                            <th className="px-4 py-3 font-semibold text-center">Skills</th>
                            <th className="px-4 py-3 font-semibold text-center">Experience</th>
                            <th className="px-4 py-3 font-semibold text-center">Location</th>
                            <th className="px-4 py-3 font-semibold text-center">Requirements</th>
                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {paginatedScores.map((score, idx) => {
                            const globalRank = (candidatePage - 1) * candidatePageSize + idx + 1;
                            const candidate = score.candidate;
                            const fullName = [candidate?.firstName, candidate?.lastName]
                              .filter(Boolean)
                              .join(" ")
                              .trim();
                            const displayName = fullName || candidate?.email || `Application #${score.applicationId}`;

                            return (
                              <tr key={score.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3 text-center font-bold text-slate-700">
                                  #{globalRank}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900 font-sans">
                                    {displayName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {fullName ? `Application #${score.applicationId} • ` : ""}
                                    Calculated {formatDate(score.calculatedAt)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <StatusBadge
                                    status={candidate?.applicationStatus || ApplicationStatus.SUBMITTED}
                                    type="application"
                                    size="sm"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <ScoreBadge score={score.finalFitScore} size="md" />
                                </td>
                                <td className="px-4 py-3 text-center text-slate-700">
                                  {Number(score.skillsScore).toFixed(0)}%
                                </td>
                                <td className="px-4 py-3 text-center text-slate-700">
                                  {Number(score.experienceScore).toFixed(0)}%
                                </td>
                                <td className="px-4 py-3 text-center text-slate-700">
                                  {Number(score.locationScore).toFixed(0)}%
                                </td>
                                <td className="px-4 py-3 text-center text-slate-700">
                                  {Number(score.complianceScore).toFixed(0)}%
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Link
                                    to="/ta/applications/$applicationId"
                                    params={{ applicationId: String(score.applicationId) }}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      rightIcon={<ExternalLink className="w-3 h-3" />}
                                    >
                                      View application
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-3 border-t border-slate-200 bg-slate-50">
                      <Pagination
                        currentPage={candidatePage}
                        totalPages={totalPages}
                        totalItems={filteredScores.length}
                        pageSize={candidatePageSize}
                        onPageChange={setCandidatePage}
                        itemLabel="candidates"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Discovered Talent Pool Candidates */}
        {activeTab === "talentPool" && (
          <div id="job-talent-pool" role="tabpanel" tabIndex={0}>
            {talentPoolQuery.isLoading ? (
              <LoadingState variant="cards" />
            ) : talentPoolMatches.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users className="w-6 h-6 text-slate-400" />}
                  title="No candidate pool matches for this opening"
                  description="All available talent pool members have already been considered or have no matching skills."
                />
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {talentPoolMatches.map((res) => {
                  const c = res.candidate;
                  const simPercent = Math.round((res.similarity || 0) * 100);

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-teal-300 transition-colors bg-white flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {c.firstName} {c.lastName}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                {c.availability}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {c.email}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 text-xs font-mono font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                              <span>{simPercent}% Match</span>
                            </span>
                          </div>
                        </div>

                        {c.currentRole && (
                          <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.currentRole}</span>
                          </div>
                        )}

                        {(c.city || c.province) && (
                          <div className="text-xs text-slate-600 flex items-center gap-1.5 font-mono">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{[c.city, c.province].filter(Boolean).join(", ")}</span>
                          </div>
                        )}

                        {c.skills && c.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {c.skills.slice(0, 5).map((s: any, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
                              >
                                {typeof s === "string" ? s : s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                        {(() => {
                          const isAlreadyInPipeline = rankedScores.some(
                            (r: any) =>
                              r.applicantProfileId === c.id ||
                              r.applicantProfileId === c.applicantProfileId ||
                              r.candidate?.id === c.id ||
                              r.candidate?.id === (c as any).userId ||
                              r.candidate?.applicantProfileId === c.applicantProfileId ||
                              r.candidate?.applicantProfileId === c.id ||
                              r.application?.user?.id === (c as any).userId ||
                              r.application?.user?.id === c.id ||
                              r.application?.userId === (c as any).userId ||
                              r.application?.userId === c.id
                          );

                          if (isAlreadyInPipeline) {
                            return (
                              <span className="text-xs font-medium text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                                In Active Pipeline
                              </span>
                            );
                          }

                          return (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Send className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setCandidateToInvite(c);
                                setInviteModalOpen(true);
                              }}
                            >
                              Invite to Apply
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Job Modal */}
      <Dialog
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit job opening"
        description={`Update job opening #${job.id}`}
        size="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateJobMutation.mutate({
              title: editTitle,
              location: editLocation || undefined,
              imageUrl: editImageUrl || undefined,
              description: editDescription,
              requirements: editRequirements,
              status: editStatus,
              isEvergreen: editIsEvergreen,
            });
          }}
          className="space-y-4"
        >
          {/* View Tab Toggle */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setEditModalTab("edit")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                  editModalTab === "edit"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                  editModalTab === "preview"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 hidden sm:inline font-mono">
              {editModalTab === "edit" ? "Recruiter Editor" : "Candidate-Facing Preview"}
            </span>
          </div>

          {editModalTab === "edit" ? (
            <div className="space-y-4">
              <Input
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
                <Input
                  label="Image web address (optional)"
                  placeholder="https://example.com/company-banner.jpg"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                />
              </div>
              <Select
                label="Opening status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as JobStatus)}
                options={[
                  { value: JobStatus.OPEN, label: "Open" },
                  { value: JobStatus.DRAFT, label: "Draft" },
                  { value: JobStatus.CLOSED, label: "Closed" },
                ]}
              />


              <Textarea
                label="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                required
              />
              <Textarea
                label="Requirements"
                value={editRequirements}
                onChange={(e) => setEditRequirements(e.target.value)}
                rows={4}
                required
              />

              {/* Keep Open After Fill Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    checked={editIsEvergreen}
                    onChange={(e) => setEditIsEvergreen(e.target.checked)}
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
                  <JobImage src={editImageUrl} title={editTitle || "Job Title"} alt={editTitle || "Job Title"} size="md" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">{editTitle || "Untitled Job Opening"}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{editLocation || "Philippines"}</span>
                      </span>
                      <span>•</span>
                      <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {editStatus}
                      </span>
                      {editIsEvergreen && (
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
                      {editDescription ? (
                        <JobContentRenderer content={editDescription} variant="ta" />
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
                      {editRequirements ? (
                        <JobContentRenderer content={editRequirements} variant="ta" />
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
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updateJobMutation.isPending}>
              Save job opening
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Send Job Invitation Modal */}
      <SendInvitationModal
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setCandidateToInvite(null);
        }}
        candidate={candidateToInvite}
        targetJobId={Number(jobId)}
        targetJobTitle={job.title}
        onSend={(payload) => sendInvitationMutation.mutate(payload)}
        loading={sendInvitationMutation.isPending}
      />

      {/* Outgoing Invitations Tracker Drawer */}
      <InvitationsTrackerDrawer
        open={trackerDrawerOpen}
        onClose={() => setTrackerDrawerOpen(false)}
        jobPostingId={Number(jobId)}
      />
    </div>
  );
};
