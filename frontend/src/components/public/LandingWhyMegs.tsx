import React from "react";
import { Reveal, m, staggerItem, staggerParent } from "./motion";

const reasons = [
  {
    title: "Replacement on your advice",
    desc: "Tell us a worker is not working out. We replace them.",
  },
  {
    title: "A MEGS coordinator on site",
    desc: "One MEGS person handles attendance, discipline and safety.",
  },
  {
    title: "Insured from day one",
    desc: "Accident insurance applies from each worker's first day.",
  },
  {
    title: "No fee to keep a worker",
    desc: "Hire permanently after 6 months and pay no placement fee.",
  },
];

export const LandingWhyMegs: React.FC = () => (
  <section
    id="why-megs"
    aria-labelledby="why-megs-title"
    className="scroll-mt-20 bg-megs-navy-900 py-16 text-white sm:py-24"
  >
    <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
      <Reveal className="lg:col-span-5">
        <h2
          id="why-megs-title"
          tabIndex={-1}
          className="font-display text-4xl leading-[1.08] text-balance focus:outline-none sm:text-5xl"
        >
          Every worker we send stays a MEGS employee.
        </h2>
        <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-white/75">
          MEGS carries separation and termination liability, so your company does not.
        </p>
      </Reveal>

      <m.ul {...staggerParent(0.09)} className="lg:col-span-7 lg:col-start-6">
        {reasons.map((reason) => (
          <m.li key={reason.title} {...staggerItem} className="group relative border-t border-white/15 last:border-b">
            <span
              aria-hidden="true"
              className="absolute -top-px left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100 group-focus-within:scale-x-100 motion-reduce:transition-none"
            />
            <div className="py-6 transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none sm:py-7">
              <h3 className="font-display text-xl leading-snug sm:text-2xl">{reason.title}</h3>
              <p className="mt-1.5 text-base leading-relaxed text-white/75">{reason.desc}</p>
            </div>
          </m.li>
        ))}
      </m.ul>
    </div>
  </section>
);
