import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "../../components/common";
import { Button } from "../../components/ui";
import { notify } from "../../lib/feedback";
import { JobCard } from "./components/JobCard";
import { useSavedJobs } from "./hooks/useSavedJobs";

const PAGE_SIZE = 20;
export const RECOMMENDATIONS_KEY = ["applicant", "recommendations"] as const;

export const RecommendedJobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { savedJobIds, atSaveLimit, toggleBookmark } = useSavedJobs();

  const query = useQuery({
    queryKey: [...RECOMMENDATIONS_KEY, PAGE_SIZE],
    queryFn: ({ signal }) => applicantJobsApi.getRecommendations(PAGE_SIZE, { signal }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });

  const undoMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.undoDismissRecommendation(jobId),
    onSuccess: refresh,
    onError: (err: unknown) => notify.error("Could not restore the job", err),
  });

  const dismissMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.dismissRecommendation(jobId),
    onSuccess: (_result, jobId) => {
      refresh();
      toast("Job hidden from your recommendations", {
        action: { label: "Undo", onClick: () => undoMutation.mutate(jobId) },
      });
    },
    onError: (err: unknown) => notify.error("Could not hide the job", err),
  });

  const items = query.data?.items ?? [];
  const coldStart = query.data?.coldStart ?? false;
  const waitingForNetwork = query.fetchStatus === "paused" && query.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommended for you"
        description="Open jobs that fit your skills, experience and preferred work areas."
        breadcrumbs={[{ label: "My career", href: "/app" }, { label: "Recommended for you" }]}
      />

      {coldStart && items.length > 0 && (
        <div className="rounded-lg border border-navy-line bg-navy-soft p-4" role="status">
          <p className="text-sm text-slate-700">
            These are the newest openings. <Link to="/app/profile" className="font-medium text-navy underline underline-offset-4">Add your skills or upload a resume</Link> to see jobs that match you.
          </p>
        </div>
      )}

      {query.isLoading ? (
        <LoadingState variant="cards" rows={4} className="my-0! content-start gap-4! lg:grid-cols-2!" />
      ) : query.isError || waitingForNetwork ? (
        <ErrorState subject="recommended jobs" error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8">
          <EmptyState
            bare
            icon={<Sparkles className="size-5 text-navy" aria-hidden="true" />}
            title="No matches right now"
            description="We will show new jobs here as they open. Keeping your skills and work preferences up to date gives better matches."
            action={
              <Link to="/app/jobs">
                <Button variant="primary" size="md">Browse all openings</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {items.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              reasons={job.reasons}
              saved={savedJobIds.has(job.id)}
              saveDisabled={atSaveLimit}
              onToggleSave={toggleBookmark}
              onDismiss={(jobId) => !dismissMutation.isPending && dismissMutation.mutate(jobId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
