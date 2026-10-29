import { useQuery } from "@tanstack/react-query";
import { resumeParseStateQuery } from "../../../lib/api/ta.queries";

export { resumeProposalKey, resumeReadState, type ResumeReadState } from "../../../lib/api/ta.queries";

/** Shares the cache with the bio-data review panel. Polls every 4 s while reading, for at most 2 minutes. */
export const useResumeParseState = (profileId: number | string | undefined, uploadedAt?: string | null) =>
  useQuery(resumeParseStateQuery(profileId, uploadedAt));
