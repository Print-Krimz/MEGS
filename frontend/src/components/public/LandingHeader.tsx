import React, { useState, useEffect } from "react";
import { BriefcaseBusiness, Menu, X, ArrowRight, LogIn } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

const navLinks = [
  { label: "Home", href: "#home", id: "home" },
  { label: "About", href: "#about", id: "about" },
  { label: "Services", href: "#services", id: "services" },
  { label: "Industries", href: "#industries", id: "industries" },
  { label: "Branches", href: "#branches", id: "branches" },
  { label: "Contact", href: "#contact", id: "contact" },
];

export const LandingHeader: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("home");

  // Track active section during scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      for (const link of navLinks) {
        const el = document.getElementById(link.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(link.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    scrollToSection(e, href);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xs border-b border-slate-200 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo & Name */}
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, "#home")}
            className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-teal-700 p-1 group"
            aria-label="MEGS Home"
          >
            <div className="w-10 h-10 bg-teal-800 text-white flex items-center justify-center font-mono font-bold text-lg border border-teal-900 shrink-0 group-hover:bg-teal-700 transition-colors">
              <BriefcaseBusiness className="w-5 h-5 text-teal-100" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 font-mono leading-tight">
                MEGS INC.
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
                Manpower & Recruitment
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links with gliding active indicator */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 xl:gap-8"
          >
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`relative text-xs font-semibold uppercase tracking-wider py-1 transition-all duration-200 focus:outline-none ${
                    isActive
                      ? "text-teal-800 font-bold"
                      : "text-slate-600 hover:text-teal-800"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-700 transition-all duration-300 animate-in fade-in" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-mono uppercase tracking-wider text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 transition-all focus:outline-none focus:ring-1 focus:ring-teal-700 hover:-translate-y-0.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Portal Login</span>
            </a>
            <a
              href="/register"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-white bg-teal-800 hover:bg-teal-900 border border-teal-900 transition-all shadow-xs focus:outline-none focus:ring-1 focus:ring-teal-700 hover:-translate-y-0.5"
            >
              <span>View Job Openings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile/Tablet Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href="/login"
              className="p-2 text-slate-700 hover:text-slate-900 border border-slate-200 bg-white text-xs font-mono font-bold"
              aria-label="Login to portal"
            >
              <LogIn className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700"
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

      {/* Mobile/Tablet Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-md transition-all duration-200">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-l-2 ${
                  activeSection === link.id
                    ? "bg-teal-50 text-teal-900 border-teal-700"
                    : "text-slate-700 hover:bg-slate-50 hover:text-teal-800 border-transparent hover:border-teal-700"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
            <a
              href="/register"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider text-white bg-teal-800 hover:bg-teal-900 border border-teal-900"
            >
              View Job Openings
            </a>
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, "#contact")}
              className="w-full text-center px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300"
            >
              Partner With Us
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
