import React from "react";
import { Shield, HeartHandshake, Users2 } from "lucide-react";

export const LandingValues: React.FC = () => {
  const values = [
    {
      name: "Integrity",
      tagline: "Preserving Institutional Reputation",
      icon: Shield,
      description:
        "Integrity defines the reputation of our business. We preserve integrity by developing our employees' character, building their self-esteem, and instilling absolute honesty and statutory compliance in their day-to-day tasks.",
    },
    {
      name: "Loyalty",
      tagline: "Alignment & Ethical Dedication",
      icon: HeartHandshake,
      description:
        "We cultivate loyalty by emphasizing ethical work for the organization's collective interest. We unite clients and workers around a shared mindset of mutual success, dependable partnerships, and long-term security.",
    },
    {
      name: "Respect",
      tagline: "Promoting Teamwork & Dignity",
      icon: Users2,
      description:
        "We value respect in the workplace because it promotes teamwork, protects worker dignity, and increases employee productivity as they perform their duties and responsibilities across client operational sites.",
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            Guiding Principles
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            Our 3 Corporate Values
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Observed across every MEGS office and deployment site to maintain professional excellence and mutual trust.
          </p>
        </div>

        {/* 3 Values Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((v, idx) => {
            const Icon = v.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between hover:border-slate-300 shadow-2xs transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200/60 px-2.5 py-1 rounded">
                      Value 0{idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                      <Icon className="w-5 h-5 text-teal-800" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold font-mono uppercase text-slate-900 tracking-tight mb-1">
                    {v.name}
                  </h3>
                  <span className="text-xs font-semibold text-teal-700 block mb-3">
                    {v.tagline}
                  </span>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                    {v.description}
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
