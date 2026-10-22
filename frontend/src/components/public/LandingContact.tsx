import React, { useEffect, useRef, useState } from "react";
import { Mail, Phone, Send, CheckCircle, AlertCircle } from "lucide-react";
import { validatePhilippinePhone, formatPhilippinePhoneDisplay } from "../../lib/phone-utils";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { cn } from "../../lib/shadcn-utils";
import { SectionHeader } from "./SectionHeader";
import { AnimatePresence, EASE_OUT, Reveal, m, onView, staggerItem, staggerParent } from "./motion";

const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3.5 text-base text-foreground outline-none transition-[color,box-shadow,border-color] duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/** Underline that draws in from the left on hover and focus. */
const drawLink =
  "bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat transition-[background-size] duration-300 hover:bg-[length:100%_1px] focus-visible:bg-[length:100%_1px] motion-reduce:transition-none";

const darkLink = cn(
  "rounded-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
  drawLink
);

const SALES_EMAIL = "patrickramos@pjar-group.com";

const INDUSTRY_OPTIONS = [
  { value: "Manufacturing", label: "Manufacturing & assembly" },
  { value: "Logistics", label: "Logistics & transportation" },
  { value: "Warehousing", label: "Warehousing & storage" },
  { value: "Retail", label: "Retail, sales & distribution" },
  { value: "Hotel and Restaurant", label: "Hotel & restaurant" },
  { value: "Gaming and Casino", label: "Gaming & casino" },
  { value: "Other", label: "Other" },
];

const BRANCH_OPTIONS = [
  { value: "No preference", label: "No preference" },
  { value: "Valenzuela (Central Office)", label: "Valenzuela (central office)" },
  { value: "Quezon City Branch", label: "Quezon City (Cubao)" },
  { value: "Biñan Laguna Branch", label: "Biñan, Laguna" },
  { value: "Tanauan Batangas Branch", label: "Tanauan, Batangas" },
  { value: "Cebu Branch", label: "Cebu (Mandaue City)" },
  { value: "Davao Branch", label: "Davao City" },
];

