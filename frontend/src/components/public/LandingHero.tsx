import React from "react";
import { ArrowRight, Search } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import { EASE_OUT, m, useReducedMotion } from "./motion";
import { HeroShowcase } from "./HeroShowcase";

/** Positions listed on the MEGS company profile. */
export const POSITIONS_SUPPLIED = [
  "Production workers",
  "Machine operators",
  "QA/QC personnel",
  "Forklift operators",
  "Warehouse crew",
  "Welders",
  "Delivery drivers",
  "Messengers",
  "Sales promo & merchandisers",
  "Brand ambassadors",
  "Cashiers & baggers",
  "Food servers",
  "Office staff & encoders",
  "Utility helpers",
  "Production supervisors",
];

const FACTS = ["Since May 1997", "Central office in Valenzuela City", "6 branches, Luzon to Mindanao"];

/** The few positions named in the hero. The full list stays in POSITIONS_SUPPLIED. */
const HERO_POSITIONS = [
  "Production workers",
  "Forklift operators",
  "Warehouse crew",
  "Delivery drivers",
  "Cashiers & baggers",
  "Food servers",
];

/*
 * Entrance sequence (all EASE_OUT): headline lines rise from 0.10s, copy and actions follow at 0.35 to
 * 0.55s, positions at 0.65s. HeroShowcase reveals three photos at 0.12, 0.22 and 0.32s, then the hiring card at 0.60s.
 */
const buttonMotion =
  "transition-[transform,background-color,box-shadow] duration-200 active:scale-[0.98] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100";

/** Headline line that rises out of its own mask. Renders in place under reduced motion. */
const HeroLine: React.FC<{ children: React.ReactNode; delay: number; reduceMotion: boolean }> = ({
  children,
  delay,
  reduceMotion,
}) => (
  <span className="block overflow-hidden pb-[0.08em]">
    <m.span
      className="block"
      initial={reduceMotion ? false : { y: "105%" }}
      animate={reduceMotion ? undefined : { y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </m.span>
  </span>
);

export interface LandingHeroProps {
  onFindJobs: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onFindJobs }) => {
  const reduceMotion = useReducedMotion();

  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: EASE_OUT, delay },
        };

  return (
    <section aria-labelledby="hero-heading" className="overflow-x-clip border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-14 lg:gap-y-0 lg:px-8 lg:pb-12 lg:pt-10">
        <div className="lg:col-span-7 lg:row-start-1">
          <h1
            id="hero-heading"
            className="font-display text-[2.6rem] leading-[1.02] text-secondary sm:text-6xl lg:text-[3.5rem] xl:text-[4.5rem]"
          >
            <HeroLine delay={0.1} reduceMotion={!!reduceMotion}>
              Better people
            </HeroLine>
            <HeroLine delay={0.2} reduceMotion={!!reduceMotion}>
              for <span className="text-primary">better results.</span>
            </HeroLine>
          </h1>

          <m.p {...rise(0.35)} className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-foreground">
            MEGS recruits, employs and supervises trained workers for Philippine companies, so your team can focus on
            the work. We have done it from Valenzuela City since May 1997.
          </m.p>

          <m.div {...rise(0.45)} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className={`group hover:shadow-md ${buttonMotion}`}>
              <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                Request manpower
                <ArrowRight
                  data-icon="inline-end"
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
                />
              </a>
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={onFindJobs} className={`group ${buttonMotion}`}>
              <Search
                data-icon="inline-start"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none"
              />
              Find a job
            </Button>
          </m.div>

          <m.ul
            {...rise(0.55)}
            aria-label="Company facts"
            className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-sm font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6"
          >
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                {fact}
              </li>
            ))}
          </m.ul>
        </div>

        <div className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <HeroShowcase onFindJobs={onFindJobs} />
        </div>

        <m.div {...rise(0.65)} className="lg:col-span-7 lg:row-start-2 lg:mt-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="hero-positions-title" className="text-sm font-semibold text-secondary">
              Positions we fill
            </h2>
            <a
              href="#industries"
              onClick={(e) => scrollToSection(e, "#industries")}
              className="group inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              See industries
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </a>
          </div>
          <ul aria-labelledby="hero-positions-title" className="flex flex-wrap gap-2">
            {HERO_POSITIONS.map((position) => (
              <li
                key={position}
                className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-foreground"
              >
                {position}
              </li>
            ))}
          </ul>
        </m.div>
      </div>
    </section>
  );
};
