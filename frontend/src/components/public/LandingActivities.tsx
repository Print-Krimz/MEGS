import React from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { AnimatePresence, EASE_OUT, Reveal, m, onView, useReducedMotion } from "./motion";
import { megsActivityPhotos } from "./megsPhotos";
import { cn } from "../../lib/shadcn-utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";

type ActivityPhoto = ReturnType<typeof megsActivityPhotos>[number];

const navButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-secondary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Gallery of real MEGS events. Renders nothing until activity photos are added. */
export const LandingActivities: React.FC = () => {
  const photos = React.useMemo(() => megsActivityPhotos(), []);
  const reduceMotion = useReducedMotion();
  const [state, setState] = React.useState({ index: 0, dir: 1 });
  const [expanded, setExpanded] = React.useState(false);
  const stripRef = React.useRef<HTMLUListElement>(null);
  const expandRef = React.useRef<HTMLButtonElement>(null);
  const count = photos.length;
  const { index, dir } = state;

  const goTo = React.useCallback(
    (target: number, direction?: number) =>
      setState((prev) => {
        const next = ((target % count) + count) % count;
        return { index: next, dir: direction ?? (next >= prev.index ? 1 : -1) };
      }),
    [count]
  );
  const step = React.useCallback(
    (delta: number) => setState((prev) => ({ index: (((prev.index + delta) % count) + count) % count, dir: delta })),
    [count]
  );

  // Warm the neighbouring photos so a swap never waits on the network.
  React.useEffect(() => {
    if (count < 2) return;
    [index + 1, index - 1].forEach((i) => {
      const img = new Image();
      img.src = photos[((i % count) + count) % count].src;
    });
  }, [index, count, photos]);

  // Keep the active thumbnail in view inside the strip without moving the page.
  React.useEffect(() => {
    const strip = stripRef.current;
    const thumb = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    const left = thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2;
    if (typeof strip.scrollTo === "function") strip.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
  }, [index, reduceMotion]);

  if (count === 0) return null;

  const photo: ActivityPhoto = photos[index];
  const many = count > 1;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!many) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  const slide = reduceMotion
    ? {
        enter: { opacity: 1 },
        center: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 1, transition: { duration: 0 } },
      }
    : {
        enter: (d: number) => ({ clipPath: d >= 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)", scale: 1.05 }),
        center: { clipPath: "inset(0 0 0 0)", scale: 1, transition: { duration: 0.7, ease: EASE_OUT } },
        exit: { opacity: 0, transition: { duration: 0.4, ease: EASE_OUT } },
      };

  return (
    <section id="activities" className="scroll-mt-20 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeader title="Company activities" intro="Recruitment drives, trainings and events from MEGS offices." />
        </Reveal>

        <m.div
          {...onView({ opacity: 0, y: 20 }, { opacity: 1, y: 0 }, { duration: 0.6, ease: EASE_OUT })}
          role="group"
          aria-roledescription="carousel"
          aria-label="Company activity photos"
          onKeyDown={onKeyDown}
          className="mt-10"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted sm:aspect-[16/10] lg:aspect-[2/1]">
            <AnimatePresence initial={false} custom={dir}>
              <m.img
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <button
              ref={expandRef}
              type="button"
              onClick={() => setExpanded(true)}
              aria-label={`Expand photo: ${photo.caption}`}
              className="group absolute inset-0 z-10 cursor-zoom-in focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[6px] focus-visible:outline-white"
            >
              <span
                aria-hidden="true"
                className="absolute bottom-3 right-3 inline-flex size-11 items-center justify-center rounded-full bg-megs-navy-900/80 text-white transition-colors group-hover:bg-megs-navy-900"
              >
                <Maximize2 className="size-4" />
              </span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0" aria-live="polite" aria-atomic="true">
              <p className="truncate text-lg font-semibold text-secondary sm:text-xl">{photo.caption}</p>
              {many && (
                <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                  {index + 1} of {count}
                </p>
              )}
            </div>
            {many && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={navButton}>
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next photo" className={navButton}>
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {many && (
            <ul ref={stripRef} className="mt-4 flex gap-3 overflow-x-auto pb-2" aria-label="Choose a photo">
              {photos.map((item, i) => (
                <li key={item.src} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(i, i >= index ? 1 : -1)}
                    aria-label={`Show photo ${i + 1}: ${item.caption}`}
                    aria-current={i === index ? "true" : undefined}
                    className={cn(
                      "block size-16 overflow-hidden rounded-md bg-muted ring-offset-2 transition-[opacity,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-16 sm:w-24",
                      i === index ? "opacity-100 ring-2 ring-primary" : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={item.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </m.div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          onKeyDown={onKeyDown}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            expandRef.current?.focus({ preventScroll: true });
          }}
          className="theme-megs gap-3 border-0 bg-megs-navy-900 p-3 text-white sm:max-w-5xl sm:p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-snug text-white sm:text-lg">{photo.caption}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/75">
                {many ? `Photo ${index + 1} of ${count}. Use the arrow keys to browse.` : "Company activity photo."}
              </DialogDescription>
            </div>
            <DialogClose
              aria-label="Close"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
          <div className="relative h-[60dvh] overflow-hidden rounded-md bg-black/30">
            <AnimatePresence mode="wait" initial={false}>
              <m.img
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                initial={{ opacity: reduceMotion ? 1 : 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: reduceMotion ? 1 : 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT }}
                className="h-full w-full object-contain"
              />
            </AnimatePresence>
          </div>
          {many && (
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
