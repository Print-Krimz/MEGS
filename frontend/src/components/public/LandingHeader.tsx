import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger, SheetClose } from "@/components/shadcn/sheet";
import { m } from "./motion";

export const LandingHeader: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("");
  const { isAuthenticated, user } = useAuth();

  const getPortalDestination = () => {
    if (!isAuthenticated || !user) return "/app";
    if (user.role === Role.ADMINISTRATOR) return "/admin";
    if (user.role === Role.TALENT_ACQUISITION) return "/ta";
    return "/app";
  };

  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Industries", href: "#industries" },
    { label: "Branches & map", href: "#branches" },
    { label: "Find jobs", href: "#jobs" },
    { label: "Contact", href: "#contact" },
  ];

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
    const onScroll = () => {
      if (window.scrollY < 120) setActiveNav("");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // ScrollSpy to track active section while scrolling
    const sectionIds = navLinks.map((l) => l.href.substring(1));
    let observer: IntersectionObserver | null = null;

    if (typeof window !== "undefined" && typeof window.IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (isManualScrollRef.current || window.scrollY < 120) return;
          const visible = entries.filter((entry) => entry.isIntersecting);
          if (visible.length > 0) {
            const topVisible = visible.reduce((prev, curr) =>
              curr.boundingClientRect.top < prev.boundingClientRect.top ? curr : prev
            );
            const newHref = `#${topVisible.target.id}`;
            setActiveNav(newHref);
          }
        },
        { rootMargin: "-20% 0px -50% 0px", threshold: [0, 0.2] }
      );

      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer?.observe(el);
      });
    }

    return () => {
      observer?.disconnect();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="MEGS Home"
          >
            <img
              src="/images/canva-ref/megs-logo-480.jpg"
              alt="MEGS Inc. logo"
              width={480}
              height={348}
              decoding="async"
              className="h-10 w-auto shrink-0 sm:h-12"
            />
            <span className="flex flex-col leading-none">
              <span className="whitespace-nowrap font-display text-xl text-primary sm:text-2xl">MEGS Inc.</span>
              <span className="mt-1 hidden whitespace-nowrap text-xs font-medium text-muted-foreground md:block">
                MAR Employment for Good Services
              </span>
            </span>
          </Link>

          <nav aria-label="Main Navigation" className="hidden items-center gap-1 min-[1140px]:flex">
            {navLinks.map((item) => {
              const isActive = activeNav === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  aria-current={isActive ? "location" : undefined}
                  className={`relative cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive ? "font-semibold text-secondary" : "font-medium text-muted-foreground hover:text-secondary"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <m.span
                      layoutId="nav-active"
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary"
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            {isAuthenticated ? (
              <Button asChild variant="secondary">
                <Link to={getPortalDestination()}>Go to Portal</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/register">Create account</Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 min-[1140px]:hidden">
            {!isAuthenticated && (
              <Button asChild variant="ghost" size="sm" className="sm:hidden">
                <Link to="/login">Log in</Link>
              </Button>
            )}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Toggle navigation menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="theme-megs w-[min(20rem,90vw)] gap-0 p-0 data-[state=open]:duration-250 data-[state=closed]:duration-200">
                <SheetTitle className="border-b border-border px-5 py-4 font-display text-lg text-primary">
                  MEGS Inc.
                </SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <nav aria-label="Mobile Navigation" className="flex flex-col p-3">
                  {navLinks.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <a
                        href={item.href}
                        onClick={(e) => scrollToSection(e, item.href)}
                        className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.label}
                      </a>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
                  {isAuthenticated ? (
                    <Button asChild size="lg">
                      <Link to={getPortalDestination()} onClick={() => setIsMobileMenuOpen(false)}>Go to Portal</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg">
                        <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>Create account</Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Sign in</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
