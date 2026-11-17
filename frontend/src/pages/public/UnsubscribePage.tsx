import React from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Spinner } from "@/components/shadcn/spinner";
import { publicApi } from "../../lib/api/public.api";
import { formatErrorMessage } from "../../lib/feedback";
import { LinkProblem, PublicShell } from "./PublicShell";

/** Route: /unsubscribe, search { token }. The button is deliberate: mail scanners that open links must not unsubscribe anyone. */
export const UnsubscribePage: React.FC = () => {
  const { token } = useSearch({ strict: false }) as { token?: string };
  const unsubscribe = useMutation({ mutationFn: () => publicApi.unsubscribeJobAlerts(token ?? "") });

  if (!token) {
    return (
      <PublicShell title="Job alerts">
        <LinkProblem title="Link not working" message="This link is not complete. Use the unsubscribe link in your job alert email, or turn alerts off in Settings after you sign in." />
      </PublicShell>
    );
  }

  if (unsubscribe.isSuccess) {
    return (
      <PublicShell title="Job alerts">
        <div role="status" className="rounded-lg border border-border bg-background p-6">
          <CheckCircle2 className="mb-3 size-8 text-success" aria-hidden="true" />
          <h1 className="font-display text-2xl leading-tight text-secondary">You are unsubscribed</h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            You will not get job alert emails any more. You can turn them back on in Settings after you sign in.
          </p>
          <Link to="/login" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">
            Sign in to MEGS
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="Job alerts">
      <div className="rounded-lg border border-border bg-background p-6">
        <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-primary" />
        <h1 className="font-display text-2xl leading-tight text-secondary">Stop job alert emails?</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          You will no longer get emails about jobs that match your profile. You can still see them in your MEGS account.
        </p>
        {unsubscribe.isError && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">{formatErrorMessage(unsubscribe.error)}</p>
        )}
        <Button className="mt-5 min-h-11" onClick={() => unsubscribe.mutate()} disabled={unsubscribe.isPending}>
          {unsubscribe.isPending && <Spinner className="mr-2" />}
          Stop job alert emails
        </Button>
      </div>
    </PublicShell>
  );
};
