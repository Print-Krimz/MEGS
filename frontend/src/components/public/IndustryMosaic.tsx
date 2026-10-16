import React from "react";
import { ArrowRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";
import { cn } from "../../lib/shadcn-utils";

const TILES = [
  {
    src: "/images/canva-ref/industries/warehousing-480.webp",
    label: "Warehousing",
    alt: "Forklift operator moving pallets in a warehouse",
    pos: "object-[22%_72%]",
  },
  {
    src: "/images/canva-ref/industries/casino-480.webp",
    label: "Gaming",
    alt: "Casino staff and players at a roulette table",
    pos: "object-[50%_30%]",
  },
  {
    src: "/images/canva-ref/industries/retail-480.webp",
    label: "Retail",
    alt: "Shopper walking down a supermarket aisle",
    pos: "object-[58%_58%]",
  },
  {
    src: "/images/canva-ref/industries/hospitality-480.webp",
    label: "Hospitality",
    alt: "Guests dining at a restaurant table",
    pos: "object-[48%_55%]",
  },
];

interface IndustryMosaicProps {
  className?: string;
  showLabels?: boolean;
  eager?: boolean;
}

/** Four real client-industry photographs, so the page does not imply a single sector. */
export const IndustryMosaic: React.FC<IndustryMosaicProps> = ({ className, showLabels = false, eager = false }) => (
  <div className={cn("grid grid-cols-2 gap-1.5", className)}>
    {TILES.map((tile) => (
      <figure key={tile.label} className="relative overflow-hidden rounded-md bg-muted">
        <img
          src={tile.src}
          alt={tile.alt}
          width={480}
          height={320}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={cn("aspect-[4/3] size-full object-cover", tile.pos)}
        />
        {showLabels && (
          <figcaption className="absolute inset-x-0 bottom-0 bg-megs-navy-900 px-3 py-1.5 text-xs font-medium text-white">
            {tile.label}
          </figcaption>
        )}
      </figure>
    ))}
  </div>
);

/** The mosaic as a set of examples, with a pointer to the full industries section. */
export const IndustryExamples: React.FC<{ className?: string; mosaicClassName?: string; eager?: boolean }> = ({
  className,
  mosaicClassName,
  eager,
}) => (
  <div className={className}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-0">
      <p className="text-sm font-medium text-foreground">Examples of the sectors we staff</p>
      <a
        href="#industries"
        onClick={(e) => scrollToSection(e, "#industries")}
        className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
      >
        Explore all industries
        <ArrowRight className="size-4" aria-hidden="true" />
      </a>
    </div>
    <IndustryMosaic showLabels eager={eager} className={mosaicClassName} />
  </div>
);
