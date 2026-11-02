import React from "react";
import { PublicShell } from "./PublicShell";
import { PrivacyNoticeSections } from "../../components/public/PrivacyNoticeSections";

export const PrivacyPage: React.FC = () => (
  <PublicShell title="Data Privacy Notice">
    <article className="rounded-lg border border-border bg-background p-6">
      <h1 className="font-display text-2xl leading-tight text-secondary">Data Privacy Notice</h1>
      <div className="mt-5">
        <PrivacyNoticeSections />
      </div>
    </article>
  </PublicShell>
);
