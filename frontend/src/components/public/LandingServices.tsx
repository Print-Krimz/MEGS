import React, { useRef } from "react";
import { ArrowRight } from "lucide-react";
import type { MotionValue } from "motion/react";
import { Button } from "@/components/shadcn/button";
import { scrollToSection } from "../../lib/scrollToSection";
import { SectionHeader } from "./SectionHeader";
import { EASE_OUT, Reveal, m, onView, staggerItem, staggerParent, useReducedMotion, useScroll, useTransform } from "./motion";
import { megsPhoto } from "./megsPhotos";

const steps = [
  {
    slot: "step-request",
    title: "You send a request",
    desc: "Tell us the positions, headcount and site. We reply with a proposal.",
  },
  {
    slot: "step-screening",
    title: "We recruit and screen",
    desc: "We advertise, interview, test and select the candidates.",
  },
  {
    slot: "step-contract",
    title: "Workers sign with MEGS",
    desc: "Each hire signs a MEGS contract and is insured from day one.",
  },
  {
    slot: "step-deployment",
    title: "We deploy and coordinate",
    desc: "A MEGS coordinator manages the workers at your site.",
  },
];

const included: { title: string; desc: React.ReactNode }[] = [
  {
    title: "Records and contributions",
    desc: "We keep each worker's 201 file and report to SSS, PhilHealth, Pag-IBIG and ECC.",
  },
  {
    title: "Employer of record",
    desc: (
      <>
        Workers are MEGS employees under <span className="whitespace-nowrap">DOLE D.O. 40-03</span>. Separation stays with us.
      </>
    ),
  },
  {
    title: "Labor Code billing",
    desc: "Overtime, night, rest-day and holiday work are billed at Labor Code rates.",
  },
];

const hiringTerms = [
  {
    when: "Within 6 months",
    outcome: "10% placement fee",
    note: "Based on annual gross income and 13th month pay.",
  },
  {
    when: "After 6 months",
    outcome: "No fee",
    note: "",
  },
];

/** Index of the last step; the scroll progress maps 0..1 across the dots. */
const LAST = steps.length - 1;

interface StepProps {
  step: (typeof steps)[number];
  index: number;
  progress: MotionValue<number>;
  reduceMotion: boolean;
}

/** One step: a dot that lights as the scroll line reaches it, a segment to the next dot, hover depth. */
const Step: React.FC<StepProps> = ({ step, index, progress, reduceMotion }) => {
  const photo = megsPhoto(step.slot);
  const isLast = index === LAST;
  const lit = useTransform(progress, [index / LAST - 0.1, index / LAST], [0, 1]);
  const numeralOpacity = useTransform(lit, [0, 1], [0.3, 1]);
  const segment = useTransform(progress, [index / LAST, (index + 1) / LAST], [0, 1]);
  const live = !reduceMotion;

  return (
    <m.li
      {...onView(
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0 },
        { duration: 0.5, ease: EASE_OUT, delay: index * 0.07 },
        "-60px"
      )}
      className="group relative lg:pt-10"
    >
      <span
        aria-hidden="true"
        className="absolute -left-10 top-2.5 size-3.5 rounded-full border border-border bg-background lg:left-0 lg:top-0"
      >
        <m.span
          className="absolute -inset-px rounded-full bg-primary"
          style={live ? { opacity: lit } : undefined}
        />
      </span>

      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[calc(-2.5rem+6px)] top-6 h-[calc(100%+1.625rem)] w-px overflow-hidden bg-border md:max-lg:hidden lg:left-3.5 lg:top-[6px] lg:h-px lg:w-[calc(100%+2rem-0.875rem)]"
        >
          <m.span
            className="absolute inset-0 origin-top bg-primary lg:hidden"
            style={live ? { scaleY: segment } : undefined}
          />
          <m.span
            className="absolute inset-0 hidden origin-left bg-primary lg:block"
            style={live ? { scaleX: segment } : undefined}
          />
        </span>
      )}

      <div className="transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <m.span
          aria-hidden="true"
          className="block font-display text-4xl tabular-nums leading-none text-secondary"
          style={live ? { opacity: numeralOpacity } : undefined}
        >
          {String(index + 1).padStart(2, "0")}
        </m.span>
        <span
          aria-hidden="true"
          className="mt-4 block h-0.5 w-8 bg-border transition-[width,background-color] duration-500 ease-out group-hover:w-full group-hover:bg-primary motion-reduce:transition-none"
        />
        {photo && (
          <div className="mt-5 overflow-hidden rounded-lg">
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              width={800}
              height={600}
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          </div>
        )}
        <h3 className="mt-4 text-lg font-bold leading-snug tracking-tight text-secondary">{step.title}</h3>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
          {step.desc}
        </p>
      </div>
    </m.li>
  );
};

