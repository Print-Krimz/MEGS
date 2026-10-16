import React from "react";
import { ShieldCheck } from "lucide-react";

export const LandingAffiliates: React.FC = () => {
  return (
    <section
      id="affiliates"
      className="border-b border-border bg-background py-8"
      aria-label="Affiliations and Accreditations"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:divide-x lg:divide-border">
          {/* PJAR Group affiliation */}
          <div className="flex flex-1 items-center gap-4 lg:pr-8">
            <img
              src="/images/canva-ref/pjar-logo-192.webp"
              alt="PJAR Group of Companies"
              className="h-9 w-auto max-w-24 shrink-0 object-contain"
              loading="lazy"
            />
            <div>
              <p className="text-sm font-semibold text-secondary">A PJAR Group Company</p>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                MAR Employment for Good Services Inc. operates under the PJAR Group, with the resources of the wider PJAR group.
              </p>
            </div>
          </div>

          {/* PALSCON membership */}
          <div className="flex flex-1 items-center gap-4 lg:px-8">
            <img
              src="/images/canva-ref/palscon-logo-192.webp"
              alt="PALSCON - Philippine Association of Local Service Contractors"
              className="h-9 w-auto max-w-24 shrink-0 object-contain"
              loading="lazy"
            />
            <div>
              <p className="text-sm font-semibold text-secondary">Proud PALSCON Member</p>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                Member of the Philippine Association of Local Service Contractors, committed to professional ethics and fair labor practices.
              </p>
            </div>
          </div>

          {/* DOLE compliance */}
          <div className="flex items-center gap-3 lg:pl-8">
            <ShieldCheck className="size-6 shrink-0 text-secondary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-secondary">DOLE D.O. 174-17 &amp; D.O. 40-03</p>
              <p className="text-sm text-muted-foreground">Legitimate private employment contractor</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
