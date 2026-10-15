import React, { useState } from "react";
import { Mail, Phone, Send, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { validatePhilippinePhone, formatPhilippinePhoneDisplay } from "../../lib/phone-utils";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3.5 text-base text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

const darkLink =
  "rounded-sm font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const Required: React.FC = () => (
  <span className="text-muted-foreground" aria-hidden="true">
    *
  </span>
);

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
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
  const showError = (field: string) => !!touched[field] && !!errors[field];

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
    setSubmitAttempted(true);

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

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="scroll-mt-20 bg-megs-navy-900 py-16 text-white sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="contact-heading"
          tone="dark"
          title="Request a service proposal or company profile"
          intro="Talk to our executive operations team for billing rates, DOLE compliance documents and a manpower deployment proposal."
        />

        <Reveal className="mt-12 grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Executive contact */}
          <div className="lg:col-span-5">
            <h3 className="font-bold tracking-tight text-2xl text-white">John Patrick Ramos</h3>
            <p className="mt-1 text-base font-semibold text-white/90">Vice-President for Operations</p>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white/75">
              Oversees national client engagements, service coordinator deployment and statutory workforce compliance under the PJAR Group.
            </p>

            <ul className="mt-8 space-y-5 border-t border-white/10 pt-8">
              <li className="flex items-start gap-3">
                <Mail className="mt-1 size-5 shrink-0 text-white/75" aria-hidden="true" />
                <div>
                  <p className="text-sm text-white/75">Official inquiries</p>
                  <a href="mailto:patrickramos@pjar-group.com" className={`${darkLink} break-all text-base`}>
                    patrickramos@pjar-group.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-1 size-5 shrink-0 text-white/75" aria-hidden="true" />
                <div>
                  <p className="text-sm text-white/75">Globe / Viber</p>
                  <a href="tel:09176291864" className={`${darkLink} text-base`}>
                    0917-629-1864
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-1 size-5 shrink-0 text-white/75" aria-hidden="true" />
                <div>
                  <p className="text-sm text-white/75">Sun / Smart</p>
                  <a href="tel:09237454050" className={`${darkLink} text-base`}>
                    0923-745-4050
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-1 size-5 shrink-0 text-white/75" aria-hidden="true" />
                <div>
                  <p className="text-sm text-white/75">Turnaround</p>
                  <p className="text-base text-white">
                    Proposals and company profiles are typically sent within 24 business hours of receiving your specifications.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Proposal request form */}
          <div className="rounded-lg bg-background p-6 text-foreground sm:p-8 lg:col-span-7">
            {isSubmitted ? (
              <Alert>
                <CheckCircle aria-hidden="true" />
                <AlertTitle>Proposal request prepared</AlertTitle>
                <AlertDescription>
                  <p>
                    Your default email client has been opened with your proposal request details addressed to{" "}
                    <span className="font-semibold text-foreground">patrickramos@pjar-group.com</span>.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setIsSubmitted(false);
                      setSubmitAttempted(false);
                    }}
                  >
                    Submit another inquiry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <form noValidate onSubmit={handleSubmit}>
                <h3 className="font-bold tracking-tight text-xl text-secondary">Service proposal request</h3>
                <p className="mt-1 text-base text-muted-foreground">
                  Send your organization&apos;s workforce requirements for a quotation.
                </p>

                {submitAttempted && hasErrors && (
                  <Alert variant="destructive" className="mt-6">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Check the highlighted fields</AlertTitle>
                    <AlertDescription>
                      <p>Complete the required fields before sending your request.</p>
                    </AlertDescription>
                  </Alert>
                )}

                <FieldGroup className="mt-6 gap-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field data-invalid={showError("companyName") || undefined}>
                      <FieldLabel htmlFor="field-companyName">
                        Company name <Required />
                      </FieldLabel>
                      <Input
                        id="field-companyName"
                        type="text"
                        maxLength={200}
                        placeholder="e.g. Sterling Logistics Inc."
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        onBlur={() => handleBlur("companyName")}
                        aria-required="true"
                        aria-invalid={showError("companyName")}
                        aria-describedby={showError("companyName") ? "error-companyName" : undefined}
                      />
                      {showError("companyName") && (
                        <FieldError id="error-companyName">{errors.companyName}</FieldError>
                      )}
                    </Field>

                    <Field data-invalid={showError("contactPerson") || undefined}>
                      <FieldLabel htmlFor="field-contactPerson">
                        Contact person &amp; title <Required />
                      </FieldLabel>
                      <Input
                        id="field-contactPerson"
                        type="text"
                        maxLength={200}
                        placeholder="e.g. Maria Santos (HR Director)"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        onBlur={() => handleBlur("contactPerson")}
                        aria-required="true"
                        aria-invalid={showError("contactPerson")}
                        aria-describedby={showError("contactPerson") ? "error-contactPerson" : undefined}
                      />
                      {showError("contactPerson") && (
                        <FieldError id="error-contactPerson">{errors.contactPerson}</FieldError>
                      )}
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field data-invalid={showError("email") || undefined}>
                      <FieldLabel htmlFor="field-email">
                        Corporate email <Required />
                      </FieldLabel>
                      <Input
                        id="field-email"
                        type="email"
                        maxLength={254}
                        placeholder="e.g. msantos@company.ph"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        onBlur={() => handleBlur("email")}
                        aria-required="true"
                        aria-invalid={showError("email")}
                        aria-describedby={showError("email") ? "error-email" : undefined}
                      />
                      {showError("email") && <FieldError id="error-email">{errors.email}</FieldError>}
                    </Field>

                    <Field data-invalid={showError("phone") || undefined}>
                      <FieldLabel htmlFor="field-phone">
                        Contact number <Required />
                      </FieldLabel>
                      <Input
                        id="field-phone"
                        type="tel"
                        maxLength={64}
                        placeholder="e.g. 0917 123 4567"
                        value={formData.phone}
                        onChange={(e) => {
                          const formatted = formatPhilippinePhoneDisplay(e.target.value);
                          setFormData({ ...formData, phone: formatted });
                        }}
                        onBlur={() => handleBlur("phone")}
                        aria-required="true"
                        aria-invalid={showError("phone")}
                        aria-describedby={showError("phone") ? "error-phone" : undefined}
                      />
                      {showError("phone") && <FieldError id="error-phone">{errors.phone}</FieldError>}
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="field-industry">Target industry</FieldLabel>
                      <select
                        id="field-industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className={selectClass}
                      >
                        <option value="Manufacturing">Manufacturing & Assembly</option>
                        <option value="Logistics">Logistics & Transportation</option>
                        <option value="Warehousing">Warehousing & Storage</option>
                        <option value="Retail">Retail, Sales & Distribution</option>
                        <option value="Hotel and Restaurant">Hotel & Restaurant</option>
                        <option value="Gaming and Casino">Gaming & Casino</option>
                        <option value="Other">Other Specialized Sector</option>
                      </select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="field-preferredBranch">Serving branch</FieldLabel>
                      <select
                        id="field-preferredBranch"
                        value={formData.preferredBranch}
                        onChange={(e) => setFormData({ ...formData, preferredBranch: e.target.value })}
                        className={selectClass}
                      >
                        <option value="Valenzuela (Central Office)">Valenzuela (Central Office / HQ)</option>
                        <option value="Quezon City Branch">Quezon City (Cubao)</option>
                        <option value="Biñan Laguna Branch">Biñan, Laguna Branch</option>
                        <option value="Tanauan Batangas Branch">Tanauan, Batangas Branch</option>
                        <option value="Cebu Branch">Cebu (Mandaue City) Branch</option>
                        <option value="Davao Branch">Davao City Branch</option>
                      </select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="field-headcount">Workforce volume needed</FieldLabel>
                      <select
                        id="field-headcount"
                        value={formData.headcount}
                        onChange={(e) => setFormData({ ...formData, headcount: e.target.value })}
                        className={selectClass}
                      >
                        <option value="1-10 personnel">1 - 10 personnel (Initial Pilot)</option>
                        <option value="10-50 personnel">10 - 50 personnel (Standard Line)</option>
                        <option value="50-150 personnel">50 - 150 personnel (Facility Expansion)</option>
                        <option value="150+ personnel">150+ personnel (Enterprise Manpower)</option>
                      </select>
                    </Field>
                  </div>


                  <Field data-invalid={showError("notes") || undefined}>
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel htmlFor="field-notes">Specific role or skill requirements (optional)</FieldLabel>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {formData.notes.length}/1000
                      </span>
                    </div>
                    <Textarea
                      id="field-notes"
                      rows={4}
                      maxLength={1000}
                      className="min-h-28 bg-background"
                      placeholder="Describe specific qualifications, shifts, or facility details..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      onBlur={() => handleBlur("notes")}
                      aria-invalid={showError("notes")}
                      aria-describedby={showError("notes") ? "error-notes" : undefined}
                    />
                    {showError("notes") && <FieldError id="error-notes">{errors.notes}</FieldError>}
                  </Field>

                  <Button type="submit" size="lg" className="w-full">
                    <Send data-icon="inline-start" />
                    Submit service proposal request
                  </Button>
                </FieldGroup>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
};
