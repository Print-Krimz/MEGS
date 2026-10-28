import { useEffect, useRef, useState } from "react";
import { COMPANY_ADDRESS, COMPANY_LAT_LNG } from "../../lib/business-hours";

interface VenueMapProps {
  location?: string | null;
}

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Optional, collapsed-by-default map for the contract-signing venue.
 * Leaflet and its stylesheet load only after the section is first opened.
 * The map is a static snapshot; only the company office has known coordinates.
 */
export function VenueMap({ location }: VenueMapProps) {
  const venue = location?.trim() || COMPANY_ADDRESS;
  const showMap = sameAddress(venue, COMPANY_ADDRESS);
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opened || !showMap || !containerRef.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      try {
        const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
        if (cancelled || !containerRef.current) return;
        map = L.map(containerRef.current, {
          center: [...COMPANY_LAT_LNG],
          zoom: 16,
          dragging: false,
          scrollWheelZoom: false,
          touchZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          zoomControl: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);
        L.marker([...COMPANY_LAT_LNG], { keyboard: false, interactive: false }).addTo(map);
      } catch {
        map?.remove();
        map = null;
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [opened, showMap]);

  return (
    <details
      className="pt-1 text-xs sm:text-sm"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setOpened(true);
      }}
    >
      <summary className="cursor-pointer font-medium text-[#0B315D] hover:underline">View location map</summary>
      <div className="mt-2 space-y-2">
        {showMap && !failed && (
          <div
            ref={containerRef}
            role="img"
            aria-label={`Map showing ${venue}`}
            className="h-[200px] w-full overflow-hidden rounded-lg border border-[#D9E2EC] bg-[#F0F4F8]"
          />
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-medium text-[#0B315D] underline"
        >
          Open in Google Maps
        </a>
      </div>
    </details>
  );
}
