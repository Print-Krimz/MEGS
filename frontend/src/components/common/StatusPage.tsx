import React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getHomePath } from "../../lib/home-path";
import { cn } from "../../lib/utils";

export interface StatusPageAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

export interface StatusPageProps {
  icon?: React.ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  body?: string;
  primary: StatusPageAction;
  secondary?: StatusPageAction;
  id?: string;
  className?: string;
}

const actionClass = (primary: boolean) =>
  cn(
    "inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
    primary
      ? "bg-navy text-white hover:bg-navy-hover"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
  );

const ActionControl: React.FC<{ action: StatusPageAction; primary: boolean }> = ({ action, primary }) =>
  action.to ? (
    <Link to={action.to} className={actionClass(primary)}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={actionClass(primary)}>
      {action.label}
    </button>
  );

/** Shared layout for 403 / 404 / router error pages. */
export const StatusPage: React.FC<StatusPageProps> = ({
  icon: Icon = AlertTriangle,
  eyebrow,
  title,
  body,
  primary,
  secondary,
  id = "main-content",
  className,
}) => (
  <main id={id} role="main" className={cn("flex min-h-[60vh] items-center justify-center p-4", className)}>
    <div className="w-full max-w-md border border-slate-300 bg-white p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-slate-300 bg-slate-100 text-slate-700">
        <Icon className="h-6 w-6" />
      </div>
      {eyebrow && <p className="mb-1 text-sm font-medium text-slate-500">{eyebrow}</p>}
      <h1 className="mb-2 text-xl font-semibold text-slate-950">{title}</h1>
      {body && <p className="mb-6 text-sm leading-normal text-slate-600">{body}</p>}
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <ActionControl action={primary} primary />
        {secondary && <ActionControl action={secondary} primary={false} />}
      </div>
    </div>
  </main>
);

/** Router defaultErrorComponent. Never shows error.message to users. */
export const RouteErrorPage: React.FC<{ error?: unknown; reset?: () => void }> = ({ error, reset }) => {
  const router = useRouter();
  const { user } = useAuth();

  React.useEffect(() => {
    if (error) console.error("Route error:", error);
  }, [error]);

  return (
    <StatusPage
      title="This page could not be shown."
      body="Try again. If it keeps happening, go back to your workspace."
      primary={{
        label: "Try again",
        onClick: () => {
          reset?.();
          void router.invalidate();
        },
      }}
      secondary={{ label: user ? "Back to your workspace" : "Sign in", to: getHomePath(user) }}
    />
  );
};
