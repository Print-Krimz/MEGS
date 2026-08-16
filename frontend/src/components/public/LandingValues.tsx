import React from "react";

export const LandingValues: React.FC = () => {
  const values = [
    {
      name: "Integrity",
      description:
        "Upholding absolute transparency, honesty, and statutory compliance in all employee records, client billing, and recruitment operations.",
    },
    {
      name: "Loyalty",
      description:
        "Building enduring, reliable partnerships with our corporate clients while safeguarding the long-term career welfare of deployed personnel.",
    },
    {
      name: "Respect",
      description:
        "Fostering professional dignity, mutual trust, and fair treatment for every worker, client representative, and stakeholder across our network.",
    },
  ];

  return (
    <section className="py-14 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-l-2 border-teal-700 pl-4 mb-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-800">
            Guiding Principles
          </span>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">
            Corporate Values
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((v, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-teal-700">
                  0{idx + 1}.
                </span>
                <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-wide">
                  {v.name}
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
