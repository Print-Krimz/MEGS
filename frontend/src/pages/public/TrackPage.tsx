import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { apiUrl } from "../../lib/api/client";
import { publicApi } from "../../lib/api/public.api";
import { TrackingView } from "../../components/public/TrackingView";
import { ConnectionProblem, LinkProblem, PublicShell, PublicSkeleton, isDeadLink } from "./PublicShell";

const POLL_MS = 20_000;
const LIVE_POLL_MS = 60_000;
const CLOSED_STATUSES = ["DEPLOYED", "REJECTED", "BACKOUT", "ARCHIVED"];

/** Route: /t/$code, search { token }. */
export const TrackPage: React.FC = () => {
  const { code } = useParams({ strict: false }) as { code: string };
  const { token } = useSearch({ strict: false }) as { token?: string };

  const [live, setLive] = React.useState(false);
  const query = useQuery({
    queryKey: ["public", "track", code, token],
    queryFn: ({ signal }) => publicApi.getTracking(code, token ?? "", { signal }),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: true,
    // The applicant leaves this page open at the office, so it follows the recruiter's updates on its own.
    // React Query pauses the timer while the tab is hidden.
    refetchInterval: (q) => (q.state.data && CLOSED_STATUSES.includes(q.state.data.status) ? false : live ? LIVE_POLL_MS : POLL_MS),
  });
  const closed = Boolean(query.data && CLOSED_STATUSES.includes(query.data.status));
  const { connected } = useLiveRefresh({
    url: apiUrl(`/api/public/track/${encodeURIComponent(code)}/stream`),
    headers: { "x-tracking-token": token ?? "" },
    enabled: Boolean(token) && !closed,
    onChange: () => void query.refetch(),
  });
  if (connected !== live) setLive(connected);

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
