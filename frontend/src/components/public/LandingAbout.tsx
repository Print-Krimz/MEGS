import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { scrollToSection } from "../../lib/scrollToSection";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

const yearsServing = new Date().getFullYear() - 1997;

const keyFacts = [
  { term: `${yearsServing} years`, detail: "Serving client companies since 1997" },
  { term: "Top 1,000", detail: "Philippine corporate clientele" },
  { term: "Valenzuela City", detail: "Main office and operations" },
];

const values = [
  {
    name: "Integrity",
    tagline: "Preserving institutional reputation",
    description:
      "Integrity defines the reputation of our business. We preserve integrity by developing our employees' character, building their self-esteem, and instilling absolute honesty and statutory compliance in their day-to-day tasks.",
  },
  {
    name: "Loyalty",
    tagline: "Alignment and ethical dedication",
    description:
      "We cultivate loyalty by emphasizing ethical work for the organization's collective interest. We unite clients and workers around a shared mindset of mutual success, dependable partnerships, and long-term security.",
  },
  {
    name: "Respect",
    tagline: "Promoting teamwork and dignity",
    description:
      "We value respect in the workplace because it promotes teamwork, protects worker dignity, and increases employee productivity as they perform their duties and responsibilities across client operational sites.",
  },
];

export const LandingAbout: React.FC = () => (
  <section id="about" className="scroll-mt-20 bg-page py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Reveal className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-8">
          <SectionHeader title="Trusted workforce partner to the Philippines' top 1,000 corporations" />
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-foreground sm:text-lg">
            Founded in May 1997, MAR EMPLOYMENT FOR GOOD SERVICES INC. (MEGS) has grown into one of the nation&apos;s
            most reputable manpower and human resources organizations. For nearly three decades we have given leading
            Philippine enterprises the people management, compliant employment governance, and disciplined manpower
            they need in a competitive and changing job-contracting market.
          </p>
          <dl className="mt-8 grid max-w-3xl grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {keyFacts.map((fact) => (
              <div key={fact.term} className="py-4 sm:px-6 sm:first:pl-0 sm:last:pr-0">
                <dt className="font-display text-2xl text-secondary">{fact.term}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex items-center gap-5 lg:col-span-4 lg:flex-col lg:items-start lg:justify-center">
          <img
            src="/images/canva-ref/megs-logo-480.jpg"
            alt="MEGS Inc. - Better People for Better Results"
            loading="lazy"
            decoding="async"
            width={176}
            height={176}
            className="size-32 shrink-0 rounded-full border border-border bg-background object-contain sm:size-40 lg:size-44"
          />
          <div>
            <p className="font-display text-base text-secondary">MAR Employment for Good Services Inc.</p>
            <p className="mt-1 text-sm text-muted-foreground">&ldquo;Better People for Better Results&rdquo;</p>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-14 sm:mt-20">
        <div className="h-1 w-12 bg-primary" aria-hidden="true" />
        <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-secondary">Corporate mission</h3>
            <p className="mt-2 text-lg font-semibold leading-snug text-foreground">Empowering Filipino Enterprise</p>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              &ldquo;To provide Filipino businesses with only the best trained and qualified employees available in the
              country.&rdquo;
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-secondary">5-year strategic vision</h3>
            <p className="mt-2 text-lg font-semibold leading-snug text-foreground">Better People for Better Results</p>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              &ldquo;To deliver &lsquo;Better people for better results&rsquo; to 200 client firms and provide a great
              employment experience to 15,000 deployed personnel across the Philippines.&rdquo;
            </p>
            <Button asChild variant="link" className="mt-3 h-11 px-0">
              <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                Partner with us
                <ArrowRight data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-14 sm:mt-20">
        <h3 className="font-bold tracking-tight text-xl text-secondary sm:text-2xl">Our 3 corporate values</h3>
        <div className="mt-6 grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {values.map((value) => (
            <div key={value.name} className="py-6 md:px-8 md:first:pl-0 md:last:pr-0">
              <h4 className="font-bold tracking-tight text-lg text-secondary">{value.name}</h4>
              <p className="mt-1 text-sm font-semibold text-foreground">{value.tagline}</p>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  </section>
);
