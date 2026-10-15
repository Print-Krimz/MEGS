import React, { useState } from "react";
import { ArrowRight, Building2, MapPin, Search } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { m } from "./motion";
import { IndustryExamples } from "./IndustryMosaic";

export interface LandingHeroProps {
  onSearch?: (filters: { search: string; location: string }) => void;
  initialSearch?: string;
  initialLocation?: string;
}

const POPULAR_SEARCHES = [
  "Production Worker",
  "Forklift Operator",
  "Warehouse Crew",
  "QA/QC Personnel",
  "Delivery Driver",
  "Sales Promo",
  "Machine Operator",
];

const CREDENTIALS = [
  { label: "Operating since", value: "May 1997" },
  { label: "DOLE compliance", value: "D.O. 174-17 & D.O. 40-03" },
  { label: "Accredited member", value: "PALSCON" },
  { label: "Main office", value: "Valenzuela City" },
];

type Audience = "applicant" | "employer";

const rise = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const, delay: i * 0.06 },
});

const Credentials: React.FC<{ className?: string }> = ({ className }) => (
  <dl className={className}>
    {CREDENTIALS.map((item) => (
      <div key={item.label} className="border-l-2 border-border pl-3">
        <dt className="text-sm text-muted-foreground">{item.label}</dt>
        <dd className="mt-0.5 text-base font-semibold text-secondary">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSearch,
  initialSearch = "",
  initialLocation = "",
}) => {
  const [keyword, setKeyword] = useState(initialSearch);
  const [location, setLocation] = useState(initialLocation);
  const [audience, setAudience] = useState<Audience>("applicant");

  const scrollToJobsResults = () => {
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
    // Move keyboard focus to the results heading so the search outcome is announced.
    window.setTimeout(() => {
      document.getElementById("jobs-heading")?.focus({ preventScroll: true });
    }, 450);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({ search: keyword.trim(), location: location.trim() });
    }
    scrollToJobsResults();
  };

  const handleTagClick = (tag: string) => {
    setKeyword(tag);
    if (onSearch) {
      onSearch({ search: tag, location: location.trim() });
    }
    scrollToJobsResults();
  };

  const tabClass =
    "relative h-11 flex-1 rounded-md border-0 px-5 text-base font-semibold text-secondary/70 hover:text-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary after:hidden sm:flex-none";

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:items-start lg:gap-14 lg:px-8 lg:py-20">
        <div className="lg:col-span-7">

          <m.h1
            {...rise(1)}
            className="font-display text-4xl leading-[1.06] text-secondary text-balance sm:text-5xl"
          >
            Reliable Manpower for Philippine Businesses.
          </m.h1>

          <m.p {...rise(2)} className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            MEGS recruits, deploys and manages DOLE-compliant workforces across manufacturing, logistics, retail,
            hospitality and more. Based in Valenzuela City since May 1997.
          </m.p>

          <m.div {...rise(3)} className="mt-8">
            <Tabs value={audience} onValueChange={(v) => setAudience(v as Audience)} className="gap-5">
              <TabsList
                variant="line"
                aria-label="I am looking to"
                className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit"
              >
                {(
                  [
                    ["applicant", "Find a job", Search],
                    ["employer", "Hire workers", Building2],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <TabsTrigger key={value} value={value} className={tabClass}>
                    {audience === value && (
                      <m.span
                        layoutId="hero-tab"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md border border-secondary/30 bg-background"
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-2">
                      <Icon aria-hidden="true" />
                      {label}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="applicant" className="flex flex-col gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
                <form onSubmit={handleSubmit} role="search" aria-label="Job Search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <InputGroup>
                    <InputGroupAddon>
                      <Search aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      id="hero-job-keyword"
                      aria-label="Job title or keyword"
                      placeholder="Job title or skill"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputGroupAddon>
                      <MapPin aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      id="hero-job-location"
                      aria-label="Location"
                      placeholder="City or area"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </InputGroup>
                  <Button type="submit" size="lg" className="sm:px-8">
                    <Search data-icon="inline-start" aria-hidden="true" />
                    Search Jobs
                  </Button>
                </form>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="w-full text-sm text-muted-foreground">Popular specializations:</span>
                  {POPULAR_SEARCHES.slice(0, 4).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      className="min-h-11 cursor-pointer rounded-full bg-muted px-4 text-sm font-medium text-secondary transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-10"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="employer" className="flex flex-col items-start gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
                <p className="max-w-xl text-base leading-relaxed text-foreground">
                  Tell us the positions, headcount and site. We reply with a service proposal and our
                  company profile, covering statutory records, on-site coordination and employee accident
                  insurance.
                </p>
                <Button asChild size="lg">
                  <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                    Request Manpower Proposal
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </a>
                </Button>
              </TabsContent>
            </Tabs>
          </m.div>

          <Credentials className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-4 lg:hidden" />
          <IndustryExamples className="mt-8 lg:hidden" mosaicClassName="md:grid-cols-4" />
        </div>

        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          className="hidden lg:col-span-5 lg:block"
        >
          <figure className="overflow-hidden rounded-lg border border-border bg-background">
            <IndustryExamples className="p-4 pb-1.5" mosaicClassName="" />
            <figcaption className="border-t border-border bg-background p-5">
              <div className="mb-4 flex items-center gap-3">
                <img src="/images/canva-ref/megs-logo-480.jpg" alt="" width={480} height={348} loading="lazy" className="h-10 w-auto" />
                <span className="text-sm font-semibold text-secondary">A PJAR Group Company</span>
              </div>
              <Credentials className="grid grid-cols-2 gap-x-6 gap-y-3" />
            </figcaption>
          </figure>
        </m.div>
      </div>
    </section>
  );
};