export const LandingServices: React.FC = () => {
  const listRef = useRef<HTMLOListElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 72%", "end 82%"] });

  return (
    <section id="services" className="scroll-mt-20 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeader
            title="From request to deployment"
            intro="You get the workers. MEGS stays their employer."
            action={
              <Button asChild size="lg" className="group shrink-0">
                <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                  Request a proposal
                  <ArrowRight
                    data-icon="inline-end"
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </a>
              </Button>
            }
          />
        </Reveal>

        <ol
          ref={listRef}
          className="relative mt-14 grid list-none gap-10 pl-10 sm:mt-16 md:grid-cols-2 md:gap-y-12 lg:grid-cols-4 lg:gap-x-8 lg:pl-0"
        >
          {steps.map((step, i) => (
            <Step key={step.slot} step={step} index={i} progress={scrollYProgress} reduceMotion={reduceMotion} />
          ))}
        </ol>

        <div className="mt-20 border-t border-border pt-14 sm:mt-24 sm:pt-16">
          <Reveal>
            <h3 className="font-display text-2xl text-secondary sm:text-3xl">Included with every deployment</h3>
          </Reveal>
          <m.ul {...staggerParent(0.08)} className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-3">
            {included.map((item) => (
              <m.li key={item.title} {...staggerItem} className="group relative border-t border-border pt-5">
                <span
                  aria-hidden="true"
                  className="absolute -top-px left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                />
                <h4 className="text-base font-semibold text-secondary">{item.title}</h4>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{item.desc}</p>
              </m.li>
            ))}
          </m.ul>
        </div>

        <div className="mt-16 grid gap-6 sm:mt-20 lg:grid-cols-2 lg:gap-8">
          <m.div
            {...onView({ opacity: 0, y: 16 }, { opacity: 1, y: 0 }, { duration: 0.6, ease: EASE_OUT })}
            className="rounded-lg bg-megs-navy-900 p-6 text-white sm:p-8"
          >
            <h3 className="text-lg font-bold tracking-tight">Employee accident insurance</h3>
            <p className="mt-1 text-sm text-white/75">Every deployed worker, from the first day.</p>
            <dl className="mt-8">
              <div>
                <dt className="text-sm text-white/75">Death or total disability</dt>
                <dd className="mt-1 font-display text-4xl tabular-nums leading-none sm:text-5xl">₱100,000.00</dd>
              </div>
              <div className="mt-6 border-t border-white/20 pt-6">
                <dt className="text-sm text-white/75">Hospitalization</dt>
                <dd className="mt-1 font-display text-2xl tabular-nums leading-none">₱10,000.00</dd>
              </div>
            </dl>
          </m.div>

          <Reveal className="flex flex-col rounded-lg border border-border bg-page p-6 sm:p-8">
            <h3 className="text-lg font-bold tracking-tight text-secondary">Hiring a MEGS worker permanently</h3>
            <ul className="mt-6 flex flex-1 flex-col divide-y divide-border border-y border-border">
              {hiringTerms.map((term) => (
                <li key={term.when} className="grid grid-cols-[7.5rem_1fr] items-center gap-4 py-4 lg:flex-1">
                  <span className="text-sm text-muted-foreground">{term.when}</span>
                  <span>
                    <span className="block text-base font-semibold text-secondary">{term.outcome}</span>
                    {term.note && (
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{term.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
