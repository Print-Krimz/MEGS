import React, { useState } from "react";
import { LandingHeader } from "../../components/public/LandingHeader";
import { LandingHero } from "../../components/public/LandingHero";
import { LandingAffiliates } from "../../components/public/LandingAffiliates";
import { LandingAbout } from "../../components/public/LandingAbout";
import { LandingServices } from "../../components/public/LandingServices";
import { LandingIndustries } from "../../components/public/LandingIndustries";
import { LandingBranches } from "../../components/public/LandingBranches";
import { LandingJobListings } from "../../components/public/LandingJobListings";
import { LandingFeaturedCompanies } from "../../components/public/LandingFeaturedCompanies";
import { LandingContact } from "../../components/public/LandingContact";
import { LandingFooter } from "../../components/public/LandingFooter";
import { MotionRoot } from "../../components/public/motion";

export const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  const handleHeroSearch = ({ search, location }: { search: string; location: string }) => {
    setSearchQuery(search);
    setLocationQuery(location);
  };

  const handleCompanySelect = (companyName: string) => {
    setSearchQuery(companyName);
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
    window.setTimeout(() => {
      document.getElementById("jobs-heading")?.focus({ preventScroll: true });
    }, 450);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setLocationQuery("");
  };

  return (
    <MotionRoot>
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
            onSearch={handleHeroSearch}
            initialSearch={searchQuery}
            initialLocation={locationQuery}
          />
          <LandingAffiliates />
          <LandingJobListings
            searchQuery={searchQuery}
            locationQuery={locationQuery}
            onClearSearch={handleClearSearch}
          />
          <LandingFeaturedCompanies onSelectCompany={handleCompanySelect} />
          <LandingServices />
          <LandingIndustries />
          <LandingAbout />
          <LandingBranches />
          <LandingContact />
        </main>

        <LandingFooter />
      </div>
    </MotionRoot>
  );
};

export default LandingPage;
