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
} from "lucide-react";

export const JobPostingDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { jobId } = useParams({ strict: false }) as { jobId: string };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editStatus, setEditStatus] = useState<JobStatus>(JobStatus.OPEN);

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

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const rankCandidatesMutation = useMutation({
    mutationFn: () => taApi.rankCandidates(jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "ranked"] });
      const count = data?.rankedCount ?? 0;
      setFeedback({
        type: "success",
        message: `Candidate match ranking updated. Evaluated ${count} candidate profile${count === 1 ? "" : "s"}.`,
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: `Failed to match candidates: ${err.message}`,
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: (data: any) => taApi.updateJob(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId] });
      setEditModalOpen(false);
    },
  });

  const job = jobQuery.data;

  // Initialize edit form when job loads
  React.useEffect(() => {
    if (job) {
      setEditTitle(job.title);
      setEditLocation(job.location || "");
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
  const totalPages = Math.max(1, Math.ceil(rankedScores.length / candidatePageSize));
  const paginatedScores = rankedScores.slice(
    (candidatePage - 1) * candidatePageSize,
    candidatePage * candidatePageSize
  );

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
              Find Matching Candidates
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

      {/* Candidate Match Results Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Matching Candidates ({rankedScores.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Evaluated across skills, experience, location, compliance readiness, and education
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-600" />}
            loading={rankCandidatesMutation.isPending}
            onClick={() => rankCandidatesMutation.mutate()}
          >
            Refresh Match Scores
          </Button>
        </div>

        {rankedCandidatesQuery.isLoading ? (
          <LoadingState variant="table" rows={4} />
        ) : rankedScores.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="No candidate matches yet"
              description="Click 'Find Matching Candidates' to evaluate active applicants against this position's requirements."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  loading={rankCandidatesMutation.isPending}
                  onClick={() => rankCandidatesMutation.mutate()}
                >
                  Find Matching Candidates
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
                    return (
                      <tr key={score.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                          #{globalRank}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 font-sans">
                            Application #{score.applicationId}
                          </div>
                          <div className="text-[11px] text-slate-400">
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
          <Input
            label="Location"
            value={editLocation}
            onChange={(e) => setEditLocation(e.target.value)}
          />
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
