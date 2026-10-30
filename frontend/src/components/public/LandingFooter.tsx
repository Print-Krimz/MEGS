import React from "react";
import { Link } from "@tanstack/react-router";
import { scrollToSection } from "../../lib/scrollToSection";
import { cn } from "../../lib/shadcn-utils";
import { BRANCHES } from "./landing-branches";
import { Reveal } from "./motion";

/** Underline that draws in from the left on hover and focus. */
const drawLink =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 motion-reduce:after:transition-none group-hover/link:after:scale-x-100 group-focus-visible/link:after:scale-x-100";

const footerLink =
  "group/link inline-flex min-h-11 items-center rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const hq = BRANCHES.find((b) => b.isHQ) ?? BRANCHES[0];
const otherOffices = BRANCHES.filter((b) => b.id !== hq.id);

const stripOperator = (mobile: string) => mobile.replace(/ \(.*\)$/, "");

/** Branches that share a mobile line are listed together so each number appears once. */
const branchGroups = otherOffices.reduce<{ mobile: string; names: string[] }[]>((groups, b) => {
  const mobile = stripOperator(b.mobile);
  const name = b.name.replace(/ Branch$/, "");
  const group = groups.find((g) => g.mobile === mobile);
  if (group) group.names.push(name);
  else groups.push({ mobile, names: [name] });
  return groups;
}, []);

const NAV_LINKS = [
  { href: "#about", label: "About MEGS" },
  { href: "#services", label: "Services" },
  { href: "#industries", label: "Industries" },
  { href: "#branches", label: "Branches and map" },
  { href: "#jobs", label: "Open jobs" },
  { href: "#contact", label: "Proposals" },
];

const phoneLink =
  "group/link inline-flex min-h-11 w-fit items-center rounded-sm text-sm tabular-nums text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export const LandingFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-megs-navy-900 text-white/75">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <img
                src="/images/canva-ref/megs-logo-352.webp"
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
            <p className="mt-5 max-w-md text-sm leading-relaxed">
              A Valenzuela manpower agency serving clients since May 1997.
            </p>
          </div>

          {/* Office directory: head office first, then branches */}
          <div className="lg:col-span-4">
            <h3 className="text-sm font-semibold text-white">Nationwide office directory</h3>
            <p className="mt-4 text-sm font-semibold text-white">{hq.name}</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed">{hq.address}</p>
            <div className="mt-1 flex flex-wrap gap-x-6">
              {[
                { display: stripOperator(hq.mobile), tel: stripOperator(hq.mobile).replace(/\D/g, "") },
                ...(hq.landlines ?? []),
              ].map((line) => (
                <a key={line.tel} href={`tel:${line.tel}`} className={phoneLink}>
                  <span className={drawLink}>{line.display}</span>
                </a>
              ))}
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              {branchGroups.map((group) => (
                <div key={group.mobile}>
                  <dt className="leading-relaxed">{group.names.join(", ")}</dt>
                  <dd>
                    <a href={`tel:${group.mobile.replace(/\D/g, "")}`} className={phoneLink}>
                      <span className={drawLink}>{group.mobile}</span>
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Navigation */}
          <div className="lg:col-span-3">
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3 lg:flex lg:flex-col">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={(e) => scrollToSection(e, link.href)} className={footerLink}>
                  <span className={drawLink}>{link.label}</span>
                </a>
              ))}
            </nav>
            <Link to="/login" className={cn(footerLink, "mt-2 w-full border-t border-white/10 pt-2 text-sm")}>
              <span className={drawLink}>Log in to the portal</span>
            </Link>
          </div>
        </Reveal>

        {/* Legal and compliance */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-sm sm:mt-14 sm:pt-8 md:flex-row md:items-center">
          <p>DOLE D.O. 174-17 &amp; D.O. 40-03 Compliant</p>
          <p>
            © {currentYear} MAR Employment for Good Services Inc. (MEGS). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
