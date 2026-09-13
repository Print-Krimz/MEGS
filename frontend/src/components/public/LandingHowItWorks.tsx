import React from "react";

export const LandingHowItWorks: React.FC = () => {
  const steps = [
    {
      number: "01",
      title: "Search Positions",
      description:
        "Filter active job requisitions by keyword, qualification, and location to find openings aligned with your experience.",
    },
    {
      number: "02",
      title: "Submit Application",
      description:
        "Create a candidate account and submit your profile or upload your resume for immediate screening by talent acquisition.",
    },
    {
      number: "03",
      title: "Interview & Deploy",
      description:
        "Track your evaluation status, complete pre-employment requirements, and receive deployment dispatch instructions.",
    },
  ];

  return (
    <section id="how-it-works" className="py-14 sm:py-20 bg-white border-b border-slate-200 scroll-mt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pb-6 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f294a]">
            Process Overview
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            How It Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            A clear, structured pathway from initial job discovery to workplace deployment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl font-black font-mono text-[#0f294a]">
                  {step.number}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-3">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
