import { useQuery } from "@tanstack/react-query";
import { taApi } from "../lib/api/ta.api";
import { getJobCandidateQueryEnabled, type JobCandidateView } from "../lib/job-candidate-query-policy";

export function useJobCandidateQueries(jobId: string | undefined, activeView: JobCandidateView) {
  const enabled = getJobCandidateQueryEnabled(jobId, activeView);

  const rankedCandidatesQuery = useQuery({
    queryKey: ["ta", "job", jobId, "ranked"],
    queryFn: ({ signal }) => taApi.getRankedCandidates(jobId!, { signal }),
    enabled: enabled.rankedCandidates,
  });

  const talentPoolQuery = useQuery({
    queryKey: ["ta", "job", jobId, "talent-pool"],
    queryFn: ({ signal }) => taApi.getJobTalentPool(jobId!, { signal }),
    enabled: enabled.talentPool,
  });

  return { rankedCandidatesQuery, talentPoolQuery };
}
