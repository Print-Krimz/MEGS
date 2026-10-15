import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, MapPin, Phone } from "lucide-react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { scrollToSection } from "../../lib/scrollToSection";
import { Button } from "@/components/shadcn/button";
import { cn } from "../../lib/shadcn-utils";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

type Region = "Luzon & NCR" | "Visayas" | "Mindanao";

interface Branch {
  id: string;
  name: string;
  region: Region;
  isHQ: boolean;
  address: string;
  landmark?: string;
  phone: string;
  mobile: string;
  latLng: [number, number];
}

export const BRANCHES: Branch[] = [
  {
    id: "valenzuela",
    name: "Valenzuela Central Office",
    region: "Luzon & NCR",
    isHQ: true,
    address: "#9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City",
    landmark: "Central Operations & Executive Headquarters",
    phone: "(02) 8292-1234",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.6991, 120.984],
  },
  {
    id: "quezon-city",
    name: "Quezon City Branch",
    region: "Luzon & NCR",
    isHQ: false,
    address: "Rm 207, 2nd Floor, STG Bldg., 109 P. Tuazon, Cubao, Quezon City",
    landmark: "Recruitment & Applicant Interview Center",
    phone: "(02) 8911-5678",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.6195, 121.0511],
  },
  {
    id: "binan",
    name: "Biñan, Laguna Branch",
    region: "Luzon & NCR",
    isHQ: false,
    address: "3rd Fl, Uniworld Bldg. 347, Burgos St., Brgy Vicente, Biñan, Laguna",
    landmark: "Southern Luzon Industrial Workforce Hub",
    phone: "(049) 511-2345",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.3414, 121.0803],
  },
  {
    id: "batangas",
    name: "Tanauan, Batangas Branch",
    region: "Luzon & NCR",
    isHQ: false,
    address: "PJAR Trading, (In front of New City Hall), Brgy Santor, Tanauan City, Batangas",
    landmark: "CALABARZON Industrial Corridor Hub",
    phone: "(043) 778-9012",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.0854, 121.1504],
  },
  {
    id: "cebu",
    name: "Cebu Branch",
    region: "Visayas",
    isHQ: false,
    address: "RM 301, Du Sui Bldg, North Road, Brgy Jagobiao, Mandaue City, Cebu",
    landmark: "Central Visayas Regional Center",
    phone: "(032) 345-6789",
    mobile: "0923-745-4050 (Sun/Smart)",
    latLng: [10.362, 123.9472],
  },
  {
    id: "davao",
    name: "Davao City Branch",
    region: "Mindanao",
    isHQ: false,
    address: "D2 2F, C LAT Bldg, Bonifacio St, Davao City",
    landmark: "Southern Mindanao Operations Hub",
    phone: "(082) 221-3456",
    mobile: "0923-745-4050 (Sun/Smart)",
    latLng: [7.0707, 125.6087],
  },
];

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

  return (
    <section id="branches" aria-labelledby="branches-heading" className="scroll-mt-20 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="branches-heading"
          title="6 strategic branch offices across the Philippines"
          intro="Operations run from our main office in Valenzuela City. Branches across Luzon, Visayas and Mindanao support client sites close to where the work is."
        />

        <Reveal className="mt-10">
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
                >
                  {r === "ALL" ? "All (6)" : r}
                </Button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Map */}
            <div className="lg:sticky lg:top-24 lg:col-span-7">
              <img
                src="/images/canva-ref/megs-logo-480.jpg"
                alt="Map of the Philippines with MEGS Branch Locations"
                className="sr-only"
              />
              <div className="relative z-0 h-[380px] w-full overflow-hidden rounded-lg border border-border bg-muted sm:h-[460px]">
                <div
                  ref={mapContainerRef}
                  className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  tabIndex={0}
                  aria-label="Interactive map of the Philippines showing MEGS branch offices"
                  aria-busy={!mapReady && !mapLoadFailed}
                />
                {!mapReady && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" role="status">
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
                    className="h-9 px-0"
                    onClick={() => {
                      setRegionFilter("ALL");
                      setSelectedBranchId("valenzuela");
                    }}
                  >
                    Reset view
                  </Button>
                </div>
              </div>
            </div>

            {/* Selected branch + list */}
            <div className="lg:col-span-5">
              <div className="rounded-lg border border-border bg-muted/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-muted-foreground">
                    {selectedBranch.region}
                    {selectedBranch.isHQ && <span className="font-semibold text-secondary">Head office</span>}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyAddress(selectedBranch.id, selectedBranch.address)}
                  >
                    {copiedId === selectedBranch.id ? (
                      <Check data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Copy data-icon="inline-start" aria-hidden="true" />
                    )}
                    {copiedId === selectedBranch.id ? "Address copied" : "Copy address"}
                  </Button>
                </div>

                <h3 className="mt-2 text-xl font-bold tracking-tight text-secondary">{selectedBranch.name}</h3>
                <p className="mt-2 text-base leading-relaxed text-foreground">{selectedBranch.address}</p>
                {selectedBranch.landmark && <p className="mt-1 text-sm text-muted-foreground">{selectedBranch.landmark}</p>}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-4">
                  <div className="flex items-start gap-2 text-base text-foreground tabular-nums">
                    <Phone className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="flex flex-col">
                      <span>{selectedBranch.phone}</span>
                      <span>{selectedBranch.mobile}</span>
                    </div>
                  </div>
                  <a
                    href="#contact"
                    onClick={(e) => scrollToSection(e, "#contact")}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Direct branch inquiries
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <ul className="mt-4 divide-y divide-border border-y border-border">
                {filteredBranches.map((branch) => {
                  const isActive = branch.id === selectedBranchId;
                  return (
                    <li key={branch.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBranchId(branch.id)}
                        aria-pressed={isActive}
                        className={cn(
                          "flex min-h-11 w-full items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          isActive && "bg-muted",
                        )}
                      >
                        <MapPin
                          className={cn("mt-0.5 size-4 shrink-0", branch.isHQ ? "text-primary" : "text-muted-foreground")}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-secondary">{branch.name}</span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">{branch.address}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
