import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi } from "../../../lib/api/applicant-jobs.api";
import { MAX_SAVED_JOBS } from "../../../lib/saved-jobs";
import { notify } from "../../../lib/feedback";

const SAVED_IDS_KEY = ["applicant", "saved-jobs", "ids"];

/** Bookmark state and the save/unsave action shared by the job list and the recommendations page. */
export const useSavedJobs = () => {
  const queryClient = useQueryClient();
  const idsQuery = useQuery({ queryKey: SAVED_IDS_KEY, queryFn: applicantJobsApi.getSavedJobIds });
  const savedJobIds = new Set(idsQuery.data || []);

  // Flip the id in the cache at once so the bookmark fills without waiting for the server.
  const optimisticallySetSaved = async (jobId: number, saved: boolean) => {
    await queryClient.cancelQueries({ queryKey: SAVED_IDS_KEY });
    const previous = queryClient.getQueryData<number[]>(SAVED_IDS_KEY);
    queryClient.setQueryData<number[]>(SAVED_IDS_KEY, (ids = []) =>
      saved ? [...new Set([...ids, jobId])] : ids.filter((id) => id !== jobId),
    );
    return { previous };
  };
  const rollbackSaved = (context?: { previous?: number[] }) => {
    if (context?.previous) queryClient.setQueryData(SAVED_IDS_KEY, context.previous);
  };
  const refreshSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["applicant", "jobs"] });
    queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
  };

  const saveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.saveJob(jobId),
    onMutate: (jobId) => optimisticallySetSaved(jobId, true),
    onSuccess: () => notify.success("Job Saved", "Position added to your saved jobs."),
    onError: (err: any, _jobId, context) => {
      rollbackSaved(context);
      notify.error("Save Failed", err);
    },
    onSettled: refreshSaved,
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.unsaveJob(jobId),
    onMutate: (jobId) => optimisticallySetSaved(jobId, false),
    onSuccess: () => notify.success("Job Removed", "Position removed from your saved jobs."),
    onError: (err: any, _jobId, context) => {
      rollbackSaved(context);
      notify.error("Action Failed", err);
    },
    onSettled: refreshSaved,
  });

  const savedCount = savedJobIds.size;
  const atSaveLimit = savedCount >= MAX_SAVED_JOBS;

  const toggleBookmark = (jobId: number) => {
    if (saveMutation.isPending || unsaveMutation.isPending) return;
    if (!savedJobIds.has(jobId) && atSaveLimit) {
      notify.error("Saved Jobs Limit", `You can save up to ${MAX_SAVED_JOBS} jobs. Remove one to save another.`);
      return;
    }
    if (savedJobIds.has(jobId)) unsaveMutation.mutate(jobId);
    else saveMutation.mutate(jobId);
  };

  return { savedJobIds, savedCount, atSaveLimit, savedIdsLoading: idsQuery.isLoading, toggleBookmark };
};
