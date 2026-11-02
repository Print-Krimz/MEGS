import React from "react";
import { PublicShell } from "./PublicShell";

// Draft notice text: have MEGS management or legal review it before relying on it.
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "What we collect",
    body: "The details in your applicant profile and job applications, such as your name, contact details, address, work history, education, skills, government ID numbers you choose to add, and the documents you upload, including your resume.",
  },
  {
    heading: "Why we use it",
    body: "MEGS uses your information to assess your fit for job openings, contact you about your application, and process employment and deployment if you are hired. Only MEGS staff who handle recruitment can see your profile.",
  },
  {
    heading: "AI reading of your resume",
    body: "When you upload a resume, MEGS sends the file to Google's Gemini AI service to read it and suggest profile details. Nothing is saved to your profile until you review and confirm it.",
  },
  {
    heading: "How long we keep it",
    body: "We keep your information while your account is active and as long as needed for recruitment and employment records required by law.",
  },
  {
    heading: "Your rights",
    body: "Under the Data Privacy Act of 2012 you may ask to see, correct or delete your personal information. Contact your MEGS branch office to make a request.",
  },
];

export const PrivacyPage: React.FC = () => (
  <PublicShell title="Data Privacy Notice">
    <article className="rounded-lg border border-border bg-background p-6">
      <h1 className="font-display text-2xl leading-tight text-secondary">Data Privacy Notice</h1>
      {SECTIONS.map((s) => (
        <section key={s.heading} className="mt-5">
          <h2 className="text-base font-semibold text-foreground">{s.heading}</h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">{s.body}</p>
        </section>
      ))}
    </article>
  </PublicShell>
);
