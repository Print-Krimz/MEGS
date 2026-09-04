import React from "react";
import { Search, FileCheck, CheckCircle2 } from "lucide-react";

export const LandingHowItWorks: React.FC = () => {
  const steps = [
    {
      step: "01",
      title: "Search & Discover",
      description:
        "Explore verified job openings across the Philippines with transparent salary expectations, verified locations, and clear job criteria.",
      icon: Search,
    },
    {
      step: "02",
      title: "Apply with One Click",
      description:
        "Build your candidate profile once or upload your existing PDF resume. Apply to matching positions in seconds without repetitive forms.",
      icon: FileCheck,
    },
    {
      step: "03",
      title: "Interview & Get Placed",
      description:
        "Receive interview schedules directly on your dashboard, submit your pre-employment documents online, and start your deployment.",
      icon: CheckCircle2,
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
            Simple 3-Step Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            How MEGS Works for Jobseekers
          </h2>
          <p className="text-sm text-slate-600">
            We make finding and securing your next job straightforward, compliant, and transparent.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-300 font-mono">
                    {item.step}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-lg">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
