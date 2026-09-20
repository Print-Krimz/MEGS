import React from "react";

export const LandingValues: React.FC = () => {
  const values = [
    {
      name: "Integrity",
      tagline: "Preserving Institutional Reputation",
      description:
        "Integrity defines the reputation of our business. We preserve integrity by developing our employees' character, building their self-esteem, and instilling absolute honesty and statutory compliance in their day-to-day tasks.",
    },
    {
      name: "Loyalty",
      tagline: "Alignment & Ethical Dedication",
      description:
        "We cultivate loyalty by emphasizing ethical work for the organization's collective interest. We unite clients and workers around a shared mindset of mutual success, dependable partnerships, and long-term security.",
    },
    {
      name: "Respect",
      tagline: "Promoting Teamwork & Dignity",
      description:
        "We value respect in the workplace because it promotes teamwork, protects worker dignity, and increases employee productivity as they perform their duties and responsibilities across client operational sites.",
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
            Guiding Principles
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f294a] tracking-tight">
            Our 3 Corporate Values
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Observed across every MEGS office and deployment site to maintain professional excellence and mutual trust.
          </p>
        </div>

        {/* 3 Values Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((v, idx) => {
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between hover:border-slate-300 shadow-2xs transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                    <span className="text-xs font-semibold tracking-[0.1em] text-slate-500">
                      PRINCIPLE 0{idx + 1}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#0f294a] tracking-tight mb-1">
                    {v.name}
                  </h3>
                  <span className="text-xs font-semibold text-slate-600 block mb-3">
                    {v.tagline}
                  </span>

                  <p className="text-sm text-slate-600 leading-relaxed">
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