const HEADCOUNT_OPTIONS = [
  { value: "1-10 workers", label: "1 to 10 workers" },
  { value: "10-50 workers", label: "10 to 50 workers" },
  { value: "50-150 workers", label: "50 to 150 workers" },
  { value: "150+ workers", label: "More than 150 workers" },
];

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
    industry: "",
    preferredBranch: "No preference",
    headcount: "",
    notes: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isSubmitted) successRef.current?.focus({ preventScroll: true });
  }, [isSubmitted]);

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

    if (!data.industry) {
      errs.industry = "Choose your industry";
    }

    if (!data.headcount) {
      errs.headcount = "Choose how many workers you need";
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
      industry: true,
      headcount: true,
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
    window.location.href = `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`;
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
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-12 lg:gap-20">
          {/* Executive contact */}
          <div className="lg:col-span-5">
            <Reveal>
              <SectionHeader
                id="contact-heading"
                tone="dark"
                title="Tell us how many people you need"
                intro="Send your positions, headcount and work site. Our Vice-President for Operations replies with a proposal and the company profile."
              />
            </Reveal>

            <m.div
              {...onView({ opacity: 0, y: 16 }, { opacity: 1, y: 0 }, { duration: 0.5, ease: EASE_OUT, delay: 0.1 })}
              className="mt-10 border-t border-white/15 pt-8"
            >
              <h3 className="font-display text-2xl text-white">John Patrick Ramos</h3>
              <p className="mt-1 text-base font-semibold text-white/90">Vice-President for Operations</p>

              <m.ul {...staggerParent(0.08)} className="mt-6 space-y-6 pointer-coarse:space-y-3">
                <m.li {...staggerItem} className="flex items-start gap-3">
                  <Phone className="mt-1.5 size-5 shrink-0 text-white/75" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-white/75">Globe</p>
                    <a
                      href="tel:09176291864"
                      className={cn(darkLink, "inline-block py-1 text-xl tabular-nums pointer-coarse:py-2.5 sm:text-2xl")}
                    >
                      0917-629-1864
                    </a>
                  </div>
                </m.li>
                <m.li {...staggerItem} className="flex items-start gap-3">
                  <Phone className="mt-1.5 size-5 shrink-0 text-white/75" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-white/75">Sun / Smart</p>
                    <a
                      href="tel:09237454050"
                      className={cn(darkLink, "inline-block py-1 text-xl tabular-nums pointer-coarse:py-2.5 sm:text-2xl")}
                    >
                      0923-745-4050
                    </a>
                  </div>
                </m.li>
                <m.li {...staggerItem} className="flex items-start gap-3">
                  <Phone className="mt-1.5 size-5 shrink-0 text-white/75" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-white/75">Valenzuela central office</p>
                    <div className="flex flex-wrap gap-x-5">
                      <a href="tel:+63282772959" className={cn(darkLink, "inline-block py-1 text-base tabular-nums pointer-coarse:py-2.5 sm:text-lg")}>
                        (02) 8277-2959
                      </a>
                      <a href="tel:+63282910807" className={cn(darkLink, "inline-block py-1 text-base tabular-nums pointer-coarse:py-2.5 sm:text-lg")}>
                        (02) 8291-0807
                      </a>
                    </div>
                  </div>
                </m.li>
                <m.li {...staggerItem} className="flex items-start gap-3">
                  <Mail className="mt-1 size-5 shrink-0 text-white/75" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-white/75">Email</p>
                    <a href={`mailto:${SALES_EMAIL}`} className={cn(darkLink, "inline-block break-all py-1 text-base pointer-coarse:py-2.5 sm:text-lg")}>
                      {SALES_EMAIL}
                    </a>
                  </div>
                </m.li>
              </m.ul>
            </m.div>
          </div>

          {/* Proposal request form */}
          <Reveal delay={0.1} className="lg:col-span-7">
            <div className="rounded-lg bg-background p-6 text-foreground sm:p-10">
              <AnimatePresence mode="wait" initial={false}>
                {isSubmitted ? (
                  <m.div
                    key="sent"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    role="status"
                  >
                    <m.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.1 }}
                      className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                    >
                      <CheckCircle className="size-6" aria-hidden="true" />
                    </m.div>
                    <h3
                      ref={successRef}
                      tabIndex={-1}
                      className="mt-5 text-xl font-bold tracking-tight text-secondary focus:outline-none"
                    >
                      Your email app opened
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-foreground">
                      We drafted your request to{" "}
                      <span className="font-semibold text-secondary">{SALES_EMAIL}</span>. Press send in your email app.
                      Nothing reaches MEGS until you do.
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                      No email app, or prefer to talk? Call John Patrick Ramos at 0917-629-1864.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button asChild size="lg" className="active:scale-[0.98] motion-reduce:active:scale-100">
                        <a href="tel:09176291864">
                          <Phone data-icon="inline-start" aria-hidden="true" />
                          Call 0917-629-1864
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="active:scale-[0.98] motion-reduce:active:scale-100"
                        onClick={() => {
                          setIsSubmitted(false);
                          setSubmitAttempted(false);
                        }}
                      >
                        Edit my request
                      </Button>
                    </div>
                  </m.div>
                ) : (
                  <m.form
                    key="form"
                    noValidate
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    <h3 className="font-display text-2xl text-secondary">Request a service proposal</h3>

                    <AnimatePresence initial={false}>
                      {submitAttempted && hasErrors && (
                        <m.div
                          key="errors"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: EASE_OUT }}
                        >
                          <Alert variant="destructive" className="mt-6">
                            <AlertCircle aria-hidden="true" />
                            <AlertTitle>Check the highlighted fields</AlertTitle>
                            <AlertDescription>
                              <p>Complete the required fields before sending your request.</p>
                            </AlertDescription>
                          </Alert>
                        </m.div>
                      )}
                    </AnimatePresence>

                    <FieldGroup className="mt-8 gap-6">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <Field data-invalid={showError("industry") || undefined}>
                          <FieldLabel htmlFor="field-industry">
                            Industry <Required />
                          </FieldLabel>
                          <select
                            id="field-industry"
                            value={formData.industry}
                            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                            onBlur={() => handleBlur("industry")}
                            aria-required="true"
                            aria-invalid={showError("industry")}
                            aria-describedby={showError("industry") ? "error-industry" : undefined}
                            className={cn(selectClass, !formData.industry && "text-muted-foreground")}
                          >
                            <option value="" disabled>
                              Select an industry
                            </option>
                            {INDUSTRY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-foreground">
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {showError("industry") && <FieldError id="error-industry">{errors.industry}</FieldError>}
                        </Field>

                        <Field data-invalid={showError("headcount") || undefined}>
                          <FieldLabel htmlFor="field-headcount">
                            Workers needed <Required />
                          </FieldLabel>
                          <select
                            id="field-headcount"
                            value={formData.headcount}
                            onChange={(e) => setFormData({ ...formData, headcount: e.target.value })}
                            onBlur={() => handleBlur("headcount")}
                            aria-required="true"
                            aria-invalid={showError("headcount")}
                            aria-describedby={showError("headcount") ? "error-headcount" : undefined}
                            className={cn(selectClass, !formData.headcount && "text-muted-foreground")}
                          >
                            <option value="" disabled>
                              Select a range
                            </option>
                            {HEADCOUNT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-foreground">
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {showError("headcount") && <FieldError id="error-headcount">{errors.headcount}</FieldError>}
                        </Field>
                      </div>

                      <Field>
                        <FieldLabel htmlFor="field-preferredBranch">Nearest MEGS office (optional)</FieldLabel>
                        <select
                          id="field-preferredBranch"
                          value={formData.preferredBranch}
                          onChange={(e) => setFormData({ ...formData, preferredBranch: e.target.value })}
                          className={selectClass}
                        >
                          {BRANCH_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field data-invalid={showError("notes") || undefined}>
                        <div className="flex items-center justify-between gap-3">
                          <FieldLabel htmlFor="field-notes">Roles and requirements (optional)</FieldLabel>
                          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                            {formData.notes.length}/1000
                          </span>
                        </div>
                        <Textarea
                          id="field-notes"
                          rows={4}
                          maxLength={1000}
                          className="min-h-28 bg-background"
                          placeholder="Roles, shifts, work site and start date"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          onBlur={() => handleBlur("notes")}
                          aria-invalid={showError("notes")}
                          aria-describedby={showError("notes") ? "error-notes" : undefined}
                        />
                        {showError("notes") && <FieldError id="error-notes">{errors.notes}</FieldError>}
                      </Field>

                      <Button
                        type="submit"
                        size="lg"
                        className="group w-full transition-[background-color,transform] duration-150 active:scale-[0.99] motion-reduce:active:scale-100"
                      >
                        <Send
                          data-icon="inline-start"
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                        Email my request
                      </Button>
                      <p className="-mt-2 text-center text-sm text-muted-foreground">
                        This opens your email app with the request filled in.
                      </p>
                    </FieldGroup>
                  </m.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
