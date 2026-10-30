import React from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Check, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Role } from "../lib/types/enums";
import { AnimatePresence, EASE_OUT, LineReveal, MotionRoot, m, staggerItem, useReducedMotion } from "../components/public/motion";
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

/** Licensed stock photos already used on the landing page; see src/assets/megs/README.md for sources. */
const PANEL_PHOTOS = [
  { base: "/images/canva-ref/industries/warehousing", label: "Warehousing", alt: "Forklift moving pallets in a warehouse", pos: "object-[22%_72%]" },
  { base: "/images/stock/industries/manufacturing", label: "Manufacturing", alt: "Workers in blue uniforms at a factory assembly line", pos: "object-center" },
  { base: "/images/stock/industries/logistics", label: "Logistics", alt: "Driver in a high-visibility jacket at the back of a truck", pos: "object-[30%_55%]" },
];

export const AuthLayout: React.FC = () => {
  const reduceMotion = useReducedMotion();
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
      <meta name="robots" content="noindex" />
      <div className="theme-megs min-h-screen bg-background text-foreground md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <a
          href="#auth-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-secondary focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        {/* Brand panel (tablet and up): the landing hero's navy surface, motto and industry photos. */}
        <aside className="relative hidden overflow-hidden bg-megs-navy-900 text-white md:block">
          <m.span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 z-10 h-1 origin-left bg-primary"
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
          />
          <div className="sticky top-0 flex h-screen flex-col gap-8 p-8 lg:p-12">
            <Link
              to={portalHome}
              className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <picture>
                <source srcSet="/images/canva-ref/megs-logo-352.webp" type="image/webp" />
                <img src="/images/canva-ref/megs-logo-480.jpg" alt="" width={480} height={348} className="h-14 w-auto rounded-md bg-white p-1" />
              </picture>
              <span className="flex flex-col leading-none">
                <span className="font-display text-2xl text-white">MEGS Inc.</span>
                <span className="mt-1 text-xs font-medium text-white/80">MAR Employment for Good Services</span>
              </span>
            </Link>

            <AnimatePresence mode="wait">
              <m.div
                key={panel.title}
                className="mt-10 flex max-w-md flex-col lg:mt-16"
                exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
              >
                <p className="font-display text-4xl leading-[1.08] text-balance lg:text-5xl">
                  <LineReveal delay={0.15}>{panel.title}</LineReveal>
                </p>
                <m.ul
                  className="mt-8 border-t border-white/15"
                  initial={reduceMotion ? false : "hidden"}
                  animate="shown"
                  variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } } }}
                >
                  {panel.points.map((point) => (
                    <m.li
                      key={point}
                      variants={staggerItem.variants}
                      className="flex items-start gap-3 border-b border-white/15 py-3.5 text-base text-white/90"
                    >
                      <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{point}</span>
                    </m.li>
                  ))}
                </m.ul>
              </m.div>
            </AnimatePresence>

            <div className="mt-auto">
              <ul className="hidden grid-cols-3 gap-3 lg:grid [@media(max-height:860px)]:hidden" aria-label="Industries MEGS staffs">
                {PANEL_PHOTOS.map((photo, i) => (
                  <m.li
                    key={photo.label}
                    className="relative overflow-hidden rounded-md bg-white/5"
                    initial={reduceMotion ? false : { clipPath: "inset(100% 0 0 0)" }}
                    animate={{ clipPath: "inset(0% 0 0 0)" }}
                    transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.45 + i * 0.1 }}
                  >
                    <img
                      src={`${photo.base}-480.webp`}
                      alt={photo.alt}
                      width={480}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      className={`aspect-[4/3] w-full object-cover ${photo.pos}`}
                    />
                    <span className="absolute left-2 top-2 rounded-sm bg-background px-1.5 py-0.5 text-xs font-semibold text-secondary">
                      {photo.label}
                    </span>
                  </m.li>
                ))}
              </ul>
              <p className="mt-6 font-display text-xl leading-snug">
                Better people for <span className="text-primary">better results.</span>
              </p>
              <p className="mt-2 text-pretty text-sm text-white/70">
                Since May 1997 · Valenzuela City · PJAR Group company · PALSCON member
              </p>
            </div>
          </div>
        </aside>

        {/* Form column */}
        <span aria-hidden="true" className="fixed inset-x-0 top-0 z-20 h-1 bg-primary md:hidden" />
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
              <picture>
                <source srcSet="/images/canva-ref/megs-logo-352.webp" type="image/webp" />
                <img src="/images/canva-ref/megs-logo-480.jpg" alt="" width={480} height={348} className="h-12 w-auto shrink-0 object-contain" />
              </picture>
              <span className="flex flex-col leading-none">
                <span className="font-display text-xl text-primary">MEGS Inc.</span>
                <span className="mt-1 text-xs font-medium text-muted-foreground">MAR Employment for Good Services</span>
              </span>
            </Link>
            {/* Each auth page rises in on arrival, whether from the landing page or another auth page. */}
            <m.div
              key={pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.1 }}
            >
              <Outlet />
            </m.div>
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
