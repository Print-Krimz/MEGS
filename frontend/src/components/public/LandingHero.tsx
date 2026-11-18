import React from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import type { JobPosting } from "../../lib/api/applicant-jobs.api";
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

const FACTS = ["Since May 1997", "Central office in Valenzuela City", "5 branches, Luzon to Mindanao"];

const POPULAR_SEARCHES = [
  "Production Worker",
  "Forklift Operator",
  "Warehouse Crew",
  "Delivery Driver",
] as const;

/** Complementary roles showcased below the hero actions; clicking runs a live job search. */
const HERO_POSITIONS = [
  { label: "Machine operators", query: "Machine Operator" },
  { label: "QA/QC personnel", query: "QA" },
  { label: "Sales promo & merchandisers", query: "Merchandiser" },
  { label: "Cashiers & baggers", query: "Cashier" },
  { label: "Food servers", query: "Food Server" },
  { label: "Office staff & encoders", query: "Office" },
] as const;

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
  searchQuery: string;
  locationQuery: string;
  onSearchChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSelectPopularRole: (role: string) => void;
  onFindJobs: () => void;
  onSelectJob: (job: JobPosting) => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  searchQuery,
  locationQuery,
  onSearchChange,
  onLocationChange,
  onSearchSubmit,
  onSelectPopularRole,
  onFindJobs,
  onSelectJob,
}) => {
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
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-0 lg:px-8 lg:pb-12 lg:pt-10">
        <div className="min-w-0 lg:col-span-7 lg:row-start-1">
          <h1
            id="hero-heading"
            className="font-display text-[2.5rem] leading-[1.02] text-secondary sm:text-6xl lg:text-[3.5rem] xl:text-[4.25rem]"
          >
            <HeroLine delay={0.1} reduceMotion={!!reduceMotion}>
              Better people
            </HeroLine>
            <HeroLine delay={0.2} reduceMotion={!!reduceMotion}>
              for <span className="text-primary">better results.</span>
            </HeroLine>
          </h1>

          {/* No entrance fade: this paragraph is the mobile LCP element, and a fade from opacity 0 delays it */}
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-foreground sm:text-lg">
            MEGS recruits, employs and supervises trained workers for Philippine companies, so your team can focus on
            the work. We have done it from Valenzuela City since May 1997.
          </p>

          <div className="mt-6">
            <form
              role="search"
              aria-label="Job Search"
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-300 bg-white p-1.5 shadow-[0_8px_24px_-12px_rgba(11,49,93,0.14)] sm:flex-row sm:items-center sm:gap-0"
            >
              <div className="relative flex min-w-0 flex-1 items-center">
                <Search className="pointer-events-none ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  id="jobs-keyword"
                  aria-label="Job title or keyword"
                  placeholder="Job title or skill"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-11 w-full min-w-0 rounded-lg bg-transparent pl-2.5 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-slate-200 sm:block" />

              <div className="relative flex min-w-0 flex-1 items-center border-t border-slate-200 pt-1 sm:border-t-0 sm:pt-0">
                <MapPin className="pointer-events-none ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  id="jobs-location"
                  aria-label="Location"
                  placeholder="City or area"
                  value={locationQuery}
                  onChange={(e) => onLocationChange(e.target.value)}
                  className="h-11 w-full min-w-0 rounded-lg bg-transparent pl-2.5 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="min-h-11 shrink-0 rounded-lg bg-primary px-5 text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98] motion-reduce:active:scale-100 sm:ml-1.5 sm:px-6"
              >
                <Search data-icon="inline-start" aria-hidden="true" />
                Search jobs
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="mr-1 text-xs font-medium text-muted-foreground sm:text-sm">Popular:</span>
              {POPULAR_SEARCHES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={searchQuery === tag}
                  onClick={() => onSelectPopularRole(tag)}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-slate-100/80 px-2.5 text-xs font-medium text-secondary transition-colors duration-150 hover:bg-secondary/10 active:scale-95 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 sm:text-sm md:min-h-8"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <m.div {...rise(0.45)} className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <span className="text-sm text-muted-foreground">Need workers for your business?</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                variant="outline"
                className={`group min-h-11 border-secondary/30 text-secondary hover:border-secondary hover:bg-secondary/5 ${buttonMotion}`}
              >
                <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                  Request manpower
                  <ArrowRight
                    data-icon="inline-end"
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
                  />
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onFindJobs}
                className={`min-h-11 text-secondary hover:bg-secondary/5 ${buttonMotion}`}
              >
                Find a job
              </Button>
            </div>
          </m.div>

          <m.ul
            {...rise(0.55)}
            aria-label="Company facts"
            className="mt-6 flex flex-col gap-1.5 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
          >
            {FACTS.map((fact, idx) => (
              <li key={fact} className="flex items-center gap-2 sm:gap-3">
                {idx > 0 && (
                  <span aria-hidden="true" className="hidden text-border sm:inline">
                    ·
                  </span>
                )}
                <span>{fact}</span>
              </li>
            ))}
          </m.ul>
        </div>

        <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <HeroShowcase onFindJobs={onFindJobs} onSelectJob={onSelectJob} />
        </div>

        <m.div {...rise(0.65)} className="min-w-0 lg:col-span-7 lg:row-start-2 lg:mt-5">
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
          <ul aria-labelledby="hero-positions-title" className="mt-1.5 flex flex-wrap gap-1.5 sm:gap-2">
            {HERO_POSITIONS.map((position) => {
              const isSelected = searchQuery === position.query;
              return (
                <li key={position.label}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectPopularRole(position.query)}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-slate-100/70 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/10 hover:text-secondary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm md:min-h-8"
                  >
                    {position.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </m.div>
      </div>
    </section>
  );
};
