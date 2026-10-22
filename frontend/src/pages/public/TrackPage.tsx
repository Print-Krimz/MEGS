import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { publicApi } from "../../lib/api/public.api";
import { TrackingView } from "../../components/public/TrackingView";
import { ConnectionProblem, LinkProblem, PublicShell, PublicSkeleton, isDeadLink } from "./PublicShell";

const POLL_MS = 20_000;
const CLOSED_STATUSES = ["DEPLOYED", "REJECTED", "BACKOUT", "ARCHIVED"];

/** Route: /t/$code, search { token }. */
export const TrackPage: React.FC = () => {
  const { code } = useParams({ strict: false }) as { code: string };
  const { token } = useSearch({ strict: false }) as { token?: string };

  const query = useQuery({
    queryKey: ["public", "track", code, token],
    queryFn: ({ signal }) => publicApi.getTracking(code, token ?? "", { signal }),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: true,
    // The applicant leaves this page open at the office, so it follows the recruiter's updates on its own.
    // React Query pauses the timer while the tab is hidden.
    refetchInterval: (q) => (q.state.data && CLOSED_STATUSES.includes(q.state.data.status) ? false : POLL_MS),
  });

  const broken = !token || (query.isError && isDeadLink(query.error));
  const data = query.data;

  return (
    <PublicShell>
      {broken ? (
        <LinkProblem
          title="Link not working"
          message="This link no longer works. Ask your MEGS recruiter for a new slip."
        />
      ) : query.isError ? (
        <ConnectionProblem onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : query.isLoading || !data ? (
        <PublicSkeleton />
      ) : (
        <TrackingView data={data} />
      )}
    </PublicShell>
  );
};

export default TrackPage;
