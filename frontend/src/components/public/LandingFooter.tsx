import React from "react";
import { Mail, Phone, User, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingFooter: React.FC = () => {
  return (
    <footer id="contact" className="bg-slate-950 text-slate-400 border-t border-slate-800">
      
      {/* Contact & Inquiry Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Company Summary Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-800 text-white flex items-center justify-center font-mono font-bold text-base border border-teal-700">
                <BriefcaseBusiness className="w-4 h-4 text-teal-100" />
              </div>
              <div>
                <span className="font-bold text-white font-mono text-sm tracking-tight block">
                  MAR EMPLOYMENT FOR GOOD SERVICES INC.
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Established May 1997
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              A premier DOLE-compliant Philippine manpower and recruitment agency providing end-to-end workforce solutions across Luzon, Visayas, and Mindanao.
            </p>

            <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-teal-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Full Statutory & Labor Compliance Guaranteed</span>
            </div>
          </div>

          {/* Direct Operations & Verified Contact */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
              Operations & Inquiries
            </h3>
            <p className="text-[11px] text-slate-400">
              To request our company profile and service proposal, reach out directly:
            </p>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-start gap-2.5">
                <User className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-200 font-bold block">John Patrick Ramos</span>
                  <span className="text-[11px] text-slate-400">Vice-President for Operations</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <a
                  href="mailto:patrickramos@pjar-group.com"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  patrickramos@pjar-group.com
                </a>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-300">
                  <div>09176291864 <span className="text-[10px] text-slate-500">(Globe / Viber)</span></div>
                  <div>09237454050 <span className="text-[10px] text-slate-500">(Sun / Smart)</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links & Locations with gliding scroll */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
              Quick Navigation
            </h3>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <a
                  href="#about"
                  onClick={(e) => scrollToSection(e, "#about")}
                  className="hover:text-slate-200 transition-colors inline-block hover:translate-x-1"
                >
                  • About MEGS
                </a>
              </li>
              <li>
                <a
                  href="#services"
                  onClick={(e) => scrollToSection(e, "#services")}
                  className="hover:text-slate-200 transition-colors inline-block hover:translate-x-1"
                >
                  • Services
                </a>
              </li>
              <li>
                <a
                  href="#specializations"
                  onClick={(e) => scrollToSection(e, "#specializations")}
                  className="hover:text-slate-200 transition-colors inline-block hover:translate-x-1"
                >
                  • Job Specializations
                </a>
              </li>
              <li>
                <a
                  href="#industries"
                  onClick={(e) => scrollToSection(e, "#industries")}
                  className="hover:text-slate-200 transition-colors inline-block hover:translate-x-1"
                >
                  • Industries
                </a>
              </li>
              <li>
                <a
                  href="#branches"
                  onClick={(e) => scrollToSection(e, "#branches")}
                  className="hover:text-slate-200 transition-colors inline-block hover:translate-x-1"
                >
                  • Nationwide Branches
                </a>
              </li>
              <li>
                <a href="/login" className="text-teal-400 hover:text-teal-300 transition-colors inline-block hover:translate-x-1">
                  • Staff & Candidate Login →
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-slate-900 bg-black/40 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            © 1997–2026 MAR EMPLOYMENT FOR GOOD SERVICES INC. (MEGS). All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Philippine Registered Manpower Agency</span>
            <span>•</span>
            <span className="text-teal-400">DOLE Compliant</span>
          </div>
        </div>
      </div>

    </footer>
  );
};
