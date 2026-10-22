import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MapPin } from "lucide-react";
import { useParams, useSearch } from "@tanstack/react-router";
import { publicApi } from "../../lib/api/public.api";
import { PipelineIndicator } from "../../components/common/PipelineIndicator";
import { formatDate, formatDateTime } from "../../lib/utils";
import { ConnectionProblem, LinkProblem, PublicShell, PublicSkeleton, isDeadLink } from "./PublicShell";

const INTERVIEW_LABELS: Record<string, string> = {
  INITIAL_SCREENING: "Initial interview",
  FINAL_INTERVIEW: "Final interview",
};

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
        <div className="space-y-5">
          <div>
            <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">Application for</p>
            <h1 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">{data.jobTitle}</h1>
            <p className="mt-1 text-base text-foreground">
              {data.applicantName}
              {data.clientName ? ` · ${data.clientName}` : ""}
            </p>
          </div>

          <section aria-label="Application progress" className="rounded-lg border border-border bg-background p-4">
            <PipelineIndicator currentStatus={data.status} audience="applicant" />
          </section>

          <section aria-labelledby="next-visit" className="rounded-lg border border-border bg-background p-4">
            <h2 id="next-visit" className="text-base font-semibold text-secondary">
              Next interview
            </h2>
            {data.nextInterview ? (
              <dl className="mt-3 space-y-3 text-base">
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="sr-only">When</dt>
                    <dd className="font-medium">{formatDateTime(data.nextInterview.scheduledAt)}</dd>
                    <dd className="text-sm text-muted-foreground">
                      {INTERVIEW_LABELS[data.nextInterview.type] ?? "Interview"}
                    </dd>
                  </div>
                </div>
                {data.venue && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Where</dt>
                      <dd className="font-medium">{data.venue}</dd>
                    </div>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-2 text-base text-muted-foreground">
                No interview is scheduled yet. Your recruiter will contact you when one is set.
              </p>
            )}
          </section>

          <p className="text-sm text-muted-foreground">
            Tracking code <span className="font-mono font-semibold text-foreground">{data.trackingCode}</span>. Applied{" "}
            {formatDate(data.appliedAt)}. Last updated {formatDateTime(data.updatedAt)}.
          </p>
        </div>
      )}
    </PublicShell>
  );
};

export default TrackPage;
