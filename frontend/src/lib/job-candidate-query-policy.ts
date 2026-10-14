export type JobCandidateView = "applicants" | "talentPool";

export function getInitialJobCandidateView(search: string): JobCandidateView {
  return new URLSearchParams(search).get("tab") === "talentPool" ? "talentPool" : "applicants";
}

export function getJobCandidateQueryEnabled(jobId: string | undefined, activeView: JobCandidateView) {
  const hasJobId = Boolean(jobId);
  return {
    rankedCandidates: hasJobId && activeView === "applicants",
    talentPool: hasJobId && activeView === "talentPool",
  };
}
