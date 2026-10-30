import React from "react";
import { ApiError } from "../../lib/api/client";

/** Plain mobile-first frame for the no-login pages (tracking slip, offer link). */
export const PublicShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="theme-megs min-h-screen bg-muted/40 text-foreground">
    <title>{`${title} | MEGS`}</title>
    <meta name="robots" content="noindex" />
    <header className="bg-megs-navy-900 text-white">
      <div className="mx-auto flex h-14 max-w-xl items-center px-4">
        <span className="font-display text-lg tracking-wide">MEGS</span>
      </div>
    </header>
    <main id="main" className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      {children}
    </main>
  </div>
);

export const LinkProblem: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div role="alert" className="rounded-lg border border-border bg-background p-6">
    <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-primary" />
    <h1 className="font-display text-2xl leading-tight text-secondary">{title}</h1>
    <p className="mt-2 text-base leading-relaxed text-muted-foreground">{message}</p>
  </div>
);

/** The server answers 404 for a wrong, used or expired link. Anything else is a connection problem worth retrying. */
export const isDeadLink = (error: unknown): boolean => error instanceof ApiError && error.status === 404;

export const ConnectionProblem: React.FC<{ onRetry: () => void; retrying: boolean }> = ({ onRetry, retrying }) => (
  <div role="alert" className="rounded-lg border border-border bg-background p-6">
    <h1 className="font-display text-2xl leading-tight text-secondary">Can't load this page</h1>
    <p className="mt-2 text-base leading-relaxed text-muted-foreground">
      Check your mobile data or Wi-Fi, then try again.
    </p>
    <button
      type="button"
      onClick={onRetry}
      disabled={retrying}
      className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
    >
      {retrying ? "Trying again..." : "Try again"}
    </button>
  </div>
);

export const PublicSkeleton: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading</span>
    <div className="h-8 w-2/3 animate-pulse rounded bg-border" />
    <div className="h-5 w-1/2 animate-pulse rounded bg-border" />
    <div className="h-40 animate-pulse rounded-lg bg-border" />
    <div className="h-24 animate-pulse rounded-lg bg-border" />
  </div>
);
