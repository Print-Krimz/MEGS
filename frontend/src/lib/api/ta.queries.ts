import { queryOptions } from "@tanstack/react-query";
import { taApi } from "./ta.api";
import { taProfileReviewApi } from "./ta-profile-review.api";
import { REFERENCE_QUERY_STALE_TIME_MS, getApplicationRefetchInterval } from "../query-policies";
import type { ResumeReviewState } from "../types/applicant.types";

/**
 * Shared by the candidate detail page and its route loader, so a hover preload fills the same cache entries.
 * Keys are matched by stream invalidations and mutations: do not rename them.
 */

export const taApplicationDetailQuery = (id: number | string, connected = false) =>
  queryOptions({
    queryKey: ["ta", "application", id],
    queryFn: () => taApi.getApplication(id),
    enabled: Boolean(id),
    // Safety net for a change the live stream missed (applicant upload, another recruiter).
    refetchInterval: (query) => getApplicationRefetchInterval(query.state.data, connected),
  });

export const taApplicationDecisionsQuery = (id: number | string) =>
  queryOptions({
    queryKey: ["ta", "application", id, "decisions"],
    queryFn: () => taApi.getRecruiterDecisions(id),
    enabled: Boolean(id),
  });

export const taClientsQuery = () =>
  queryOptions({
    queryKey: ["ta", "clients"],
    queryFn: ({ signal }) => taApi.listClients({ signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

const POLL_MS = 4000;
const MAX_WAIT_MS = 2 * 60 * 1000;
/** A resume is read in the background; for this long after it was uploaded a missing parse still means "reading". */
const RECENT_UPLOAD_MS = 2 * 60 * 1000;

export const resumeProposalKey = (profileId: number | string) => ["ta", "candidate", profileId, "resume-proposal"];

export type ResumeReadState = "reading" | "failed" | "unread" | "suggestions" | "idle";

/** Pure rule so it can be tested: what the TA should be told about the bio-data reading. */
export const resumeReadState = (
  data: ResumeReviewState | undefined,
  /** When the resume arrived (the application date), or null when there is no resume to read. */
  uploadedAt: string | null | undefined,
  now: number,
  hasSuggestions: boolean,
): ResumeReadState => {
  const parse = data?.parse;
  if (parse?.status === "PENDING") return "reading";
  if (!parse && uploadedAt && now - new Date(uploadedAt).getTime() < RECENT_UPLOAD_MS) return "reading";
  if (parse?.status === "FAILED" && !parse.reviewed) return "failed";
  if (hasSuggestions) return "suggestions";
  // A resume that was never read, e.g. uploaded before reading existed. Only once the lookup has answered.
  if (data && !parse && uploadedAt) return "unread";
  return "idle";
};

/** Shares the cache with the bio-data review panel. Polls every 4 s while reading, for at most 2 minutes. */
export const resumeParseStateQuery = (profileId: number | string | undefined, uploadedAt?: string | null) =>
  queryOptions({
    queryKey: resumeProposalKey(profileId ?? ""),
    queryFn: () => taProfileReviewApi.getResumeProposal(profileId as number),
    enabled: Boolean(profileId),
    refetchInterval: (query) => {
      const data = query.state.data;
      const waitingSince = new Date(data?.parse?.createdAt ?? uploadedAt ?? 0).getTime();
      const reading = resumeReadState(data, uploadedAt, Date.now(), false) === "reading";
      return reading && Date.now() - waitingSince < MAX_WAIT_MS ? POLL_MS : false;
    },
  });
