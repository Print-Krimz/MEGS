import React, { useState } from "react";
import { LandingHeader } from "../../components/public/LandingHeader";
import { LandingHero } from "../../components/public/LandingHero";
import { LandingAffiliates } from "../../components/public/LandingAffiliates";
import { LandingAbout } from "../../components/public/LandingAbout";
import { LandingValues } from "../../components/public/LandingValues";
import { LandingServices } from "../../components/public/LandingServices";
import { LandingIndustries } from "../../components/public/LandingIndustries";
import { LandingSpecializations } from "../../components/public/LandingSpecializations";
import { LandingBranches } from "../../components/public/LandingBranches";
import { LandingJobListings } from "../../components/public/LandingJobListings";
import { LandingCategories } from "../../components/public/LandingCategories";
import { LandingFeaturedCompanies } from "../../components/public/LandingFeaturedCompanies";
import { LandingHowItWorks } from "../../components/public/LandingHowItWorks";
import { LandingContact } from "../../components/public/LandingContact";
import { LandingFooter } from "../../components/public/LandingFooter";

export const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  const handleHeroSearch = ({ search, location }: { search: string; location: string }) => {
    setSearchQuery(search);
    setLocationQuery(location);
  };

  const handleCategorySelect = (category: string) => {
    setSearchQuery(category);
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCompanySelect = (companyName: string) => {
    setSearchQuery(companyName);
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setLocationQuery("");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-[#0f294a] selection:text-white">
      {/* 1. Header with Brand Seal & Navigation Anchors */}
      <LandingHeader />

      <main className="flex-1">
        {/* 2. Hero with Value Proposition, Dual Actions & Fast Search */}
        <LandingHero
          onSearch={handleHeroSearch}
          initialSearch={searchQuery}
          initialLocation={locationQuery}
        />

        {/* 3. Affiliates & Accreditation (PJAR Group & PALSCON) */}
        <LandingAffiliates />

        {/* 4. Company Background, 1997 Heritage & 5-Year Vision */}
        <LandingAbout />

        {/* 5. 3 Core Values (Integrity, Loyalty, Respect) */}
        <LandingValues />

        {/* 6. 6 Salient DOLE Services & Accident Insurance */}
        <LandingServices />

        {/* 7. 6 Partner Industries with Canva Photography */}
        <LandingIndustries />

        {/* 8. 15 Job Specializations Directory */}
        <LandingSpecializations />

        {/* 9. 6 Branch Offices & Interactive Philippine SVG Map */}
        <LandingBranches />

        {/* 10. Active Candidate Job Board (Real Database Openings) */}
        <LandingJobListings
          searchQuery={searchQuery}
          locationQuery={locationQuery}
          onClearSearch={handleClearSearch}
        />

        {/* 11. Browse by Job Category */}
        <LandingCategories onSelectCategory={handleCategorySelect} />

        {/* 12. Featured Client Employers */}
        <LandingFeaturedCompanies onSelectCompany={handleCompanySelect} />

        {/* 13. Candidate Application Journey */}
        <LandingHowItWorks />

        {/* 14. Executive Inquiries & Service Proposal Generator */}
        <LandingContact />
      </main>

      {/* 15. Comprehensive 6-Branch Footer & DOLE Compliance Directory */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
