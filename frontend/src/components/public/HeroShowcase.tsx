import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { EASE_OUT, m, useReducedMotion, useScroll, useTransform } from "./motion";
import { megsPhoto } from "./megsPhotos";

interface ShowcasePhoto {
  id: "lead" | "retail" | "hospitality";
  /** Industry shown on the photo. Left out for a real MEGS photo, which speaks for itself. */
  label?: string;
  alt: string;
  /** Licensed stock image base path, served as `<base>-480.webp` and `<base>-800.webp`. */
  stockBase?: string;
  /** A real MEGS photo, used instead of the stock files when one has been added. */
  src?: string;
  /** Position and size inside the collage. */
  box: string;
  objectPosition: string;
  /** Which edge the clip reveal starts from. */
  reveal: string;
  delay: number;
  eager?: boolean;
  sizes: string;
}

const REVEAL_START = {
  left: "inset(0 100% 0 0)",
  bottom: "inset(100% 0 0 0)",
  top: "inset(0 0 100% 0)",
} as const;

/*
 * Collage geometry, as a share of the collage width W (aspect 11:8, so its height is 0.727W):
 *   lead         62% wide, 3:2  -> top left,     height 0.413W
 *   retail       42% wide, 2:3  -> top right,    height 0.630W, overlaps the lead by 4%
 *   hospitality  54% wide, 3:2  -> bottom left,  height 0.360W, overlaps the lead by 0.046W
 * Overlaps and gaps are all about 4% of W, so the stagger reads as deliberate.
 */
const buildPhotos = (): ShowcasePhoto[] => {
  const real = megsPhoto("hero");
  return [
    {
      id: "lead",
      label: real ? undefined : "Warehousing",
      alt: real ? real.alt : "Forklift beside tall pallet racking in a warehouse",
      src: real?.src,
      stockBase: real ? undefined : "/images/canva-ref/industries/warehousing",
      box: "left-0 top-0 z-10 w-[62%] aspect-[3/2]",
      objectPosition: "35% 60%",
      reveal: REVEAL_START.left,
      delay: 0.12,
      eager: true,
      sizes: "(min-width: 1024px) 300px, (min-width: 768px) 30vw, 62vw",
    },
    {
      id: "retail",
      label: "Retail",
      alt: "Shopper walking down a supermarket aisle",
      stockBase: "/images/canva-ref/industries/retail",
      box: "right-0 top-0 z-20 w-[42%] aspect-[2/3]",
      objectPosition: "58% 50%",
      reveal: REVEAL_START.bottom,
      delay: 0.22,
      sizes: "(min-width: 1024px) 200px, (min-width: 768px) 16vw, 42vw",
    },
    {
      id: "hospitality",
      label: "Hotel & restaurant",
      alt: "Dishes and drinks on a restaurant table",
      stockBase: "/images/canva-ref/industries/hospitality",
      box: "bottom-0 left-0 z-20 w-[54%] aspect-[3/2]",
      objectPosition: "50% 45%",
      reveal: REVEAL_START.left,
      delay: 0.32,
      sizes: "(min-width: 1024px) 260px, (min-width: 768px) 24vw, 54vw",
    },
  ];
};

const PHOTO_BORDER = "border-4 border-background";

/** True from 1024px up. Parallax is a desktop-only touch. */
const useIsDesktop = () => {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
};

const JOB_ROWS = 3;

/** Newest postings from the first page the jobs section also loads (same key, same request). */
const useOpenJobs = () => {
  const query = useQuery({
    queryKey: ["public-open-jobs", { search: "", location: "", page: 1, pageSize: 4 }],
    queryFn: ({ signal }) =>
      applicantJobsApi.getJobsPage({ search: undefined, location: undefined, page: 1, limit: 4 }, { signal }),
  });
  const latest = React.useMemo(
    () =>
      [...(query.data?.items ?? [])]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, JOB_ROWS),
    [query.data]
  );
  return { isLoading: query.isLoading, isError: query.isError, total: query.data?.total ?? 0, latest };
};

/**
 * The city from a free-text address: drops postal codes, the Metro Manila region and a leading
 * street segment, so "1 Jacker, La Huerta, Parañaque, Metro Manila (NCR), 1700" reads "Parañaque".
 */
