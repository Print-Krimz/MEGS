import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { applicantJobsApi, type JobPosting } from "../../../lib/api/applicant-jobs.api";
import type { PaginatedListResponse } from "../../../lib/types/api.types";
import { MAX_SAVED_JOBS } from "../../../lib/saved-jobs";
import { notify } from "../../../lib/feedback";

const SAVED_IDS_KEY = ["applicant", "saved-jobs", "ids"] as const;

interface BookmarkQueueState {
  targets: Map<number, boolean>;
  activeWorkers: Set<number>;
}

const clientQueues = new WeakMap<QueryClient, BookmarkQueueState>();

function getQueueState(queryClient: QueryClient): BookmarkQueueState {
  let state = clientQueues.get(queryClient);
  if (!state) {
    state = { targets: new Map<number, boolean>(), activeWorkers: new Set<number>() };
    clientQueues.set(queryClient, state);
  }
  return state;
}

function updateCachedSavedState(queryClient: QueryClient, jobId: number, saved: boolean) {
  queryClient.setQueryData<number[]>(SAVED_IDS_KEY, (ids = []) =>
    saved ? [...new Set([...ids, jobId])] : ids.filter((id) => id !== jobId),
  );

  // Immediately drop unsaved cards from cached "Saved Jobs" pages so the tab matches the bookmark click right away.
  if (!saved) {
    queryClient.setQueriesData<PaginatedListResponse<JobPosting> | JobPosting[]>(
      { queryKey: ["applicant", "jobs", "saved"] },
      (old) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.filter((item) => item.id !== jobId);
        if (Array.isArray(old.items)) {
          const nextItems = old.items.filter((item) => item.id !== jobId);
          const removed = old.items.length - nextItems.length;
          return removed > 0
            ? { ...old, items: nextItems, total: Math.max(0, (old.total ?? 0) - removed) }
            : old;
        }
        return old;
      },
    );
  }
}

/** Bookmark state and single-click save/unsave queue shared across applicant job pages. */
export const useSavedJobs = () => {
  const queryClient = useQueryClient();
  const idsQuery = useQuery({ queryKey: SAVED_IDS_KEY, queryFn: applicantJobsApi.getSavedJobIds });
  const savedJobIds = new Set(idsQuery.data || []);
  const savedCount = savedJobIds.size;
  const atSaveLimit = savedCount >= MAX_SAVED_JOBS;

  const toggleBookmark = useCallback(
    (jobId: number) => {
      if (!Number.isFinite(jobId)) return;
      const queue = getQueueState(queryClient);

      // Read live cache rather than render closure so rapid clicks always toggle from latest state.
      const currentIds = queryClient.getQueryData<number[]>(SAVED_IDS_KEY) ?? idsQuery.data ?? [];
      const currentlySaved = currentIds.includes(jobId);
      const nextSaved = !currentlySaved;

      if (nextSaved && currentIds.length >= MAX_SAVED_JOBS) {
        notify.error("Saved Jobs Limit", `You can save up to ${MAX_SAVED_JOBS} jobs. Remove one to save another.`);
        return;
      }

      void queryClient.cancelQueries({ queryKey: SAVED_IDS_KEY });
      updateCachedSavedState(queryClient, jobId, nextSaved);
      queue.targets.set(jobId, nextSaved);

      if (queue.activeWorkers.has(jobId)) {
        return;
      }

      queue.activeWorkers.add(jobId);

      void (async () => {
        let attemptedSaved = nextSaved;
        let failed = false;

        try {
          while (queue.targets.has(jobId)) {
            const desired = queue.targets.get(jobId)!;
            queue.targets.delete(jobId);
            attemptedSaved = desired;

            if (desired) {
              await applicantJobsApi.saveJob(jobId);
            } else {
              await applicantJobsApi.unsaveJob(jobId);
            }
          }
        } catch (err: any) {
          failed = true;
          queue.targets.delete(jobId);
          updateCachedSavedState(queryClient, jobId, !attemptedSaved);
          notify.error(attemptedSaved ? "Save Failed" : "Action Failed", err);
        } finally {
          queue.activeWorkers.delete(jobId);
          if (!failed) {
            notify.success(
              attemptedSaved ? "Job Saved" : "Job Removed",
              attemptedSaved
                ? "Position added to your saved jobs."
                : "Position removed from your saved jobs.",
            );
          }

          // Defer invalidation until all per-job bookmark requests settle so refetches never clobber in-flight toggles.
          if (queue.activeWorkers.size === 0) {
            queryClient.invalidateQueries({ queryKey: ["applicant", "jobs"] });
            queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
          }
        }
      })();
    },
    [idsQuery.data, queryClient],
  );

  return { savedJobIds, savedCount, atSaveLimit, savedIdsLoading: idsQuery.isLoading, toggleBookmark };
};
