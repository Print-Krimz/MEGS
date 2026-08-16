import React from "react";
import { LandingHeader } from "../../components/public/LandingHeader";
import { LandingHero } from "../../components/public/LandingHero";
import { LandingAbout } from "../../components/public/LandingAbout";
import { LandingServices } from "../../components/public/LandingServices";
import { LandingSpecializations } from "../../components/public/LandingSpecializations";
import { LandingIndustries } from "../../components/public/LandingIndustries";
import { LandingBranches } from "../../components/public/LandingBranches";
import { LandingCTA } from "../../components/public/LandingCTA";
import { LandingValues } from "../../components/public/LandingValues";
import { LandingFooter } from "../../components/public/LandingFooter";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-teal-700 selection:text-white">
      {/* 1. Header */}
      <LandingHeader />

      <main className="flex-1">
        {/* 2. Hero */}
        <LandingHero />

        {/* 3. About MEGS */}
        <LandingAbout />

        {/* 4. What We Do (Services) */}
        <LandingServices />

        {/* 5. Job Specializations */}
        <LandingSpecializations />

        {/* 6. Industries We Serve */}
        <LandingIndustries />

        {/* 7. Nationwide Presence */}
        <LandingBranches />

        {/* 8. Applicant / Employer CTA Split */}
        <LandingCTA />

        {/* 9. Corporate Values */}
        <LandingValues />
      </main>

      {/* 10. Contact / Footer */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
