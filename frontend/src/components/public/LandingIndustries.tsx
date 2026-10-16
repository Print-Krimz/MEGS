import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "../../lib/shadcn-utils";
import { scrollToSection } from "../../lib/scrollToSection";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

interface Industry {
  id: string;
  name: string;
  image: string;
  description: string;
  roles: string[];
}

const industries: Industry[] = [
  {
    id: "manufacturing",
    name: "Manufacturing",
    image: "/images/canva-ref/industries/manufacturing",
    description:
      "Electronics assembly, food processing lines, plastic extrusion, packaging operations, and precision machinery plants across economic zones.",
    roles: ["Machine Operators", "Assembly Crew", "QA/QC Personnel", "Production Supervisors"],
  },
  {
    id: "logistics",
    name: "Logistics & Transport",
    image: "/images/canva-ref/industries/logistics",
    description:
      "Multi-modal freight forwarding, delivery fleet operations, courier transport, route planning, and national supply chain dispatching.",
    roles: ["Delivery Drivers", "Messengers", "Fleet Dispatchers", "Logistics Clerks"],
  },
  {
    id: "warehousing",
    name: "Warehousing & Storage",
    image: "/images/canva-ref/industries/warehousing",
    description:
      "High-density distribution centers, inventory scanning, goods receiving, palletizing, order sorting, and industrial forklift maneuvers.",
    roles: ["Forklift Operators", "Warehouse Crew", "Material Handlers", "Inventory Encoders"],
  },
  {
    id: "retail",
    name: "Retail, Sales & Distribution",
    image: "/images/canva-ref/industries/retail",
    description:
      "Hypermarkets, department stores, retail chains, and fast-moving consumer goods (FMCG) distribution networks.",
    roles: ["Sales Promo / Merchandisers", "Cashiers & Baggers", "Brand Ambassadors", "Stock Clerks"],
  },
  {
    id: "hospitality",
    name: "Hotel & Restaurant",
    image: "/images/canva-ref/industries/hospitality",
    description:
      "Premier hotels, restaurant chains, catering services, banquet halls, institutional cafeterias, and hospitality dining floors.",
    roles: ["Food Servers", "Kitchen Helpers", "Dining Stewards", "Banquet Crew"],
  },
  {
    id: "gaming",
    name: "Gaming & Casino",
    image: "/images/canva-ref/industries/casino",
    description:
      "Integrated resort gaming facilities, entertainment complexes, high-volume recreation centers, and guest operations support.",
    roles: ["Floor Attendants", "Cashier Personnel", "Utility Helpers", "Front-Line Support"],
  },
];

type TileLayout = "feature" | "side" | "plain";

/** Rendered widths: the feature tile is ~700px wide on desktop, side tiles ~200px, plain tiles ~390px. */
const IMAGE_SIZES: Record<TileLayout, string> = {
  feature: "(min-width: 1280px) 700px, (min-width: 1024px) 54vw, 100vw",
  side: "(min-width: 1024px) 200px, 100vw",
  plain: "(min-width: 1024px) 390px, 100vw",
};

const IndustryTile: React.FC<{ industry: Industry; layout: TileLayout }> = ({ industry, layout }) => (
  <article
    className={cn(
      "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background",
      layout === "side" && "lg:grid lg:grid-cols-[2fr_3fr]"
    )}
  >
    <div
      className={cn(
        "relative aspect-[16/10] w-full bg-muted",
        layout === "feature" && "lg:aspect-auto lg:min-h-72 lg:flex-1",
        layout === "side" && "lg:aspect-auto lg:h-full"
      )}
    >
      <img
        src={`${industry.image}-480.webp`}
        srcSet={`${industry.image}-480.webp 480w, ${industry.image}-800.webp 800w`}
        sizes={IMAGE_SIZES[layout]}
        alt={`${industry.name} workers on site`}
        loading="lazy"
        decoding="async"
        width={800}
        height={500}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
    <div className={cn("flex flex-col border-t border-border p-5 sm:p-6", layout === "side" && "lg:border-l lg:border-t-0")}>
      <h3
        className={cn(
          "font-display leading-snug text-secondary",
          layout === "feature" ? "text-2xl" : "text-lg"
        )}
      >
        {industry.name}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{industry.description}</p>
      <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-foreground">
        <span className="font-semibold text-secondary">Key deployed positions: </span>
        {industry.roles.join(", ")}
      </p>
    </div>
  </article>
);

export const LandingIndustries: React.FC = () => {
  const [feature, sideA, sideB, ...rest] = industries;

  return (
    <section id="industries" className="scroll-mt-20 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeader
            title="Partner industries we support"
            intro="Vetted, disciplined manpower matched to the workflows, safety standards, and compliance rules of the industries we serve. Six are shown here; we staff others on request."
            action={
              <Button asChild variant="outline" className="shrink-0">
                <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")}>
                  Inquire for your industry
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              </Button>
            }
          />
        </Reveal>

        <Reveal className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <IndustryTile industry={feature} layout="feature" />
          </div>
          <div className="grid gap-6 lg:col-span-5 lg:grid-rows-2">
            <IndustryTile industry={sideA} layout="side" />
            <IndustryTile industry={sideB} layout="side" />
          </div>
          {rest.map((ind) => (
            <div key={ind.id} className="lg:col-span-4">
              <IndustryTile industry={ind} layout="plain" />
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
};
