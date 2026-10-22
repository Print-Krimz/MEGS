import React from "react";
import { SectionHeader } from "./SectionHeader";
import {
  EASE_OUT,
  Parallax,
  Reveal,
  m,
  onView,
  staggerItem,
  staggerParent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "./motion";
import { megsPhoto } from "./megsPhotos";

const values = [
  {
    name: "Integrity",
    description: "Honest work, and employees with character and self-confidence.",
  },
  {
    name: "Loyalty",
    description: "Ethical work in the interest of client and worker alike.",
  },
  {
    name: "Respect",
    description: "Respect keeps teams cooperative and productive on site.",
  },
];

const milestones = [
  {
    when: "May 1997",
    text: "Atty. Mildred A. Ramos starts MAR Employment and General Services as a single proprietorship.",
  },
  {
    when: "August 1999",
    text: "Becomes a corporation on August 16 and adds mechanical and civil services the same year.",
  },
  {
    when: "2000",
    text: "Professional cleaning joins the services, regular and specialized.",
  },
  {
    when: "Today",
    text: "Central office in Valenzuela and five branches, supplying office, technical, industrial and agricultural personnel and professional cleaners.",
  },
];

/** Milestone list with a rail that fills as the reader scrolls. Static and fully drawn under reduced motion. */
const Timeline: React.FC = () => {
  const ref = React.useRef<HTMLOListElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <m.ol ref={ref} {...staggerParent(0.15)} className="relative space-y-10">
      <span aria-hidden="true" className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border" />
      <m.span
        aria-hidden="true"
        style={reduceMotion ? undefined : { scaleY }}
        className="absolute bottom-2 left-[7px] top-2 w-0.5 origin-top bg-primary"
      />
      {milestones.map((item) => (
        <m.li key={item.when} {...staggerItem} className="relative pl-10">
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 size-4 rounded-full border-2 border-primary bg-page"
          />
          <p className="font-display text-xl leading-tight text-secondary sm:text-2xl">{item.when}</p>
          <p className="mt-1.5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">{item.text}</p>
        </m.li>
      ))}
    </m.ol>
  );
};

const telLink =
  "inline-flex min-h-11 items-center rounded-sm text-lg tabular-nums text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const LandingAbout: React.FC = () => {
  const office = megsPhoto("office");
  const reduceMotion = useReducedMotion();

  // The photo is unmasked from the top down. Reduced motion shows it as is.
  const unmask = reduceMotion
    ? {}
    : onView(
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)" },
        { duration: 0.8, ease: EASE_OUT },
        "-80px"
      );

  return (
    <section id="about" className="scroll-mt-20 bg-page py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Story + headquarters */}
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionHeader title="A Valenzuela manpower agency since 1997" />
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-foreground">
                MAR Employment for Good Services Inc. opened in May 1997. Today MEGS supplies workers to companies among
                the Philippines&apos; top 1,000 corporations. We hire them, keep them as our employees, and handle
                records, benefits and supervision at your site.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            {office ? (
              <m.figure {...unmask} className="overflow-hidden rounded-lg bg-muted">
                <div className="aspect-[4/3] overflow-hidden">
                  <Parallax distance={50} className="h-full">
                    <img
                      src={office.src}
                      alt={office.alt}
                      loading="lazy"
                      decoding="async"
                      width={1200}
                      height={900}
                      className="h-full w-full scale-110 object-cover"
                    />
                  </Parallax>
                </div>
                <figcaption className="bg-background px-4 py-3 text-sm text-muted-foreground">
                  Central office, Valenzuela City
                </figcaption>
              </m.figure>
            ) : (
              <m.div
                {...onView({ opacity: 0, y: 16 }, { opacity: 1, y: 0 }, { duration: 0.6, ease: EASE_OUT })}
                className="rounded-lg bg-muted/70 p-8 sm:p-10"
              >
                <span aria-hidden="true" className="block h-0.5 w-12 bg-primary" />
                <p className="mt-6 text-sm font-semibold text-muted-foreground">Central office</p>
                <address className="mt-2 font-display text-2xl not-italic leading-snug text-secondary">
                  #9 PJAR Bldg, P. Gomez St., Malinta, Valenzuela City
                </address>
                <div className="mt-5 flex flex-col">
                  <a href="tel:+63282772959" className={telLink}>
                    (02) 8277-2959
                  </a>
                  <a href="tel:+63282910807" className={telLink}>
                    (02) 8291-0807
                  </a>
                </div>
              </m.div>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="mt-14 grid gap-8 border-t border-border pt-10 sm:mt-24 sm:pt-14 lg:grid-cols-12 lg:gap-20">
          <Reveal className="lg:col-span-4">
            <h3 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">How MEGS grew</h3>
          </Reveal>
          <div className="lg:col-span-8">
            <Timeline />
          </div>
        </div>

        {/* Mission and vision */}
        <m.div
          {...onView({ opacity: 0, y: 20 }, { opacity: 1, y: 0 }, { duration: 0.6, ease: EASE_OUT })}
          className="mt-14 grid gap-10 border-t border-border pt-10 sm:mt-24 sm:pt-14 md:grid-cols-2 md:gap-20"
        >
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Mission</h3>
            <span aria-hidden="true" className="mt-3 block h-0.5 w-10 bg-primary" />
            <p className="mt-5 max-w-md text-pretty font-display text-lg leading-relaxed text-secondary sm:text-xl">
              &ldquo;To provide Filipino businesses with only the best trained and qualified employees available in the
              country.&rdquo;
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Vision</h3>
            <span aria-hidden="true" className="mt-3 block h-0.5 w-10 bg-primary" />
            <p className="mt-5 max-w-md text-pretty font-display text-lg leading-relaxed text-secondary sm:text-xl">
              &ldquo;To deliver &lsquo;Better people for better results&rsquo; to 200 client firms and provide a great
              employment experience to 15,000 deployed personnel across the Philippines.&rdquo;
            </p>
          </div>
        </m.div>

        {/* Values */}
        <div className="mt-14 grid gap-6 border-t border-border pt-10 sm:mt-24 sm:pt-14 lg:grid-cols-12 lg:gap-20">
          <Reveal className="lg:col-span-4">
            <h3 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">Our values</h3>
          </Reveal>
          <m.ul {...staggerParent(0.1)} className="divide-y divide-border lg:col-span-8">
            {values.map((value) => (
              <m.li
                key={value.name}
                {...staggerItem}
                className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-6"
              >
                <h4 className="text-lg font-bold tracking-tight text-secondary">{value.name}</h4>
                <p className="text-base leading-relaxed text-muted-foreground">{value.description}</p>
              </m.li>
            ))}
          </m.ul>
        </div>
      </div>
    </section>
  );
};
