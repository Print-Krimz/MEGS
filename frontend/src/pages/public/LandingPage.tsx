import React, { Suspense, lazy, useEffect, useState } from "react";
import { LandingHeader } from "../../components/public/LandingHeader";
import { LandingHero } from "../../components/public/LandingHero";
import { LandingAffiliates } from "../../components/public/LandingAffiliates";
import { LandingAbout } from "../../components/public/LandingAbout";
import { LandingFooter } from "../../components/public/LandingFooter";
import { MotionRoot } from "../../components/public/motion";
import { BRANCHES } from "../../components/public/landing-branches";

// Sections below the fold load after the first paint; the hero and first section stay in the entry chunk.
const loadServices = () => import("../../components/public/LandingServices");
const loadWhyMegs = () => import("../../components/public/LandingWhyMegs");
const loadIndustries = () => import("../../components/public/LandingIndustries");
const loadActivities = () => import("../../components/public/LandingActivities");
const loadJobs = () => import("../../components/public/LandingJobListings");
const loadFeatured = () => import("../../components/public/LandingFeaturedCompanies");
const loadBranches = () => import("../../components/public/LandingBranches");
const loadContact = () => import("../../components/public/LandingContact");

const LandingServices = lazy(() => loadServices().then((m) => ({ default: m.LandingServices })));
const LandingWhyMegs = lazy(() => loadWhyMegs().then((m) => ({ default: m.LandingWhyMegs })));
const LandingIndustries = lazy(() => loadIndustries().then((m) => ({ default: m.LandingIndustries })));
const LandingActivities = lazy(() => loadActivities().then((m) => ({ default: m.LandingActivities })));
const LandingJobListings = lazy(() => loadJobs().then((m) => ({ default: m.LandingJobListings })));
const LandingFeaturedCompanies = lazy(() => loadFeatured().then((m) => ({ default: m.LandingFeaturedCompanies })));
const LandingBranches = lazy(() => loadBranches().then((m) => ({ default: m.LandingBranches })));
const LandingContact = lazy(() => loadContact().then((m) => ({ default: m.LandingContact })));

/** Holds a lazy section's place, and its anchor id, so nav links and layout stay put until it loads. */
const SectionFallback: React.FC<{ id: string; minHeight: number }> = ({ id, minHeight }) => (
  <section id={id} aria-hidden="true" className="scroll-mt-20" style={{ minHeight }} />
);

const SITE_URL = "https://megsinc.com/";

/** Organization and site facts for search engines. Address and phone come from the head-office branch shown on the page. */
function buildStructuredData(): string {
  const hq = BRANCHES.find((b) => b.isHQ);
  const streetParts = hq?.address.split(",").map((part) => part.trim()) ?? [];
  const locality = streetParts.length > 1 ? streetParts.pop() : undefined;
  const phone = hq?.landlines?.[0]?.tel;
  const agency = {
    "@context": "https://schema.org",
    "@type": "EmploymentAgency",
    name: "MAR EMPLOYMENT FOR GOOD SERVICES INC.",
    alternateName: "MEGS",
    url: SITE_URL,
    logo: `${SITE_URL}images/canva-ref/megs-logo-352.webp`,
    image: `${SITE_URL}og-image.png`,
    foundingDate: "1997-05",
    ...(hq && {
      address: {
        "@type": "PostalAddress",
        streetAddress: streetParts.join(", "),
        ...(locality && { addressLocality: locality }),
        addressCountry: "PH",
      },
    }),
    ...(phone && { telephone: phone }),
  };
  const website = { "@context": "https://schema.org", "@type": "WebSite", name: "MEGS", url: SITE_URL };
  return JSON.stringify([agency, website]).replace(/</g, "\\u003c");
}

const STRUCTURED_DATA = buildStructuredData();

export const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  // Fetch the remaining sections once the page has loaded and the browser is idle, so they never compete with first paint.
  useEffect(() => {
    const loaders = [loadServices, loadWhyMegs, loadIndustries, loadActivities, loadJobs, loadFeatured, loadBranches, loadContact];
    const run = () => loaders.forEach((load) => void load().catch(() => undefined));
    let idleHandle: number | undefined;
    let timer: number | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        timer = window.setTimeout(run, 1500);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const handleFindJobs = () => {
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
    // Land keyboard focus in the search field once the scroll settles.
    window.setTimeout(() => {
      document.getElementById("jobs-keyword")?.focus({ preventScroll: true });
    }, 450);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setLocationQuery("");
  };

  return (
    <MotionRoot>
      <link rel="canonical" href={SITE_URL} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />
      <div className="theme-megs flex min-h-screen flex-col bg-page text-foreground selection:bg-secondary selection:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-secondary focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <LandingHeader />

        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <LandingHero onFindJobs={handleFindJobs} />
          <LandingAffiliates />
          <LandingAbout />
          <Suspense fallback={<SectionFallback id="services" minHeight={720} />}>
            <LandingServices />
          </Suspense>
          <Suspense fallback={<SectionFallback id="why-megs" minHeight={640} />}>
            <LandingWhyMegs />
          </Suspense>
          <Suspense fallback={<SectionFallback id="industries" minHeight={720} />}>
            <LandingIndustries />
          </Suspense>
          <Suspense fallback={<SectionFallback id="activities" minHeight={640} />}>
            <LandingActivities />
          </Suspense>
          <Suspense fallback={<SectionFallback id="jobs" minHeight={900} />}>
            <LandingJobListings
              searchQuery={searchQuery}
              locationQuery={locationQuery}
              onSearchChange={setSearchQuery}
              onLocationChange={setLocationQuery}
              onClearSearch={handleClearSearch}
            >
              <Suspense fallback={null}>
                <LandingFeaturedCompanies selectedCompany={searchQuery} onSelectCompany={setSearchQuery} />
              </Suspense>
            </LandingJobListings>
          </Suspense>
          <Suspense fallback={<SectionFallback id="branches" minHeight={760} />}>
            <LandingBranches />
          </Suspense>
          <Suspense fallback={<SectionFallback id="contact" minHeight={900} />}>
            <LandingContact />
          </Suspense>
        </main>

        <LandingFooter />
      </div>
    </MotionRoot>
  );
};

export default LandingPage;
