import React from "react";
import { LandingHeader } from "../../components/public/LandingHeader";
import { LandingHero } from "../../components/public/LandingHero";
import { LandingFeaturedJobs } from "../../components/public/LandingFeaturedJobs";
import { LandingCategories } from "../../components/public/LandingCategories";
import { LandingCompanies } from "../../components/public/LandingCompanies";
import { LandingHowItWorks } from "../../components/public/LandingHowItWorks";
import { LandingRecruiterBanner } from "../../components/public/LandingRecruiterBanner";
import { LandingCTA } from "../../components/public/LandingCTA";
import { LandingFooter } from "../../components/public/LandingFooter";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Sticky Navigation Header */}
      <LandingHeader />

      <main className="flex-1">
        {/* 2. Hero with Search & Headline */}
        <LandingHero />

        {/* 3. Featured & Recommended Jobs */}
        <LandingFeaturedJobs />

        {/* 4. Browse by Category */}
        <LandingCategories />

        {/* 5. Featured Hiring Employers */}
        <LandingCompanies />

        {/* 6. How It Works */}
        <LandingHowItWorks />

        {/* 7. Let Opportunities Find You (Recruiter Outreach) */}
        <LandingRecruiterBanner />

        {/* 8. Final High-Conversion CTA */}
        <LandingCTA />
      </main>

      {/* 9. DOLE-Compliant Clean Footer */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
