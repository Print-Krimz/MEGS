import React from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Check, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Role } from "../lib/types/enums";
import { MotionRoot } from "../components/public/motion";
import { Button } from "@/components/shadcn/button";

const PANEL_COPY: Record<string, { title: string; points: string[] }> = {
  "/login": {
    title: "Pick up where you left off.",
    points: ["Track every application in one place", "Keep your documents and profile current", "See where you stand at every hiring stage"],
  },
  "/register": {
    title: "Start your MEGS application.",
    points: ["Search open positions from MEGS and its client companies", "Upload your documents once and reuse them", "Follow each application from review to deployment"],
  },
  setup: {
    title: "Set up your staff account.",
    points: ["Choose a strong password you do not reuse", "Add an authenticator app for two-step verification", "Sign in and open your workspace"],
  },
  change: {
    title: "Keep your account secure.",
    points: ["Use a password you do not use anywhere else", "Sign out when you use a shared device", "We never ask for your password by email"],
  },
  default: {
    title: "Your account, kept secure.",
    points: ["Email verification protects every account", "Sign out when you use a shared device", "We never ask for your password by email"],
  },
};

export const AuthLayout: React.FC = () => {
  const { isAuthenticated, user, mustChangePassword, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panel =
    PANEL_COPY[pathname] ??
    (pathname.startsWith("/setup-account") ? PANEL_COPY.setup : pathname.startsWith("/change-password") ? PANEL_COPY.change : PANEL_COPY.default);
  const showHelp = ["/login", "/forgot-password", "/reset-password"].includes(pathname);

  const getBackDestination = () => {
    if (!isAuthenticated) return { to: "/", label: "Back to MEGS home" };
    if (mustChangePassword) return null;
    if (user?.role === Role.ADMINISTRATOR) return { to: "/admin", label: "Back to Admin Portal" };
    if (user?.role === Role.TALENT_ACQUISITION) return { to: "/ta", label: "Back to TA Portal" };
    return { to: "/app", label: "Back to Applicant Portal" };
  };

  const backDest = getBackDestination();
  const portalHome =
    !isAuthenticated || mustChangePassword
      ? "/"
      : user?.role === Role.ADMINISTRATOR
        ? "/admin"
        : user?.role === Role.TALENT_ACQUISITION
          ? "/ta"
          : "/app";

  return (
    <MotionRoot>
      <div className="theme-megs min-h-screen bg-background text-foreground md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <a
          href="#auth-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-secondary focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        {/* Brand panel (tablet and up) */}
        <aside className="hidden border-t-4 border-primary bg-megs-navy-900 text-white md:block">
          <div className="sticky top-0 flex h-screen flex-col gap-8 p-8 lg:p-12">
            <Link
              to={portalHome}
              className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <img src="/images/canva-ref/megs-logo-480.jpg" alt="" width={480} height={348} className="h-14 w-auto rounded-md bg-white p-1" />
              <span className="flex flex-col leading-none">
                <span className="flex flex-col leading-none">
                  <span className="font-display text-2xl text-white">MEGS Inc.</span>
                  <span className="mt-1 text-xs font-medium text-white/80">MAR Employment for Good Services</span>
                </span>
              </span>
            </Link>

            <div className="mt-16 flex max-w-md flex-col lg:mt-24">
              <p className="font-display text-4xl leading-[1.08] text-balance lg:text-5xl">{panel.title}</p>
              <ul className="mt-10 border-t border-white/15">
                {panel.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 border-b border-white/15 py-4 text-base text-white/90">
                    <Check className="mt-0.5 size-5 shrink-0 text-white" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-auto text-pretty text-sm text-white/70">Licensed by DOLE · PJAR Group company · PALSCON member</p>
          </div>
        </aside>

        {/* Form column */}
        <div className="flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12">
          <header className="mx-auto flex w-full max-w-[26rem] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {backDest ? (
                <Button asChild variant="ghost" size="sm" className="-ml-3 min-h-11 text-muted-foreground hover:text-secondary">
                  <Link to={backDest.to}>
                    <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                    {backDest.label}
                  </Link>
                </Button>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">Account security update</span>
              )}
            </div>
            {isAuthenticated && (
              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => logout()} title="Sign out">
                <LogOut data-icon="inline-start" aria-hidden="true" />
                Sign out
              </Button>
            )}
          </header>

          <main
            id="auth-main"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-start pb-8 pt-6 focus:outline-none lg:pt-20"
          >
            <Link
              to={portalHome}
              className="mb-8 flex min-h-11 w-fit items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              <img src="/images/canva-ref/megs-logo-480.jpg" alt="" width={480} height={348} className="h-12 w-auto shrink-0 object-contain" />
              <span className="text-base font-semibold text-foreground">MEGS Inc.</span>
            </Link>
            <Outlet />
          </main>

          <footer className="mx-auto flex w-full max-w-[26rem] flex-col gap-1 pt-4 text-sm text-muted-foreground">
            {showHelp && (
              <p>
                Need help signing in?{" "}
                <Link
                  to="/"
                  hash="contact"
                  className="inline-block rounded-sm py-2 font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Contact MEGS
                </Link>
              </p>
            )}
            <p>
              © {new Date().getFullYear()} MAR Employment for Good Services Inc.
              <span className="block">Licensed by DOLE</span>
            </p>
          </footer>
        </div>
      </div>
    </MotionRoot>
  );
};
