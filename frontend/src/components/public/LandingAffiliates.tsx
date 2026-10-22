import React from "react";
import { ShieldCheck } from "lucide-react";
import { m, staggerItem, staggerParent } from "./motion";

/** Compact credentials strip under the hero: group company, trade association and DOLE compliance. */
export const LandingAffiliates: React.FC = () => {
  return (
    <section
      id="affiliates"
      className="border-b border-border bg-background py-5 sm:py-6"
      aria-label="Affiliations and Accreditations"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.ul
          {...staggerParent(0.09)}
          className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-3 lg:gap-y-0 lg:divide-x lg:divide-border"
        >
          <m.li {...staggerItem} className="group flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4 lg:pr-8">
            <img
              src="/images/canva-ref/pjar-logo-192.webp"
              alt="PJAR Group of Companies"
              width={96}
              height={40}
              className="h-9 w-auto max-w-20 shrink-0 object-contain transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:max-w-24"
              loading="lazy"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-secondary">A PJAR Group Company</p>
            </div>
          </m.li>

          <m.li {...staggerItem} className="group flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4 lg:px-8">
            <img
              src="/images/canva-ref/palscon-logo-192.webp"
              alt="PALSCON - Philippine Association of Local Service Contractors"
              width={96}
              height={40}
              className="h-9 w-auto max-w-20 shrink-0 object-contain transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:max-w-24"
              loading="lazy"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-secondary">PALSCON member</p>
              <p className="mt-0.5 hidden text-sm leading-snug text-muted-foreground sm:block">
                Philippine Association of Local Service Contractors.
              </p>
            </div>
          </m.li>

          <m.li {...staggerItem} className="group col-span-2 flex items-center gap-3 sm:gap-4 lg:col-span-1 lg:pl-8">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
              <ShieldCheck className="size-5 text-secondary" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-secondary">DOLE D.O. 174-17 &amp; D.O. 40-03</p>
            </div>
          </m.li>
        </m.ul>
      </div>
    </section>
  );
};
