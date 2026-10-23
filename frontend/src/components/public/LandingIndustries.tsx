import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "../../lib/shadcn-utils";
import { scrollToSection } from "../../lib/scrollToSection";
import { SectionHeader } from "./SectionHeader";
import { Reveal, m, staggerItem, staggerParent } from "./motion";
import { megsPhoto, type MegsPhoto } from "./megsPhotos";

interface Industry {
  id: string;
  name: string;
  /** Licensed stock fallback until MEGS supplies its own photo for the slot. */
  stock?: { base: string; alt: string; pos: string };
  description: string;
  roles: string[];
}

const industries: Industry[] = [
  {
    id: "manufacturing",
    stock: {
      base: "/images/stock/industries/manufacturing",
      alt: "Workers in blue uniforms at a factory assembly line",
      pos: "object-[50%_60%]",
    },
    name: "Manufacturing",
    description: "Assembly, packaging and machine operation in plants.",
    roles: ["Production workers", "Machine operators", "QA/QC personnel", "Welders"],
  },
  {
    id: "logistics",
    stock: {
      base: "/images/stock/industries/logistics",
      alt: "Driver in a high-visibility jacket at the back of a truck",
      pos: "object-[40%_55%]",
    },
    name: "Logistics",
    description: "Delivery, courier work and dispatch support.",
    roles: ["Delivery drivers", "Messengers", "Office staff", "Encoders"],
  },
  {
    id: "warehousing",
    name: "Warehousing",
    stock: {
      base: "/images/canva-ref/industries/warehousing",
      alt: "Forklift moving pallets in a warehouse",
      pos: "object-[22%_72%]",
    },
    description: "Receiving, storage, picking and loading.",
    roles: ["Forklift operators", "Warehouse crew", "Encoders", "Utility helpers"],
  },
  {
    id: "retail",
    name: "Retail, sales & distribution",
    stock: {
      base: "/images/canva-ref/industries/retail",
      alt: "Shopper walking down a supermarket aisle",
      pos: "object-[58%_58%]",
    },
    description: "Supermarkets, department stores and distributors.",
    roles: ["Sales promo & merchandisers", "Brand ambassadors", "Cashiers & baggers"],
  },
  {
    id: "hospitality",
    name: "Hotel & restaurant",
    stock: {
      base: "/images/canva-ref/industries/hospitality",
      alt: "Guests dining at a restaurant table",
      pos: "object-[48%_55%]",
    },
    description: "Hotels, restaurants and catering.",
    roles: ["Food servers", "Utility helpers", "Cashiers"],
  },
  {
    id: "gaming",
    name: "Gaming & casino",
    stock: {
      base: "/images/canva-ref/industries/casino",
      alt: "Players at a casino roulette table",
      pos: "object-[50%_30%]",
    },
    description: "Gaming floors and their support teams.",
    roles: ["Cashiers", "Utility helpers", "Office staff"],
  },
];

const IMAGE_SIZES = "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 80vw";

const IndustryImage: React.FC<{ industry: Industry; photo: MegsPhoto | null }> = ({ industry, photo }) => {
  const motionClass =
    "size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] group-focus-within:scale-[1.04] motion-reduce:transition-none";
  if (photo) {
    return (
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        sizes={IMAGE_SIZES}
        className={motionClass}
      />
    );
  }
  const stock = industry.stock!;
  return (
    <img
      src={`${stock.base}-800.webp`}
      srcSet={`${stock.base}-480.webp 480w, ${stock.base}-800.webp 800w`}
      sizes={IMAGE_SIZES}
      alt={stock.alt}
      loading="lazy"
      decoding="async"
      width={800}
      height={533}
      className={cn(motionClass, stock.pos)}
    />
  );
};

/**
 * One industry. Photo and no-photo cards share the same media box, name position and body,
 * so a missing photo reads as a deliberate navy tile rather than a gap.
 */
const IndustryCard: React.FC<{ industry: Industry }> = ({ industry }) => {
  const photo = megsPhoto(`industry-${industry.id}`);
  const hasImage = Boolean(photo || industry.stock);

  return (
    <m.li
      {...staggerItem}
      className="group flex w-[80%] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-background transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-secondary/30 hover:shadow-md focus-within:-translate-y-0.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
    >
      <div className={cn(
          "relative aspect-[3/2] overflow-hidden",
          !hasImage && "bg-megs-navy-900"
        )}
      >
        {hasImage && (
          <>
            <IndustryImage industry={industry} photo={photo} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-linear-to-t from-megs-navy-900/85 via-megs-navy-900/25 to-transparent transition-opacity duration-300 group-hover:opacity-90"
            />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <span
            aria-hidden="true"
            className="mb-3 block h-1 w-8 rounded-full bg-primary transition-[width] duration-300 ease-out group-hover:w-14 group-focus-within:w-14 motion-reduce:transition-none"
          />
          <h3
            className={cn(
              "font-display leading-tight text-balance",
              hasImage ? "text-2xl" : "text-3xl"
            )}
          >
            {industry.name}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-base leading-relaxed text-muted-foreground">{industry.description}</p>
        <ul aria-label={`Typical ${industry.name} positions`} className="mt-auto flex flex-wrap gap-2">
          {industry.roles.map((role) => (
            <li
              key={role}
              className="rounded-full border border-border bg-page px-3 py-1 text-sm text-secondary"
            >
              {role}
            </li>
          ))}
        </ul>
      </div>
    </m.li>
  );
};

export const LandingIndustries: React.FC = () => (
  <section id="industries" className="scroll-mt-20 bg-page py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeader
          title="Industries we staff"
          intro="Six industries make up most of our deployments. We staff others on request."
          action={
            <Button asChild variant="outline" className="shrink-0">
              <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                Ask about your industry
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          }
        />
      </Reveal>

      <m.ul
        {...staggerParent(0.07)}
        className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-2 scroll-px-4 [scrollbar-width:none] sm:mx-0 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:pt-0 lg:grid-cols-3 lg:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {industries.map((industry) => (
          <IndustryCard key={industry.id} industry={industry} />
        ))}
      </m.ul>
    </div>
  </section>
);
