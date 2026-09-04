import React, { useState } from "react";
import { 
  Mail, 
  Phone, 
  User, 
  Building, 
  Send, 
  CheckCircle, 
  FileText, 
  MessageSquare
} from "lucide-react";

export const LandingContact: React.FC = () => {
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    industry: "Manufacturing",
    preferredBranch: "Valenzuela (Central Office)",
    headcount: "10-50 personnel",
    notes: "",
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Format mailto link to Vice-President for Operations
    const subject = encodeURIComponent(`[MEGS Service Proposal Request] ${formData.companyName}`);
    const body = encodeURIComponent(
      `Company Name: ${formData.companyName}\n` +
      `Contact Person: ${formData.contactPerson}\n` +
      `Email: ${formData.email}\n` +
      `Phone: ${formData.phone}\n` +
      `Target Industry: ${formData.industry}\n` +
      `Preferred Branch: ${formData.preferredBranch}\n` +
      `Estimated Headcount: ${formData.headcount}\n\n` +
      `Additional Notes:\n${formData.notes}`
    );
    window.location.href = `mailto:patrickramos@pjar-group.com?subject=${subject}&body=${body}`;
    setIsSubmitted(true);
  };

  return (
    <section id="contact" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            Inquiries & Business Development
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
            Request a Service Proposal or Company Profile
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Connect directly with our executive operations team to receive customized billing rates, DOLE compliance documentation, and rapid manpower deployment proposals.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Executive Contact Card */}
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 space-y-6 shadow-md">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-teal-400 block mb-2">
                Executive Leadership
              </span>
              <h3 className="text-2xl font-bold font-sans tracking-tight text-white">
                John Patrick Ramos
              </h3>
              <p className="text-xs font-mono text-teal-300 font-semibold mt-0.5">
                Vice-President for Operations
              </p>
              <p className="text-xs text-slate-400 mt-2 font-sans">
                Overseeing national client engagements, service coordinator deployment, and statutory workforce compliance under the PJAR Group.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              
              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Official Inquiries</span>
                  <a
                    href="mailto:patrickramos@pjar-group.com"
                    className="text-xs sm:text-sm font-bold font-mono text-white hover:text-teal-300 transition-colors"
                  >
                    patrickramos@pjar-group.com
                  </a>
                </div>
              </div>

              {/* Globe / Viber */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Globe / Viber</span>
                  <a
                    href="tel:09176291864"
                    className="text-xs sm:text-sm font-bold font-mono text-white hover:text-teal-300 transition-colors"
                  >
                    0917-629-1864
                  </a>
                </div>
              </div>

              {/* Sun / Smart */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Sun / Smart</span>
                  <a
                    href="tel:09237454050"
                    className="text-xs sm:text-sm font-bold font-mono text-white hover:text-teal-300 transition-colors"
                  >
                    0923-745-4050
                  </a>
                </div>
              </div>

              {/* Central Office */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Central Headquarters</span>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    #9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City, Metro Manila
                  </p>
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 font-sans leading-relaxed">
              💡 <strong>Fast Turnaround:</strong> Manpower proposals and company profiles are typically dispatched within 24 business hours upon receiving your job specifications.
            </div>
          </div>

          {/* Interactive Request Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            {isSubmitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-teal-50 border border-teal-200 rounded-full flex items-center justify-center mx-auto text-teal-700">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-sans text-slate-900">
                  Proposal Request Prepared
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Your default email client has been opened with your proposal request details addressed to <span className="font-mono font-bold text-slate-900">patrickramos@pjar-group.com</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-4">
                  <FileText className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                    Enterprise Service Proposal Generator
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sterling Logistics Inc."
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                      Contact Person & Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos (HR Director)"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                      Corporate Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. msantos@company.ph"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                      Contact Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0917-123-4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                      Target Industry
                    </label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                    >
                      <option value="Manufacturing">Manufacturing & Assembly</option>
                      <option value="Logistics">Logistics & Transportation</option>
                      <option value="Warehousing">Warehousing & Storage</option>
                      <option value="Retail">Retail, Sales & Distribution</option>
                      <option value="Hotel and Restaurant">Hotel & Restaurant</option>
                      <option value="Gaming and Casino">Gaming & Casino</option>
                      <option value="Other">Other Specialized Sector</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                      Serving Branch
                    </label>
                    <select
                      value={formData.preferredBranch}
                      onChange={(e) => setFormData({ ...formData, preferredBranch: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                    >
                      <option value="Valenzuela (Central Office)">Valenzuela (Central Office / HQ)</option>
                      <option value="Quezon City Branch">Quezon City (Cubao)</option>
                      <option value="Biñan Laguna Branch">Biñan, Laguna Branch</option>
                      <option value="Tanauan Batangas Branch">Tanauan, Batangas Branch</option>
                      <option value="Cebu Branch">Cebu (Mandaue City) Branch</option>
                      <option value="Davao Branch">Davao City Branch</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                    Workforce Volume Needed
                  </label>
                  <select
                    value={formData.headcount}
                    onChange={(e) => setFormData({ ...formData, headcount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                  >
                    <option value="1-10 personnel">1 - 10 personnel (Initial Pilot)</option>
                    <option value="10-50 personnel">10 - 50 personnel (Standard Line)</option>
                    <option value="50-150 personnel">50 - 150 personnel (Facility Expansion)</option>
                    <option value="150+ personnel">150+ personnel (Enterprise Manpower)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                    Specific Role or Skill Requirements (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe specific qualifications, shifts, or facility details..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f294a]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 bg-[#0f294a] hover:bg-[#163b66] text-white font-mono font-bold uppercase text-xs tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Transmit Service Proposal Request</span>
                </button>
              </form>
            )}
          </div>

        </div>

      </div>
    </section>
  );
};
