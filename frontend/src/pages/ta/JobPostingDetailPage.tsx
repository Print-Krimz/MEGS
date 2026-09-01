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
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { JobStatus } from "../../lib/types/enums";
import {
  Sparkles,
  ArrowLeft,
  MapPin,
  Clock,
  Edit,
  ExternalLink,
  Users,
  UserPlus,
  Briefcase,
  CheckCircle2,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TalentPoolCandidate } from "../../lib/types/ta.types";

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

  // Consider / Reactivation Modal State
  const [considerModalOpen, setConsiderModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<TalentPoolCandidate | null>(null);
  const [considerNotes, setConsiderNotes] = useState("");
  const [considerOutcome, setConsiderOutcome] = useState<"INTERESTED" | "NOT_INTERESTED" | "NO_RESPONSE" | "UNAVAILABLE">("INTERESTED");

  const [candidatePage, setCandidatePage] = useState(1);
  const candidatePageSize = 10;

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
      const msg = `Candidate match ranking updated. Evaluated ${count} candidate profile${count === 1 ? "" : "s"}.`;
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Matching Completed", msg);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: `Failed to match candidates: ${err.message}`,
      });
      notify.error("Matching Failed", err);
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: (data: any) => taApi.updateJob(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      setEditModalOpen(false);
      notify.success("Requisition Updated", "Job details saved successfully.");
    },
    onError: (err: any) => {
      notify.error("Update Failed", err);
    },
  });

  const considerCandidateMutation = useMutation({
    mutationFn: taApi.considerCandidateForJob,
    onSuccess: (res) => {
      setConsiderModalOpen(false);
      setConsiderNotes("");
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "ranked"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "talent-pool"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool"] });
      const scoreMsg = res.score?.finalFitScore !== undefined ? ` (Fit Score: ${res.score.finalFitScore}%)` : "";
      const msg = `Candidate reactivated into Application #${res.application?.id || ""}${scoreMsg} for this requisition.`;
      setFeedback({ type: "success", message: msg });
      notify.success("Candidate Reactivated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to reactivate candidate: " + err.message });
      notify.error("Reactivation Failed", err);
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
    }
  }, [job]);

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Requisition" description="Loading details..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Requisition" description="Requisition details" />
        <ErrorState error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  const rankedScores = rankedCandidatesQuery.data || [];
  const talentPoolMatches = talentPoolQuery.data || [];

  const totalPages = Math.max(1, Math.ceil(rankedScores.length / candidatePageSize));
  const paginatedScores = rankedScores.slice(
    (candidatePage - 1) * candidatePageSize,
    candidatePage * candidatePageSize
  );

  const handleOpenConsider = (cand: TalentPoolCandidate) => {
    setSelectedCandidate(cand);
    setConsiderNotes("");
    setConsiderOutcome("INTERESTED");
    setConsiderModalOpen(true);
  };

  const handleConfirmConsider = () => {
    if (!selectedCandidate || !jobId) return;
    considerCandidateMutation.mutate({
      applicantProfileId: selectedCandidate.applicantProfileId,
      targetJobId: Number(jobId),
      notes: considerNotes || undefined,
      contactOutcome: considerOutcome,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={`Requisition #${job.id} • Posted ${formatDate(job.createdAt)}`}
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Job Postings", href: "/ta/jobs" },
          { label: job.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/jobs">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Requisitions
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => setEditModalOpen(true)}
            >
              Edit Requisition
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              loading={rankCandidatesMutation.isPending}
              onClick={() => rankCandidatesMutation.mutate()}
            >
              Refresh Match Scores
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
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
            onClick={() => setFeedback(null)}
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
                <span className="text-xs font-mono font-bold uppercase text-slate-500">Status:</span>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {job.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{job.location || "Philippines"}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Created {formatDate(job.createdAt)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
          <div>
            <h4 className="font-mono font-bold text-slate-700 uppercase mb-1">
              Position Responsibilities
            </h4>
            <p className="text-slate-600 whitespace-pre-line">{job.description}</p>
          </div>
          <div>
            <h4 className="font-mono font-bold text-slate-700 uppercase mb-1">
              Requirements & Criteria
            </h4>
            <p className="text-slate-600 whitespace-pre-line">{job.requirements}</p>
          </div>
        </div>
      </div>

      {/* Candidate Sourcing & Matching Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
        {/* Navigation Tabs */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("applicants")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "applicants"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Direct Applicants ({rankedScores.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("talentPool")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "talentPool"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Talent Pool Matches ({talentPoolMatches.length})</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-600" />}
            loading={rankCandidatesMutation.isPending}
            onClick={() => rankCandidatesMutation.mutate()}
          >
            Re-calculate Match Scores
          </Button>
        </div>

        {/* Tab 1: Direct Applicants */}
        {activeTab === "applicants" && (
          <div>
            {rankedCandidatesQuery.isLoading ? (
              <LoadingState variant="table" rows={4} />
            ) : rankedScores.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users className="w-6 h-6" />}
                  title="No direct applicant matches yet"
                  description="Click 'Re-calculate Match Scores' to evaluate active applicants against this position's requirements."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                      loading={rankCandidatesMutation.isPending}
                      onClick={() => rankCandidatesMutation.mutate()}
                    >
                      Calculate Match Scores
                    </Button>
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
                        <th className="px-4 py-3 font-semibold">Candidate Application</th>
                        <th className="px-4 py-3 font-semibold text-center">Match Score</th>
                        <th className="px-4 py-3 font-semibold text-center">Skills</th>
                        <th className="px-4 py-3 font-semibold text-center">Experience</th>
                        <th className="px-4 py-3 font-semibold text-center">Location</th>
                        <th className="px-4 py-3 font-semibold text-center">Compliance</th>
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
                                  View Application
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
                    totalItems={rankedScores.length}
                    pageSize={candidatePageSize}
                    onPageChange={setCandidatePage}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Discovered Talent Pool Candidates */}
        {activeTab === "talentPool" && (
          <div>
            {talentPoolQuery.isLoading ? (
              <LoadingState variant="cards" />
            ) : talentPoolMatches.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Sparkles className="w-6 h-6 text-teal-600" />}
                  title="No talent pool matches for this requisition"
                  description="All available talent pool members have already been considered or have no matching skill embeddings."
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
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 text-xs font-mono font-bold">
                              <Sparkles className="w-3 h-3 text-teal-600" />
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
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenConsider(c)}
                        >
                          Consider for This Job
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consider Candidate for Job Modal */}
      <Dialog
        open={considerModalOpen}
        onClose={() => setConsiderModalOpen(false)}
        title="Consider Talent Pool Candidate"
        description={
          selectedCandidate
            ? `Reactivate ${selectedCandidate.firstName} ${selectedCandidate.lastName} into a new application for ${job.title}.`
            : "Reactivate talent pool candidate."
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-slate-800">
              Candidate: {selectedCandidate?.firstName} {selectedCandidate?.lastName}
            </div>
            <div className="text-slate-500 font-mono">Email: {selectedCandidate?.email}</div>
            <div className="text-teal-700 font-medium font-sans">
              Requisition: #{job.id} — {job.title}
            </div>
          </div>

          <Select
            label="Initial Contact Outcome"
            value={considerOutcome}
            onChange={(e) => setConsiderOutcome(e.target.value as any)}
            options={[
              { value: "INTERESTED", label: "INTERESTED (Candidate Confirmed Interest)" },
              { value: "NO_RESPONSE", label: "NO RESPONSE (Attempting Outreach)" },
            ]}
          />

          <Textarea
            label="Recruiter Reactivation Notes"
            placeholder="Document notes on candidate qualification for this specific job..."
            value={considerNotes}
            onChange={(e) => setConsiderNotes(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setConsiderModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={considerCandidateMutation.isPending}
              onClick={handleConfirmConsider}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Reactivate & Apply
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Job Modal */}
      <Dialog
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Job Requisition"
        description={`Update requisition #${job.id}`}
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
            });
          }}
          className="space-y-4"
        >
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
              label="Job / Company Image URL (Optional)"
              placeholder="https://example.com/company-banner.jpg"
              value={editImageUrl}
              onChange={(e) => setEditImageUrl(e.target.value)}
            />
          </div>
          <Select
            label="Requisition Status"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as JobStatus)}
            options={[
              { value: JobStatus.OPEN, label: "OPEN" },
              { value: JobStatus.DRAFT, label: "DRAFT" },
              { value: JobStatus.CLOSED, label: "CLOSED" },
            ]}
          />
          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
            required
          />
          <Textarea
            label="Requirements"
            value={editRequirements}
            onChange={(e) => setEditRequirements(e.target.value)}
            rows={3}
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updateJobMutation.isPending}>
              Save Requisition
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
