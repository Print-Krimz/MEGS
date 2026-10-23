import { useQuery } from "@tanstack/react-query";
import { taProfileReviewApi } from "../../../lib/api/ta-profile-review.api";
import type { ResumeReviewState } from "../../../lib/types/applicant.types";

const POLL_MS = 4000;
const MAX_WAIT_MS = 2 * 60 * 1000;
/** A walk-in is read in the background; for this long after it is created a missing parse still means "reading". */
const WALK_IN_GRACE_MS = 2 * 60 * 1000;

export const resumeProposalKey = (profileId: number | string) => ["ta", "candidate", profileId, "resume-proposal"];

export type ResumeReadState = "reading" | "failed" | "suggestions" | "idle";

/** Pure rule so it can be tested: what the TA should be told about the bio-data reading. */
export const resumeReadState = (
  data: ResumeReviewState | undefined,
  walkInCreatedAt: string | null | undefined,
  now: number,
  hasSuggestions: boolean,
): ResumeReadState => {
  const parse = data?.parse;
  if (parse?.status === "PENDING") return "reading";
  if (!parse && walkInCreatedAt && now - new Date(walkInCreatedAt).getTime() < WALK_IN_GRACE_MS) return "reading";
  if (parse?.status === "FAILED" && !parse.reviewed) return "failed";
  if (hasSuggestions) return "suggestions";
  return "idle";
};

/** Shares the cache with the bio-data review panel. Polls every 4 s while reading, for at most 2 minutes. */
export const useResumeParseState = (profileId: number | string | undefined, walkInCreatedAt?: string | null) => {
  return useQuery({
    queryKey: resumeProposalKey(profileId ?? ""),
    queryFn: () => taProfileReviewApi.getResumeProposal(profileId as number),
    enabled: Boolean(profileId),
    refetchInterval: (query) => {
      const data = query.state.data;
      const waitingSince = new Date(data?.parse?.createdAt ?? walkInCreatedAt ?? 0).getTime();
      const reading = resumeReadState(data, walkInCreatedAt, Date.now(), false) === "reading";
      return reading && Date.now() - waitingSince < MAX_WAIT_MS ? POLL_MS : false;
    },
  });
};
