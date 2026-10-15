import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { scrollToSection } from "../../lib/scrollToSection";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

const salientFeatures = [
  {
    title: "Complete Recruitment & Sourcing Relief",
    desc: "Your company is spared the routines of hiring, from advertising to interviews, competency testing, background checks, and candidate selection.",
  },
  {
    title: "Statutory Records & Benefits Administration",
    desc: "We maintain all 201 records and statutory filings (SSS, PhilHealth, Pag-IBIG Fund, and ECC), and MEGS assumes full responsibility for benefit claims, compensation for occupational injuries, and health documentation.",
  },
  {
    title: "Zero Legal Liabilities (DOLE D.O. 40, S.2003)",
    desc: "Workers are solely and exclusively employed by MEGS under a legitimate contractor-employee relationship, so client companies are insulated from separation or termination liabilities, with immediate worker replacement upon advice.",
  },
  {
    title: "Labor Stability & Zero Collective Bargaining",
    desc: "Your company is spared union demands, collective bargaining friction, and fringe benefit negotiations, so work on client facilities continues without interruption.",
  },
  {
    title: "Dedicated On-Site Service Coordinators",
    desc: "On-site coordinators manage daily attendance, performance discipline, site safety, and immediate staffing requirements in close cooperation with client management.",
  },
  {
    title: "Competitive Billing & Labor Code Rates",
    desc: "Billing rates are reasonable and cost-effective. Overtime, night differentials, and work on rest days or legal holidays are computed according to Philippine Labor Code standards.",
  },
];

const hiringTerms = [
  "Permanent hiring within the first 6 months: 10% recruitment placement fee based on annual gross income and 13th month pay.",
  "Permanent absorption after 6 months of client deployment: 100% Free of Charge.",
  "Immediate replacement guarantee for personnel who do not meet client performance criteria.",
];

export const LandingServices: React.FC = () => (
  <section id="services" className="scroll-mt-20 bg-page py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <SectionHeader
                title="Salient features of our manpower services"
                intro="MEGS recruits, employs, administers, and insures the workforce under DOLE-compliant contracting, so client operations stay focused on the work itself."
              />
              <Button asChild size="lg" className="mt-8">
                <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                  Request service proposal
                  <ArrowRight data-icon="inline-end" />
                </a>
              </Button>
            </Reveal>
          </div>
        </div>

        <div className="lg:col-span-7">
          <Reveal>
            <ul className="divide-y divide-border border-y border-border">
              {salientFeatures.map((feat) => (
                <li key={feat.title} className="py-6">
                  <h3 className="font-bold tracking-tight text-lg leading-snug text-secondary">{feat.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{feat.desc}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>

      <Reveal className="mt-12 sm:mt-16">
        <div className="rounded-lg border-2 border-secondary p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <h3 className="font-bold tracking-tight text-xl text-secondary sm:text-2xl">
                Company-Provided Employee Accident Insurance
              </h3>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                Every deployed MEGS worker is covered by our institutional accident insurance policy from Day 1 of assignment.
              </p>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="border-t border-border pt-4">
                  <dt className="text-sm font-semibold text-foreground">Death or Total Disability</dt>
                  <dd className="mt-1 font-display text-3xl text-secondary">₱100,000.00</dd>
                  <dd className="mt-1 text-sm text-muted-foreground">Full principal coverage per personnel</dd>
                </div>
                <div className="border-t border-border pt-4">
                  <dt className="text-sm font-semibold text-foreground">Hospitalization Support</dt>
                  <dd className="mt-1 font-display text-3xl text-secondary">₱10,000.00</dd>
                  <dd className="mt-1 text-sm text-muted-foreground">Emergency medical assistance coverage</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-5 lg:border-l lg:border-border lg:pl-12">
              <h4 className="font-bold tracking-tight text-lg text-secondary">Direct permanent hiring provisions</h4>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {hiringTerms.map((term) => (
                  <li key={term} className="py-3 text-sm leading-relaxed text-foreground">
                    {term}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                Department of Labor &amp; Employment (DOLE) Certified
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);
