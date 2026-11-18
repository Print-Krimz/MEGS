import React, { Suspense, lazy, useState } from "react";
import { LandingHeader } from "../../components/public/LandingHeader";
import { LandingHero } from "../../components/public/LandingHero";
import { LandingJobListings } from "../../components/public/LandingJobListings";
import { LandingFeaturedCompanies } from "../../components/public/LandingFeaturedCompanies";
import { LandingAffiliates } from "../../components/public/LandingAffiliates";
import { LandingAbout } from "../../components/public/LandingAbout";
import { LandingFooter } from "../../components/public/LandingFooter";
import { BackToTopButton } from "../../components/public/BackToTopButton";
import { PublicJobDetailDialog } from "../../components/public/PublicJobDetailDialog";
import { MotionRoot } from "../../components/public/motion";
import { BRANCHES } from "../../components/public/landing-branches";
import type { JobPosting } from "../../lib/api/applicant-jobs.api";

// Sections below the immediate job board load after the first paint.
const LandingIndustries = lazy(() =>
  import("../../components/public/LandingIndustries").then((m) => ({ default: m.LandingIndustries }))
);
const LandingServices = lazy(() =>
  import("../../components/public/LandingServices").then((m) => ({ default: m.LandingServices }))
);
const LandingWhyMegs = lazy(() =>
  import("../../components/public/LandingWhyMegs").then((m) => ({ default: m.LandingWhyMegs }))
);
const LandingActivities = lazy(() =>
  import("../../components/public/LandingActivities").then((m) => ({ default: m.LandingActivities }))
);
const LandingBranches = lazy(() =>
  import("../../components/public/LandingBranches").then((m) => ({ default: m.LandingBranches }))
);
const LandingContact = lazy(() =>
  import("../../components/public/LandingContact").then((m) => ({ default: m.LandingContact }))
);

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
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedEmployer, setSelectedEmployer] = useState("");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);

  const scrollToJobs = (focusHeading = false) => {
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
    if (focusHeading) {
      window.setTimeout(() => {
        document.getElementById("jobs-heading")?.focus({ preventScroll: true });
      }, 450);
    }
  };

  const handleFindJobs = () => {
    scrollToJobs(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value !== selectedEmployer) setSelectedEmployer("");
    setSelectedCategory("");
    setPage(1);
  };

  const handleLocationChange = (value: string) => {
    setLocationQuery(value);
    setPage(1);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    scrollToJobs(false);
  };

  const handleSelectPopularRole = (role: string) => {
    const next = searchQuery === role ? "" : role;
    setSearchQuery(next);
    setSelectedEmployer("");
    setSelectedCategory("");
    setPage(1);
    if (next) scrollToJobs(false);
  };

  const handleSelectIndustryRole = (roleQuery: string, industryName: string) => {
    setSearchQuery(roleQuery);
    setSelectedCategory(industryName);
    setSelectedEmployer("");
    setPage(1);
    scrollToJobs(false);
  };

  const handleSelectEmployer = (companyName: string) => {
    setSelectedEmployer(companyName);
    setSearchQuery(companyName);
    setSelectedCategory("");
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setLocationQuery("");
    setSelectedCategory("");
    setSelectedEmployer("");
    setPage(1);
  };

  const handleClearKeyword = () => {
    setSearchQuery("");
    setSelectedEmployer("");
    setPage(1);
  };

  const handleClearLocation = () => {
    setLocationQuery("");
    setPage(1);
  };

  const handleClearCategory = () => {
    setSelectedCategory("");
    setPage(1);
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
          <LandingHero
            searchQuery={searchQuery}
            locationQuery={locationQuery}
            onSearchChange={handleSearchChange}
            onLocationChange={handleLocationChange}
            onSearchSubmit={handleSearchSubmit}
            onSelectPopularRole={handleSelectPopularRole}
            onFindJobs={handleFindJobs}
            onSelectJob={setSelectedJob}
          />

          <LandingJobListings
            searchQuery={searchQuery}
            locationQuery={locationQuery}
            selectedCategory={selectedCategory}
            selectedEmployer={selectedEmployer}
            page={page}
            onPageChange={setPage}
            onClearSearch={handleClearSearch}
            onClearKeyword={handleClearKeyword}
            onClearLocation={handleClearLocation}
            onClearCategory={handleClearCategory}
            onSelectJob={setSelectedJob}
          >
            <LandingFeaturedCompanies
              selectedCompany={selectedEmployer || searchQuery}
              onSelectCompany={handleSelectEmployer}
            />
          </LandingJobListings>

          <LandingAffiliates />

          <Suspense fallback={<SectionFallback id="industries" minHeight={720} />}>
            <LandingIndustries
              activeSearchQuery={searchQuery}
              activeCategory={selectedCategory}
              onSelectRole={handleSelectIndustryRole}
            />
          </Suspense>

          <LandingAbout />

          <Suspense fallback={<SectionFallback id="services" minHeight={720} />}>
            <LandingServices />
          </Suspense>
          <Suspense fallback={<SectionFallback id="why-megs" minHeight={640} />}>
            <LandingWhyMegs />
          </Suspense>
          <Suspense fallback={<SectionFallback id="activities" minHeight={640} />}>
            <LandingActivities />
          </Suspense>
          <Suspense fallback={<SectionFallback id="branches" minHeight={760} />}>
            <LandingBranches />
          </Suspense>
          <Suspense fallback={<SectionFallback id="contact" minHeight={900} />}>
            <LandingContact />
          </Suspense>
        </main>

        <LandingFooter />
        <BackToTopButton />

        <PublicJobDetailDialog
          job={selectedJob}
          open={Boolean(selectedJob)}
          onClose={() => setSelectedJob(null)}
        />
      </div>
    </MotionRoot>
  );
};

export default LandingPage;
