import React from "react";
import { Link } from "@tanstack/react-router";
import { scrollToSection } from "../../lib/scrollToSection";
import { BRANCHES } from "./LandingBranches";

const footerLink =
  "inline-flex min-h-11 items-center rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export const LandingFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-megs-navy-900 text-white/75">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-12 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3">
              <img
                src="/images/canva-ref/megs-logo-480.jpg"
                alt="MEGS Inc. logo"
                width={480}
                height={348}
                loading="lazy"
                className="h-14 w-auto shrink-0 rounded-md bg-white p-1"
              />
              <div>
                <p className="font-display text-xl text-white">MEGS Inc.</p>
                <p className="text-sm text-white/75">MAR Employment for Good Services</p>
              </div>
            </div>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              Founded May 1997. Compliant manpower, on-site supervision and disciplined workforce solutions for the Philippines&apos; Top 1,000 Corporations.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5">
                <span className="flex h-6 items-center rounded-sm bg-white px-1.5">
                  <img
                    src="/images/canva-ref/pjar-logo.png"
                    alt="PJAR Group of Companies"
                    className="h-4 w-auto object-contain"
                    loading="lazy"
                  />
                </span>
                <span className="text-sm text-white/75">A PJAR Group Company</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5">
                <span className="flex h-6 items-center rounded-sm bg-white px-1.5">
                  <img
                    src="/images/canva-ref/palscon-logo.png"
                    alt="PALSCON Accredited"
                    className="h-4 w-auto object-contain"
                    loading="lazy"
                  />
                </span>
                <span className="text-sm text-white/75">PALSCON Accredited</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="lg:col-span-5">
            <h3 className="text-sm font-semibold text-white">Navigation</h3>
            <nav aria-label="Footer" className="mt-2 grid grid-cols-2 text-sm">
              <a href="#about" onClick={(e) => scrollToSection(e, "#about")} className={footerLink}>
                About MEGS
              </a>
              <a href="#services" onClick={(e) => scrollToSection(e, "#services")} className={footerLink}>
                Services
              </a>
              <a href="#industries" onClick={(e) => scrollToSection(e, "#industries")} className={footerLink}>
                Industries
              </a>
              <a href="#branches" onClick={(e) => scrollToSection(e, "#branches")} className={footerLink}>
                Branches and map
              </a>
              <a href="#jobs" onClick={(e) => scrollToSection(e, "#jobs")} className={footerLink}>
                Open jobs
              </a>
              <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")} className={footerLink}>
                Proposals
              </a>
            </nav>
            <Link to="/login" className={`${footerLink} mt-2 border-t border-white/10 pt-2`}>
              Log in to the portal
            </Link>
          </div>
        </div>

        {/* Branch directory */}
        <div className="border-b border-white/10 py-10">
          <h3 className="text-sm font-semibold text-white">Nationwide office directory</h3>
          <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {BRANCHES.map((b) => (
              <div key={b.id}>
                <p className="text-sm font-semibold text-white">{b.isHQ ? `${b.name} (HQ)` : b.name}</p>
                <p className="mt-1 text-sm leading-relaxed">{b.address}</p>
                <p className="mt-1 text-sm tabular-nums text-white">
                  {b.phone} / {b.mobile.replace(/ \(.*\)$/, "")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Legal and compliance */}
        <div className="flex flex-col items-start justify-between gap-3 pt-8 text-sm md:flex-row md:items-center">
          <p>DOLE D.O. 174-17 &amp; D.O. 40-03 Compliant &middot; Legitimate Private Employment Contractor</p>
          <p className="text-white/75">
            © {currentYear} MAR Employment for Good Services Inc. (MEGS). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
