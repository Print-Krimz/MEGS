import React, { useState } from "react";
import { 
  Mail, 
  Phone, 
  Building, 
  Send, 
  CheckCircle, 
  FileText, 
  MessageSquare,
  AlertCircle,
  Clock
} from "lucide-react";
import { validatePhilippinePhone, formatPhilippinePhoneDisplay } from "../../lib/phone-utils";

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

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = (data = formData) => {
    const errs: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!data.companyName.trim()) {
      errs.companyName = "Company name is required";
    } else if (data.companyName.trim().length < 2) {
      errs.companyName = "Company name must be at least 2 characters";
    }

    if (!data.contactPerson.trim()) {
      errs.contactPerson = "Contact person & title is required";
    } else if (data.contactPerson.trim().length < 2) {
      errs.contactPerson = "Contact person must be at least 2 characters";
    }

    if (!data.email.trim()) {
      errs.email = "Corporate email is required";
    } else if (!emailRegex.test(data.email.trim())) {
      errs.email = "Please enter a valid email address (e.g. name@company.ph)";
    }

    if (!data.phone.trim()) {
      errs.phone = "Contact number is required";
    } else {
      const phoneRes = validatePhilippinePhone(data.phone);
      if (!phoneRes.isValid || !phoneRes.isComplete) {
        errs.phone = phoneRes.message || "Please enter a valid 11-digit mobile number";
      }
    }

    if (data.notes.length > 1000) {
      errs.notes = "Notes must not exceed 1000 characters";
    }

    return errs;
  };

  const errors = validate(formData);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      companyName: true,
      contactPerson: true,
      email: true,
      phone: true,
      notes: true,
    });

    const currentErrors = validate(formData);
    if (Object.keys(currentErrors).length > 0) {
      const firstErrorField = Object.keys(currentErrors)[0];
      const el = document.getElementById(`field-${firstErrorField}`);
      if (el) {
        el.focus();
      }
      return;
    }

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
    <section id="contact" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
            Inquiries & Business Development
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f294a] tracking-tight">
            Request a Service Proposal or Company Profile
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Connect directly with our executive operations team to receive customized billing rates, DOLE compliance documentation, and rapid manpower deployment proposals.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Executive Contact Card */}
          <div className="lg:col-span-5 bg-[#0f294a] text-white rounded-2xl p-8 border border-slate-800 space-y-6 shadow-xs">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 block mb-2">
                Executive Leadership
              </span>
              <h3 className="text-2xl font-bold font-sans tracking-tight text-white">
                John Patrick Ramos
              </h3>
              <p className="text-sm font-medium text-blue-200 mt-0.5">
                Vice-President for Operations
              </p>
              <p className="text-xs text-slate-300 mt-2.5 font-sans leading-relaxed">
                Overseeing national client engagements, service coordinator deployment, and statutory workforce compliance under the PJAR Group.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              
              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-blue-200">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Official Inquiries</span>
                  <a
                    href="mailto:patrickramos@pjar-group.com"
                    className="text-xs sm:text-sm font-semibold text-white hover:text-blue-300 transition-colors"
                  >
                    patrickramos@pjar-group.com
                  </a>
                </div>
              </div>

              {/* Globe / Viber */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-blue-200">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Globe / Viber</span>
                  <a
                    href="tel:09176291864"
                    className="text-xs sm:text-sm font-semibold text-white hover:text-blue-300 transition-colors font-mono"
                  >
                    0917-629-1864
                  </a>
                </div>
              </div>

              {/* Sun / Smart */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-blue-200">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Sun / Smart</span>
                  <a
                    href="tel:09237454050"
                    className="text-xs sm:text-sm font-semibold text-white hover:text-blue-300 transition-colors font-mono"
                  >
                    0923-745-4050
                  </a>
                </div>
              </div>

              {/* Central Office */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-blue-200">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Central Headquarters</span>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    #9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City, Metro Manila
                  </p>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-white/10 flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
              <Clock className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">Fast Turnaround Guarantee</span>
                <span>Manpower proposals and company profiles are typically dispatched within 24 business hours upon receiving your specifications.</span>
              </div>
            </div>
          </div>

          {/* Interactive Request Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            {isSubmitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center mx-auto text-[#0f294a]">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-sans text-slate-900">
                  Proposal Request Prepared
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto font-sans">
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
              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <div className="pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0f294a]" />
                    <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-wide">
                      Enterprise Service Proposal Request
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    Submit your organization&apos;s workforce requirements for an executive quotation.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="field-companyName" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      id="field-companyName"
                      type="text"
                      placeholder="e.g. Sterling Logistics Inc."
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      onBlur={() => handleBlur("companyName")}
                      aria-invalid={touched.companyName && !!errors.companyName}
                      aria-describedby={touched.companyName && errors.companyName ? "error-companyName" : undefined}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 transition-colors focus:bg-white focus:outline-hidden focus:ring-2 ${
                        touched.companyName && errors.companyName
                          ? "bg-rose-50/40 border border-rose-300 focus:ring-rose-500 text-rose-950"
                          : "bg-slate-50 border border-slate-300 focus:ring-[#0f294a]"
                      }`}
                    />
                    {touched.companyName && errors.companyName && (
                      <p id="error-companyName" className="text-xs text-rose-600 mt-1 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.companyName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="field-contactPerson" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
                      Contact Person & Title *
                    </label>
                    <input
                      id="field-contactPerson"
                      type="text"
                      placeholder="e.g. Maria Santos (HR Director)"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      onBlur={() => handleBlur("contactPerson")}
                      aria-invalid={touched.contactPerson && !!errors.contactPerson}
                      aria-describedby={touched.contactPerson && errors.contactPerson ? "error-contactPerson" : undefined}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 transition-colors focus:bg-white focus:outline-hidden focus:ring-2 ${
                        touched.contactPerson && errors.contactPerson
                          ? "bg-rose-50/40 border border-rose-300 focus:ring-rose-500 text-rose-950"
                          : "bg-slate-50 border border-slate-300 focus:ring-[#0f294a]"
                      }`}
                    />
                    {touched.contactPerson && errors.contactPerson && (
                      <p id="error-contactPerson" className="text-xs text-rose-600 mt-1 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.contactPerson}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="field-email" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
                      Corporate Email *
                    </label>
                    <input
                      id="field-email"
                      type="email"
                      placeholder="e.g. msantos@company.ph"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={() => handleBlur("email")}
                      aria-invalid={touched.email && !!errors.email}
                      aria-describedby={touched.email && errors.email ? "error-email" : undefined}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 transition-colors focus:bg-white focus:outline-hidden focus:ring-2 ${
                        touched.email && errors.email
                          ? "bg-rose-50/40 border border-rose-300 focus:ring-rose-500 text-rose-950"
                          : "bg-slate-50 border border-slate-300 focus:ring-[#0f294a]"
                      }`}
                    />
                    {touched.email && errors.email && (
                      <p id="error-email" className="text-xs text-rose-600 mt-1 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="field-phone" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
                      Contact Number *
                    </label>
                    <input
                      id="field-phone"
                      type="tel"
                      placeholder="e.g. 0917 123 4567"
                      value={formData.phone}
                      onChange={(e) => {
                        const formatted = formatPhilippinePhoneDisplay(e.target.value);
                        setFormData({ ...formData, phone: formatted });
                      }}
                      onBlur={() => handleBlur("phone")}
                      aria-invalid={touched.phone && !!errors.phone}
                      aria-describedby={touched.phone && errors.phone ? "error-phone" : undefined}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 transition-colors focus:bg-white focus:outline-hidden focus:ring-2 ${
                        touched.phone && errors.phone
                          ? "bg-rose-50/40 border border-rose-300 focus:ring-rose-500 text-rose-950"
                          : "bg-slate-50 border border-slate-300 focus:ring-[#0f294a]"
                      }`}
                    />
                    {touched.phone && errors.phone && (
                      <p id="error-phone" className="text-xs text-rose-600 mt-1 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
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
                    <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
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
                  <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 mb-1">
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
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="field-notes" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Specific Role or Skill Requirements (Optional)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formData.notes.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="field-notes"
                    rows={3}
                    placeholder="Describe specific qualifications, shifts, or facility details..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    onBlur={() => handleBlur("notes")}
                    aria-invalid={touched.notes && !!errors.notes}
                    aria-describedby={touched.notes && errors.notes ? "error-notes" : undefined}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-sm text-slate-900 transition-colors focus:bg-white focus:outline-hidden focus:ring-2 ${
                      touched.notes && errors.notes
                        ? "bg-rose-50/40 border border-rose-300 focus:ring-rose-500 text-rose-950"
                        : "bg-slate-50 border border-slate-300 focus:ring-[#0f294a]"
                    }`}
                  />
                  {touched.notes && errors.notes && (
                    <p id="error-notes" className="text-xs text-rose-600 mt-1 font-sans flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.notes}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 bg-[#0f294a] hover:bg-[#163b66] text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] focus-visible:ring-offset-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Service Proposal Request</span>
                </button>
              </form>
            )}
          </div>

        </div>

      </div>
    </section>
  );
};
