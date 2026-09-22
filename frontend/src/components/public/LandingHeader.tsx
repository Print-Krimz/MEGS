import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { scrollToSection } from "../../lib/scrollToSection";

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
    { label: "Branches & Map", href: "#branches" },
    { label: "Find Jobs", href: "#jobs" },
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
    // ScrollSpy to track active section while scrolling
    const sectionIds = navLinks.map((l) => l.href.substring(1));
    let observer: IntersectionObserver | null = null;

    if (typeof window !== "undefined" && typeof window.IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (isManualScrollRef.current) return;
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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Brand Logo & Name with Canva Seal */}
          <Link
            to="/"
            className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-sm py-1 group"
            aria-label="MEGS Home"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 bg-white border border-slate-200 shadow-2xs overflow-hidden shrink-0">
              <img
                src="/images/canva-ref/megs-seal.jpg"
                alt="MEGS Logo Seal"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl sm:text-2xl tracking-tight text-[#0f294a] font-sans leading-none">
                MEGS INC.
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 tracking-wider uppercase mt-1 hidden sm:inline-block">
                MAR Employment for Good Services
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Main Navigation"
            className="hidden lg:flex items-center gap-1 xl:gap-2"
          >
            {navLinks.map((item) => {
              const isActive = activeNav === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative py-2 px-3 text-xs xl:text-sm transition-colors duration-150 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] focus-visible:ring-offset-2 cursor-pointer ${
                    isActive
                      ? "text-[#0f294a] font-bold"
                      : "text-slate-600 hover:text-[#0f294a] font-medium"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#0f294a] rounded-full"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Desktop Auth Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to={getPortalDestination()}
                className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0f294a] hover:bg-[#163b66] rounded-lg transition-colors border border-[#0f294a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
              >
                Go to Portal
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#0f294a] hover:bg-slate-100 rounded-lg transition-colors border border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0f294a] hover:bg-[#163b66] rounded-lg transition-colors border border-[#0f294a] shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            {!isAuthenticated && (
              <Link
                to="/login"
                className="sm:hidden px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-300 rounded-lg"
              >
                Log In
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-md">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  scrollToSection(e, item.href);
                  setIsMobileMenuOpen(false);
                }}
                className="px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0f294a] rounded-md transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
          </nav>
          
          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
            {isAuthenticated ? (
              <Link
                to={getPortalDestination()}
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center px-4 py-3 text-sm font-semibold text-white bg-[#0f294a] rounded-lg"
              >
                Go to Portal
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-3 text-sm font-semibold text-white bg-[#0f294a] hover:bg-[#163b66] rounded-lg"
                >
                  Create Account
                </Link>
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-3 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
