import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { Menu, X, ArrowRight, User } from "lucide-react";

export const LandingHeader: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getPortalLink = () => {
    if (!user) return "/app";
    if (user.role === Role.ADMINISTRATOR) return "/admin";
    if (user.role === Role.TALENT_ACQUISITION) return "/ta";
    return "/app";
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow-xs">
                M
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-slate-950 text-base sm:text-lg tracking-tight leading-none font-sans">
                  MEGS <span className="text-blue-600 font-semibold text-sm">Careers</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Workforce & Recruitment
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Main Navigation">
              <Link to="/app/jobs" className="hover:text-blue-600 transition-colors">
                Find Jobs
              </Link>
              <a href="#categories" className="hover:text-blue-600 transition-colors">
                Browse Categories
              </a>
              <a href="#companies" className="hover:text-blue-600 transition-colors">
                Top Companies
              </a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
                How It Works
              </a>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to={getPortalLink() as any}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <User className="w-4 h-4" />
                <span>My Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span>Create Account</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-11 min-w-11 inline-flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
            <Link
              to="/app/jobs"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Find Jobs
            </Link>
            <a
              href="#categories"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Browse Categories
            </a>
            <a
              href="#companies"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Top Companies
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              How It Works
            </a>
          </nav>

          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
            {isAuthenticated ? (
              <Link
                to={getPortalLink() as any}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 px-4 text-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs"
              >
                Go to Portal
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 text-center rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 text-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
