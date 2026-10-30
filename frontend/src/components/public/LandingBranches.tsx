import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronRight, Copy, MapPin, Phone } from "lucide-react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import { cn } from "../../lib/shadcn-utils";
import { SectionHeader } from "./SectionHeader";
import { AnimatePresence, EASE_OUT, Reveal, m, onView, staggerItem, staggerParent } from "./motion";
import { BRANCHES } from "./landing-branches";

const REGION_OPTIONS = ["ALL", "Luzon & NCR", "Visayas", "Mindanao"] as const;
type RegionFilter = (typeof REGION_OPTIONS)[number];

const REGION_VIEW: Record<RegionFilter, { center: [number, number]; zoom: number }> = {
  ALL: { center: [12.8797, 121.774], zoom: 6 },
  "Luzon & NCR": { center: [14.45, 121.05], zoom: 9 },
  Visayas: { center: [10.362, 123.9472], zoom: 10 },
  Mindanao: { center: [7.0707, 125.6087], zoom: 10 },
};

export const LandingBranches: React.FC = () => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("valenzuela");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [key: string]: LeafletMarker }>({});
  const [mapInRange, setMapInRange] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  const filteredBranches = regionFilter === "ALL" ? BRANCHES : BRANCHES.filter((b) => b.region === regionFilter);
  const selectedBranch = BRANCHES.find((b) => b.id === selectedBranchId) || BRANCHES[0];

  const handleCopyAddress = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Defer the map library and its stylesheet until the map is close to view.
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === "undefined") {
      setMapInRange(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMapInRange(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapInRange || !mapContainerRef.current) return;
    let cancelled = false;
    let initializingMap: LeafletMap | null = null;

    const initializeMap = async () => {
      try {
        const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: REGION_VIEW.ALL.center,
          zoom: REGION_VIEW.ALL.zoom,
          minZoom: 5,
          maxZoom: 18,
          scrollWheelZoom: false,
        });
        initializingMap = map;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        BRANCHES.forEach((b) => {
          const pinColor = b.isHQ ? "var(--color-primary)" : "var(--color-secondary)";
          const label = b.name.replace(" Branch", "").replace(" Central Office", " (HQ)");
          const iconHtml = `
            <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer;">
              <div class="megs-map-label" style="background:var(--color-secondary); color:white; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600; font-family:inherit; white-space:nowrap; margin-bottom:2px;">${label}</div>
              <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.37 0 0 5.37 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37 18.63 0 12 0Z" fill="${pinColor}"/>
                <circle cx="12" cy="11" r="5" fill="white"/>
                <circle cx="12" cy="11" r="2.5" fill="${pinColor}"/>
              </svg>
            </div>`;
          const icon = L.divIcon({ className: "megs-map-marker", html: iconHtml, iconSize: [24, 30], iconAnchor: [12, 30] });
          const marker = L.marker(b.latLng, { icon, title: b.name, keyboard: true }).addTo(map);
          marker.on("click", () => setSelectedBranchId(b.id));
          markersRef.current[b.id] = marker;
        });

        // Pins sit close together in Luzon, so labels only show when zoomed in, hovered or selected.
        const syncLabels = () => {
          mapContainerRef.current?.classList.toggle("megs-labels-hidden", map.getZoom() < 9);
        };
        map.on("zoomend", syncLabels);
        syncLabels();

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch {
        initializingMap?.remove();
        setMapLoadFailed(true);
      }
    };

    void initializeMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapInRange]);

  // Keep the selected pin's label visible
  useEffect(() => {
    if (!mapReady) return;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      marker.getElement()?.classList.toggle("megs-active", id === selectedBranchId);
    });
  }, [mapReady, selectedBranchId]);

  // Camera follows the selected branch
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    try {
      mapInstanceRef.current.flyTo(selectedBranch.latLng, 12, { duration: 1.0 });
    } catch {
      // Ignored in non-DOM tests
    }
  }, [mapReady, selectedBranch]);

  // Camera follows the region filter
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    try {
      const view = REGION_VIEW[regionFilter];
      mapInstanceRef.current.flyTo(view.center, view.zoom, { duration: 0.8 });
    } catch {
      // Ignored in non-DOM tests
    }
  }, [mapReady, regionFilter]);

  const isHQ = selectedBranch.isHQ;
  const phoneDigits = selectedBranch.mobile.replace(/\(.*\)/, "").replace(/\D/g, "");

  return (
    <section id="branches" aria-labelledby="branches-heading" className="scroll-mt-20 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeader
            id="branches-heading"
            title="Six offices, Luzon to Mindanao"
            intro="Our main office is in Valenzuela City, with five branches across Luzon, Visayas and Mindanao."
          />
        </Reveal>

        <Reveal className="mt-8">
          <div role="group" aria-label="Filter branches by region" className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map((r) => {
              const isActive = regionFilter === r;
              return (
                <Button
                  key={r}
                  type="button"
                  variant={isActive ? "secondary" : "outline"}
                  onClick={() => setRegionFilter(r)}
                  aria-pressed={isActive}
                  className="transition-[background-color,color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
                >
                  {r === "ALL" ? "All (6)" : r}
                </Button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:h-[41rem] lg:grid-cols-12 lg:gap-12 xl:h-[37.5rem]">
          {/* Map: fills the column so it ends level with the list */}
          <div className="lg:col-span-7 lg:min-h-0">
            <m.div
              {...onView({ opacity: 0, y: 20 }, { opacity: 1, y: 0 }, { duration: 0.5, ease: EASE_OUT })}
              className="flex h-full flex-col"
            >
              <div className="relative z-0 h-[340px] w-full overflow-hidden rounded-lg border border-border bg-muted sm:h-[440px] lg:h-auto lg:min-h-0 lg:flex-1">
                <div
                  ref={mapContainerRef}
                  className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  tabIndex={0}
                  role="region"
                  aria-label="Interactive map of the Philippines showing MEGS branch offices"
                  aria-busy={!mapReady && !mapLoadFailed}
                />
                {!mapReady && (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
                    role="status"
                  >
                    {mapLoadFailed ? "Map is temporarily unavailable." : "Loading branch map…"}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <p className="text-foreground">Active Branch: {selectedBranch.name.split(" ")[0]}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
                    Head office
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-secondary" aria-hidden="true" />
                    Branch
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    className="h-9 px-0 pointer-coarse:h-11"
                    onClick={() => {
                      setRegionFilter("ALL");
                      setSelectedBranchId("valenzuela");
                    }}
                  >
                    Reset view
                  </Button>
                </div>
              </div>
            </m.div>
          </div>

          {/* Selected branch + list */}
          <div className="flex min-h-0 flex-col lg:col-span-5">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={selectedBranch.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className={cn(
                  "shrink-0 rounded-lg border p-5 sm:p-6",
                  isHQ ? "border-megs-navy-900 bg-megs-navy-900 text-white" : "border-border bg-muted/60"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={cn(
                      "flex flex-wrap items-center gap-x-2 text-sm font-medium",
                      isHQ ? "text-white/75" : "text-muted-foreground"
                    )}
                  >
                    {selectedBranch.region}
                    {isHQ && <span className="font-semibold text-white">Head office</span>}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyAddress(selectedBranch.id, selectedBranch.address)}
                    className={cn(
                      "active:scale-[0.97] pointer-coarse:min-h-11 motion-reduce:active:scale-100",
                      isHQ && "text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/60"
                    )}
                  >
                    {copiedId === selectedBranch.id ? (
                      <Check data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Copy data-icon="inline-start" aria-hidden="true" />
                    )}
                    {copiedId === selectedBranch.id ? "Address copied" : "Copy address"}
                  </Button>
                </div>

                <h3 className={cn("mt-2 text-xl font-bold tracking-tight", isHQ ? "text-white" : "text-secondary")}>
                  {selectedBranch.name}
                </h3>
                <p className={cn("mt-2 text-base leading-relaxed", isHQ ? "text-white/90" : "text-foreground")}>
                  {selectedBranch.address}
                </p>
                {selectedBranch.landmark && (
                  <p className={cn("mt-1 text-sm", isHQ ? "text-white/75" : "text-muted-foreground")}>
                    {selectedBranch.landmark}
                  </p>
                )}

                <div
                  className={cn(
                    "mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-4",
                    isHQ ? "border-white/15" : "border-border"
                  )}
                >
                  <div className="flex items-start gap-2 text-base tabular-nums">
                    <Phone
                      className={cn("mt-1 size-4 shrink-0", isHQ ? "text-white/75" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col">
                      {[{ display: selectedBranch.mobile, tel: phoneDigits }, ...(selectedBranch.landlines ?? [])].map((line) => (
                        <a
                          key={line.tel}
                          href={`tel:${line.tel}`}
                          className={cn(
                            "rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 pointer-coarse:py-2.5",
                            isHQ ? "text-white focus-visible:ring-white/60" : "text-foreground focus-visible:ring-ring"
                          )}
                        >
                          {line.display}
                        </a>
                      ))}
                    </div>
                  </div>
                  <a
                    href="#contact"
                    onClick={(e) => scrollToSection(e, "#contact")}
                    className={cn(
                      "group inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2",
                      isHQ ? "text-white focus-visible:ring-white/60" : "text-accent focus-visible:ring-ring"
                    )}
                  >
                    Request a proposal
                    <ArrowRight
                      className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </m.div>
            </AnimatePresence>

            <m.ul
              key={regionFilter}
              {...staggerParent(0.04)}
              className="mt-4 min-h-0 divide-y divide-border overflow-y-auto border-y border-border"
            >
              {filteredBranches.map((branch) => {
                const isActive = branch.id === selectedBranchId;
                return (
                  <m.li key={branch.id} {...staggerItem}>
                    <button
                      type="button"
                      onClick={() => setSelectedBranchId(branch.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "group flex min-h-11 w-full items-center gap-3 px-2 py-2.5 text-left transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isActive && "bg-muted"
                      )}
                    >
                      <MapPin
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-200",
                          branch.isHQ ? "text-primary" : "text-muted-foreground",
                          isActive && "scale-125 text-primary"
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="block font-semibold text-secondary">{branch.name}</span>
                          {branch.isHQ && <span className="text-xs font-semibold text-primary">Head office</span>}
                        </span>
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-secondary transition-[opacity,transform] duration-200",
                          isActive
                            ? "translate-x-0 opacity-100"
                            : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </m.li>
                );
              })}
            </m.ul>
          </div>
        </div>
      </div>
    </section>
  );
};
