import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { CheckCircle2, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Spinner } from "@/components/shadcn/spinner";
import { publicApi } from "../../lib/api/public.api";
import { OFFER_DECLINE_REASONS, type OfferDeclineReason } from "../../lib/types/public.types";
import { formatDate } from "../../lib/utils";
import { formatErrorMessage } from "../../lib/feedback";
import { ConnectionProblem, LinkProblem, PublicShell, PublicSkeleton, isDeadLink } from "./PublicShell";

type Step = "view" | "confirm-accept" | "decline" | "done";

/** Route: /offer/$id, search { token }. */
export const OfferPage: React.FC = () => {
  const { id } = useParams({ strict: false }) as { id: string };
  const { token } = useSearch({ strict: false }) as { token?: string };
  const [step, setStep] = useState<Step>("view");
  const [reason, setReason] = useState<OfferDeclineReason | "">("");
  const [outcome, setOutcome] = useState<"ACCEPTED" | "DECLINED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["public", "offer", id, token],
    queryFn: ({ signal }) => publicApi.getOffer(id, token ?? "", { signal }),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const respond = useMutation({
    mutationFn: (decision: "ACCEPT" | "DECLINE") =>
      publicApi.respondOffer(id, {
        token: token ?? "",
        decision,
        declineReason: decision === "DECLINE" && reason ? reason : undefined,
      }),
    onSuccess: (res) => {
      setOutcome(res.status);
      setStep("done");
    },
    onError: (err) => setError(formatErrorMessage(err)),
  });

  const offer = query.data;

  if (token && query.isError && !isDeadLink(query.error)) {
    return (
      <PublicShell>
        <ConnectionProblem onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </PublicShell>
    );
  }
  if (!token || query.isError) {
    return (
      <PublicShell>
        <LinkProblem
          title="Link not working"
          message="This link no longer works. Ask your MEGS recruiter to send a new one."
        />
      </PublicShell>
    );
  }
  if (query.isLoading || !offer) {
    return (
      <PublicShell>
        <PublicSkeleton />
      </PublicShell>
    );
  }

  if (step === "done" || offer.status !== "PENDING") {
    const result =
      outcome ?? (offer.status === "ACCEPTED" ? "ACCEPTED" : offer.status === "DECLINED" ? "DECLINED" : null);
    return (
      <PublicShell>
        <div role="status" className="rounded-lg border border-border bg-background p-6">
          <CheckCircle2 className="mb-3 size-8 text-success" aria-hidden="true" />
          <h1 className="font-display text-2xl leading-tight text-secondary">
            {result === "ACCEPTED"
              ? "You accepted this offer"
              : result === "DECLINED"
                ? "You declined this offer"
                : "This offer is closed"}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {result === "ACCEPTED"
              ? `Your application for ${offer.jobTitle} is in. A MEGS recruiter will contact you with the next step.`
              : result === "DECLINED"
                ? "Thank you for letting us know. We will keep you in mind for other openings."
                : "It was answered, cancelled or has expired. Ask your MEGS recruiter if you have questions."}
          </p>
        </div>
      </PublicShell>
    );
  }

  const busy = respond.isPending;

  return (
    <PublicShell>
      <div className="space-y-5">
        <div>
          <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-primary" />
          <p className="text-sm text-muted-foreground">Hi {offer.applicantFirstName}, you have a job offer</p>
          <h1 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">{offer.jobTitle}</h1>
          {offer.clientName && <p className="mt-1 text-base">{offer.clientName}</p>}
        </div>

        <dl className="space-y-3 rounded-lg border border-border bg-background p-4 text-base">
          {offer.location && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-sm text-muted-foreground">Location</dt>
                <dd className="font-medium">{offer.location}</dd>
              </div>
            </div>
          )}
          {offer.expiresAt && (
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-sm text-muted-foreground">Reply by</dt>
                <dd className="font-medium">{formatDate(offer.expiresAt)}</dd>
              </div>
            </div>
          )}
          {offer.message && (
            <div>
              <dt className="text-sm text-muted-foreground">Message from MEGS</dt>
              <dd className="mt-0.5 whitespace-pre-line">{offer.message}</dd>
            </div>
          )}
        </dl>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {step === "view" && (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={() => {
                setError(null);
                setStep("decline");
              }}
            >
              Decline
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              onClick={() => {
                setError(null);
                setStep("confirm-accept");
              }}
            >
              Accept
            </Button>
          </div>
        )}

        {step === "confirm-accept" && (
          <section aria-labelledby="confirm-title" className="space-y-4 rounded-lg border border-border bg-background p-4">
            <h2 id="confirm-title" className="text-lg font-semibold text-secondary">
              Accept this offer?
            </h2>
            <p className="text-base text-muted-foreground">
              We will submit your application for {offer.jobTitle}. You cannot change this answer from this page.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setStep("view")}>
                Cancel
              </Button>
              <Button type="button" className="min-h-11" disabled={busy} onClick={() => respond.mutate("ACCEPT")}>
                {busy && <Spinner data-icon="inline-start" />}
                Yes, accept
              </Button>
            </div>
          </section>
        )}

        {step === "decline" && (
          <section aria-labelledby="decline-title" className="space-y-4 rounded-lg border border-border bg-background p-4">
            <fieldset className="space-y-2" disabled={busy}>
              <legend id="decline-title" className="text-lg font-semibold text-secondary">
                Decline this offer
              </legend>
              <p className="text-sm text-muted-foreground">Why are you declining? You can skip this.</p>
              {OFFER_DECLINE_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-base has-[:checked]:border-secondary has-[:checked]:bg-muted"
                >
                  <input
                    type="radio"
                    name="decline-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="size-4 accent-[var(--color-secondary)]"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setStep("view")}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" className="min-h-11" disabled={busy} onClick={() => respond.mutate("DECLINE")}>
                {busy && <Spinner data-icon="inline-start" />}
                Decline offer
              </Button>
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
};

export default OfferPage;
