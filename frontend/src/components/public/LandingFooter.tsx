import React from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, MapPin, Phone, Mail } from "lucide-react";

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-900">
      {/* Top Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand & DOLE License Info (Span 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm">
                M
              </div>
              <span className="font-extrabold text-white text-base tracking-tight">
                MEGS <span className="text-blue-400 font-semibold text-xs">Careers</span>
              </span>
            </div>

            <p className="text-slate-400 leading-relaxed max-w-sm">
              MAR Employment for Good Services Inc. (MEGS) is a full-service Philippine workforce and recruitment agency dedicated to matching qualified talent with industry leaders.
            </p>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold">DOLE-Compliant Agency</strong>
                Duly licensed by the Department of Labor and Employment. We uphold strict labor standards, no illegal fee policies, and equal opportunity employment.
              </div>
            </div>
          </div>

          {/* Jobseekers */}
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              For Jobseekers
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/app/jobs" className="hover:text-white transition-colors">
                  Explore Open Jobs
                </Link>
              </li>
              <li>
                <a href="#categories" className="hover:text-white transition-colors">
                  Career Categories
                </a>
              </li>
              <li>
                <a href="#companies" className="hover:text-white transition-colors">
                  Hiring Employers
                </a>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  Create Candidate Account
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Applicant Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Nationwide Presence */}
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Branch Network
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Valenzuela Central HQ</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Quezon City Branch</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Biñan, Laguna Branch</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Tanauan, Batangas Branch</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Cebu & Davao Branches</span>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Support & Inquiries
            </h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>(02) 8292-6347 / 8292-6348</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>careers@megs.com.ph</span>
              </li>
              <li className="text-[11px] text-slate-500 pt-1">
                Mon - Fri: 8:00 AM – 5:00 PM PHT
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal Copyright Bar */}
      <div className="border-t border-slate-900 bg-slate-950/80 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} MAR Employment for Good Services Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">
              Terms of Use
            </span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">
              Anti-Discrimination Policy
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
