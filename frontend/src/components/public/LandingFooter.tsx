import React from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Mail, Building2, ShieldCheck } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const branches = [
    {
      name: "Valenzuela Central Office (HQ)",
      address: "#9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City",
      phone: "(02) 8292-1234 / 0917-629-1864",
    },
    {
      name: "Quezon City Branch",
      address: "Rm 207, 2nd Flr, STG Bldg., 109 P. Tuazon, Cubao, Quezon City",
      phone: "(02) 8911-5678 / 0917-629-1864",
    },
    {
      name: "Biñan, Laguna Branch",
      address: "3rd Fl, Uniworld Bldg. 347, Burgos St., Brgy Vicente, Biñan, Laguna",
      phone: "(049) 511-2345 / 0917-629-1864",
    },
    {
      name: "Tanauan, Batangas Branch",
      address: "PJAR Trading, Brgy Santor (in front of New City Hall), Tanauan City, Batangas",
      phone: "(043) 778-9012 / 0917-629-1864",
    },
    {
      name: "Cebu Branch",
      address: "RM 301, Du Sui Bldg, North Road, Brgy Jagobiao, Mandaue City, Cebu",
      phone: "(032) 345-6789 / 0923-745-4050",
    },
    {
      name: "Davao City Branch",
      address: "D2 2F, C LAT Bldg, Bonifacio St, Davao City, Mindanao",
      phone: "(082) 221-3456 / 0923-745-4050",
    },
  ];

  return (
    <footer className="bg-[#060f1b] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Top Brand & Affiliation Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-800">
          
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-slate-700 shrink-0">
                <img
                  src="/images/canva-ref/megs-seal.jpg"
                  alt="MEGS Circular Seal"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div>
                <span className="font-black text-xl text-white tracking-tight font-sans">
                  MEGS INC.
                </span>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">
                  MAR Employment for Good Services
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-md">
              Founded May 1997. Supplying the nation&apos;s Top 1,000 Corporations with compliant manpower pipelines, on-site supervision, and disciplined workforce solutions.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-teal-400 text-[10px] font-mono font-bold uppercase rounded">
                A PJAR Group Company
              </span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-teal-400 text-[10px] font-mono font-bold uppercase rounded">
                PALSCON Accredited
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider block mb-3">
              Official Contact & Executive Inquiries
            </span>
            <div className="text-xs space-y-2 font-mono text-slate-400">
              <p className="text-slate-200 font-bold">John Patrick Ramos</p>
              <p className="text-teal-400">Vice-President for Operations</p>
              <p className="flex items-center gap-2 text-slate-300">
                <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <a href="mailto:patrickramos@pjar-group.com" className="hover:underline">
                  patrickramos@pjar-group.com
                </a>
              </p>
              <p className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>0917-629-1864 (Globe) / 0923-745-4050 (Sun/Smart)</span>
              </p>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider block mb-3">
              Navigation
            </span>
            <nav className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-400">
              <a href="#about" onClick={(e) => scrollToSection(e, "#about")} className="hover:text-white transition-colors cursor-pointer">
                About MEGS
              </a>
              <a href="#services" onClick={(e) => scrollToSection(e, "#services")} className="hover:text-white transition-colors cursor-pointer">
                Services
              </a>
              <a href="#industries" onClick={(e) => scrollToSection(e, "#industries")} className="hover:text-white transition-colors cursor-pointer">
                Industries
              </a>
              <a href="#specializations" onClick={(e) => scrollToSection(e, "#specializations")} className="hover:text-white transition-colors cursor-pointer">
                Specializations
              </a>
              <a href="#branches" onClick={(e) => scrollToSection(e, "#branches")} className="hover:text-white transition-colors cursor-pointer">
                Branches Map
              </a>
              <a href="#jobs" onClick={(e) => scrollToSection(e, "#jobs")} className="hover:text-white transition-colors cursor-pointer">
                Open Jobs
              </a>
              <a href="#contact" onClick={(e) => scrollToSection(e, "#contact")} className="hover:text-white transition-colors cursor-pointer">
                Proposals
              </a>
              <Link to="/login" className="text-teal-400 hover:text-teal-300 transition-colors">
                Portal Login
              </Link>
            </nav>
          </div>

        </div>

        {/* 6-Branch Directory Grid */}
        <div className="py-10 border-b border-slate-800">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block mb-6">
            Nationwide Office Directory
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((b, idx) => (
              <div key={idx} className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-teal-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-mono font-bold uppercase text-white">{b.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed pl-5">
                  {b.address}
                </p>
                <p className="text-[10px] text-slate-500 font-mono pl-5 pt-1">
                  📞 {b.phone}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Legal & Compliance Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-sans">
          <div className="flex items-center gap-2 text-slate-400 text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0" />
            <span>
              DOLE D.O. 174-17 & D.O. 40-03 Compliant • Legitimate Private Employment Contractor
            </span>
          </div>
          <p>© {currentYear} MAR Employment for Good Services Inc. (MEGS). All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
};