const cityOf = (location?: string | null) => {
  const parts = (location ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const hasStreet = /^\d/.test(parts[0] ?? "");
  const places = parts.filter((part) => !/^\d/.test(part) && !/metro manila|\(ncr\)/i.test(part));
  return (hasStreet ? places[places.length - 1] : places[0]) ?? "";
};

const ROW_HEIGHT = "h-12";

const ROW_LINK =
  "group/row -mx-2 flex h-full items-center justify-between gap-3 rounded-md px-2 text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none";

const VIEW_ALL_BUTTON =
  "group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-secondary transition-[background-color,transform] duration-200 hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-megs-navy-900 motion-reduce:transition-none motion-reduce:active:scale-100";

const HiringCard: React.FC<{ onFindJobs: () => void }> = ({ onFindJobs }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { isLoading, isError, total, latest } = useOpenJobs();
  const ready = !isLoading && !isError && total > 0 && latest.length > 0;

  // Mirrors the "View all jobs" button in the jobs section: applicants go straight in, everyone else signs in first.
  const handleViewAll = () => {
    if (isAuthenticated && user?.role === Role.APPLICANT) {
      navigate({ to: "/app/jobs" });
    } else {
      navigate({ to: "/login", search: { redirect: "/app/jobs" } });
    }
  };

  const viewAll = (
    <button type="button" onClick={handleViewAll} className={VIEW_ALL_BUTTON}>
      View all jobs
      <ArrowRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );

  if (!isLoading && !ready) {
    return (
      <>
        <h2 id="hero-hiring-title" className="font-display text-2xl leading-none">
          Now hiring
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          {isError ? "Current openings did not load. You can still browse them after signing in." : "No positions are open right now. Check back soon."}
        </p>
        <div className="mt-4">{viewAll}</div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {isLoading ? (
          <>
            <h2 id="hero-hiring-title" className="sr-only">
              Now hiring
            </h2>
            <div aria-hidden="true" className="flex h-16 flex-col justify-center gap-2">
              <span className="h-4 w-24 animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
              <span className="h-9 w-40 animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
            </div>
          </>
        ) : (
          <div className="flex h-16 flex-col justify-center">
            <h2 id="hero-hiring-title" className="font-display text-lg leading-none">
              Now hiring
            </h2>
            <p className="mt-1.5 flex items-baseline gap-2 leading-none">
              <span aria-hidden="true" className="font-display text-5xl tabular-nums">
                {total}
              </span>
              <span className="text-sm text-white/80">
                <span className="sr-only">{total} </span>open {total === 1 ? "position" : "positions"}
              </span>
            </p>
          </div>
        )}
        {viewAll}
      </div>

      <ul className="mt-3 divide-y divide-white/15 border-t border-white/15" aria-busy={isLoading}>
        {isLoading
          ? Array.from({ length: JOB_ROWS }, (_, i) => (
              <li key={i} aria-hidden="true" className={`flex items-center ${ROW_HEIGHT}`}>
                <span className="block h-4 w-3/4 animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
              </li>
            ))
          : latest.map((job) => {
              const city = cityOf(job.location || job.mrf?.location);
              return (
                <li key={job.id} className={ROW_HEIGHT}>
                  <a
                    href="#jobs"
                    onClick={(e) => {
                      e.preventDefault();
                      onFindJobs();
                    }}
                    className={ROW_LINK}
                  >
                    {/* Title and city share one line; the city is muted so the title still leads. */}
                    <span className="line-clamp-2 text-sm font-semibold leading-snug">
                      {city ? `${job.title}, ` : job.title}
                      {city ? <span className="font-normal text-white/70">{city}</span> : null}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-white/50 transition-[transform,color] duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-white group-focus-visible/row:text-white motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              );
            })}
      </ul>
    </>
  );
};

export interface HeroShowcaseProps {
  onFindJobs: () => void;
}

/**
 * Right side of the hero: three overlapping industry photos and a live "Now hiring" card below them.
 * Photos reveal one after another (0.1s apart), then the card rises. On desktop each layer drifts a
 * few pixels on scroll. Under reduced motion everything renders in its final state with no parallax.
 */
export const HeroShowcase: React.FC<HeroShowcaseProps> = ({ onFindJobs }) => {
  const reduceMotion = !!useReducedMotion();
  const desktop = useIsDesktop();
  const parallax = desktop && !reduceMotion;
  const photos = React.useMemo(buildPhotos, []);

  // Each layer travels a different distance for depth. All stay under 30px.
  const { scrollY } = useScroll();
  const range = [0, 700];
  const leadY = useTransform(scrollY, range, [0, -8]);
  const retailY = useTransform(scrollY, range, [0, -22]);
  const hospitalityY = useTransform(scrollY, range, [0, -14]);
  const travel = { lead: leadY, retail: retailY, hospitality: hospitalityY } as const;
  const cardY = useTransform(scrollY, range, [0, -6]);

  return (
    <div className="grid w-full max-w-md gap-4 md:max-w-none md:grid-cols-2 md:items-start md:gap-6 lg:grid-cols-1 lg:gap-4">
      <div className="relative aspect-[11/8] w-full">
        {photos.map((photo) => (
          <m.div
            key={photo.id}
            style={parallax ? { y: travel[photo.id] } : undefined}
            className={`absolute ${photo.box}`}
          >
            <m.div
              initial={reduceMotion ? false : { clipPath: photo.reveal }}
              animate={reduceMotion ? undefined : { clipPath: "inset(0 0 0 0)" }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: photo.delay }}
              className={`group relative size-full overflow-hidden rounded-lg bg-muted ${PHOTO_BORDER}`}
            >
              <div className="size-full transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                <m.img
                  src={photo.src ?? `${photo.stockBase}-800.webp`}
                  srcSet={photo.stockBase ? `${photo.stockBase}-480.webp 480w, ${photo.stockBase}-800.webp 800w` : undefined}
                  sizes={photo.stockBase ? photo.sizes : undefined}
                  alt={photo.alt}
                  width={800}
                  height={533}
                  loading={photo.eager ? "eager" : "lazy"}
                  fetchPriority={photo.eager ? "high" : undefined}
                  decoding="async"
                  initial={reduceMotion ? false : { scale: 1.12 }}
                  animate={reduceMotion ? undefined : { scale: 1 }}
                  transition={{ duration: 0.8, ease: EASE_OUT, delay: photo.delay }}
                  style={{ objectPosition: photo.objectPosition }}
                  className="size-full object-cover"
                />
              </div>
              {photo.label && (
                <span className="absolute left-2 top-2 rounded-md bg-background px-2 py-1 text-xs font-semibold leading-none text-secondary">
                  {photo.label}
                </span>
              )}
            </m.div>
          </m.div>
        ))}
      </div>

      <m.div style={parallax ? { y: cardY } : undefined} className="relative z-30">
        <m.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.6 }}
        >
          <section
            aria-labelledby="hero-hiring-title"
            className="relative isolate overflow-hidden rounded-lg bg-megs-navy-900 p-5 text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-1 bg-primary" />
            <div className="relative pt-1">
              <HiringCard onFindJobs={onFindJobs} />
            </div>
          </section>
        </m.div>
      </m.div>
    </div>
  );
};
