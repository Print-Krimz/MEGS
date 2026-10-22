import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger, SheetClose } from "@/components/shadcn/sheet";
import { EASE_OUT, m, useReducedMotion } from "./motion";

export const LandingHeader: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [hasWhySection, setHasWhySection] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const reduceMotion = useReducedMotion();

  const getPortalDestination = () => {
    if (!isAuthenticated || !user) return "/app";
    if (user.role === Role.ADMINISTRATOR) return "/admin";
    if (user.role === Role.TALENT_ACQUISITION) return "/ta";
    return "/app";
  };

  // "Why MEGS" only appears once a section with that id is on the page, so the link is never dead.
  const navLinks = useMemo(
    () => [
      { label: "About", href: "#about" },
      { label: "Services", href: "#services" },
      ...(hasWhySection ? [{ label: "Why MEGS", href: "#why-megs" }] : []),
      { label: "Industries", href: "#industries" },
      { label: "Jobs", href: "#jobs" },
      { label: "Branches", href: "#branches" },
      { label: "Contact", href: "#contact" },
    ],
    [hasWhySection]
  );

  const buttonMotion =
    "transition-[transform,background-color,box-shadow] duration-200 active:scale-[0.98] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100";

  const isManualScrollRef = useRef(false);
  const manualScrollTimeoutRef = useRef<number | null>(null);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    isManualScrollRef.current = true;
    if (manualScrollTimeoutRef.current) {
      window.clearTimeout(manualScrollTimeoutRef.current);
    }
    setActiveNav(href);
    scrollToSection(e, href);

    manualScrollTimeoutRef.current = window.setTimeout(() => {
      isManualScrollRef.current = false;
    }, 800);
  };

  useEffect(() => {
    setHasWhySection(Boolean(document.getElementById("why-megs")));
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY < 120) setActiveNav("");
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Scroll spy: the active link is the last section whose top has passed the line 30% down the viewport.
    const sectionIds = navLinks.map((l) => l.href.substring(1));
    let frame = 0;

    const update = () => {
      frame = 0;
      if (isManualScrollRef.current || window.scrollY < 120) return;
      const line = window.innerHeight * 0.3;
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = `#${id}`;
      }
      if (current) setActiveNav(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [navLinks]);

  return (
    <header className="sticky top-0 z-40 h-16 sm:h-20">
      {/* Bar surface. It slides up 8px once scrolled, so the visible bar condenses without moving the page. */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 -top-2 bottom-0 bg-background transition-transform duration-300 ease-out motion-reduce:transition-none ${
          scrolled ? "-translate-y-2" : ""
        }`}
      >
        <span
          className={`absolute inset-x-0 bottom-0 h-px bg-border transition-opacity duration-300 motion-reduce:transition-none ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        />
        <span
          className={`absolute inset-x-0 top-full h-4 bg-gradient-to-b from-black/[0.06] to-transparent transition-opacity duration-300 motion-reduce:transition-none ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div className="relative mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`flex h-full items-center justify-between transition-transform duration-300 ease-out motion-reduce:transition-none ${
            scrolled ? "-translate-y-1" : ""
          }`}
        >
          <Link
            to="/"
            className={`flex origin-left items-center gap-3 rounded-md py-1 transition-transform duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
              scrolled ? "scale-[0.9]" : ""
            }`}
            aria-label="MEGS Home"
          >
            <img
              src="/images/canva-ref/megs-logo-352.webp"
              alt="MEGS Inc. logo"
              width={480}
              height={348}
              decoding="async"
              className="h-10 w-auto shrink-0 sm:h-12"
            />
            <span className="flex flex-col leading-none">
              <span className="whitespace-nowrap font-display text-xl text-primary sm:text-2xl">MEGS Inc.</span>
              <span className="mt-1 hidden whitespace-nowrap text-xs font-medium text-muted-foreground md:block min-[1140px]:hidden min-[1360px]:block">
                MAR Employment for Good Services
              </span>
            </span>
          </Link>

          <nav aria-label="Main Navigation" className="hidden flex-1 items-center justify-center gap-0.5 px-4 min-[1140px]:flex min-[1280px]:gap-1">
            {navLinks.map((item) => {
              const isActive = activeNav === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  aria-current={isActive ? "location" : undefined}
                  className={`group relative flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[1280px]:px-3 ${
                    isActive ? "text-secondary" : "text-muted-foreground hover:text-secondary"
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-2.5 bottom-1.5 h-0.5 min-[1280px]:inset-x-3 origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${
                      isActive ? "scale-x-100 bg-primary" : "scale-x-0 bg-primary/45 group-hover:scale-x-100"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {isAuthenticated ? (
              <Button asChild className={`group hover:shadow-md ${buttonMotion}`}>
                <Link to={getPortalDestination()}>
                  Go to Portal
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className={buttonMotion}>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild className={`hover:shadow-md ${buttonMotion}`}>
                  <Link to="/register">Create account</Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 min-[1140px]:hidden">
            {!isAuthenticated && (
              <Button asChild variant="ghost" className={`px-3 sm:hidden ${buttonMotion}`}>
                <Link to="/login">Log in</Link>
              </Button>
            )}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Toggle navigation menu" className={buttonMotion}>
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton={false}
                className="theme-megs w-[min(20rem,90vw)] gap-0 p-0 data-[state=open]:duration-250 data-[state=closed]:duration-200"
              >
                <div className="flex items-center justify-between border-b border-border py-2 pl-5 pr-2">
                  <SheetTitle className="font-display text-lg text-primary">MEGS Inc.</SheetTitle>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu" className={buttonMotion}>
                      <X />
                    </Button>
                  </SheetClose>
                </div>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <nav aria-label="Mobile Navigation" className="flex flex-col gap-0.5 p-3">
                  {navLinks.map((item, i) => (
                    <SheetClose asChild key={item.href}>
                      <m.a
                        href={item.href}
                        aria-current={activeNav === item.href ? "location" : undefined}
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, item.href)}
                        initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.08 + i * 0.045 }}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 text-base font-medium transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          activeNav === item.href ? "bg-muted text-secondary" : "text-foreground"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 shrink-0 rounded-full ${activeNav === item.href ? "bg-primary" : "bg-transparent"}`}
                        />
                        {item.label}
                      </m.a>
                    </SheetClose>
                  ))}
                </nav>
                <m.div
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.1 + navLinks.length * 0.045 }}
                  className="mt-auto flex flex-col gap-2 border-t border-border p-4"
                >
                  {isAuthenticated ? (
                    <Button asChild size="lg" className={buttonMotion}>
                      <Link to={getPortalDestination()} onClick={() => setIsMobileMenuOpen(false)}>Go to Portal</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className={buttonMotion}>
                        <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>Create account</Link>
                      </Button>
                      <Button asChild size="lg" variant="outline" className={buttonMotion}>
                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Log in</Link>
                      </Button>
                    </>
                  )}
                </m.div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
