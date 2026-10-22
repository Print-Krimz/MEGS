import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui";
import { ConfirmDialog } from "../common";
import { taApi } from "../../lib/api/ta.api";
import { notify } from "../../lib/feedback";
import { AssistedResponseDialog } from "./AssistedResponseDialog";

export interface OfferReplyActionsProps {
  invitationId: number;
  candidateName: string;
  jobTitle: string;
  hasPortalAccess: boolean;
  hasMobile: boolean;
  maskedMobile?: string | null;
}

/**
 * Record reply and Text offer link for a pending offer. The primary style goes to the route
 * that works for this applicant: without portal access the TA has to act for them.
 */
export const OfferReplyActions: React.FC<OfferReplyActionsProps> = ({
  invitationId,
  candidateName,
  jobTitle,
  hasPortalAccess,
  hasMobile,
  maskedMobile,
}) => {
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);

  const smsMutation = useMutation({
    mutationFn: () => taApi.sendOfferSmsLink(invitationId),
    onSuccess: (res) => {
      setTextOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      notify.success("Offer link sent", `Texted to ${res.sentTo}.`);
    },
    onError: (err: unknown) => {
      setTextOpen(false);
      notify.error("Could not text the offer link", err);
    },
  });

  // One primary per area: Record reply leads when the applicant has no portal to answer in.

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant={hasPortalAccess ? "outline" : "primary"} size="sm" onClick={() => setRecordOpen(true)}>
          Record reply
          <span className="sr-only"> for {candidateName}</span>
        </Button>
        {hasMobile && (
          <Button variant="outline" size="sm" onClick={() => setTextOpen(true)}>
            Text offer link
            <span className="sr-only"> to {candidateName}</span>
          </Button>
        )}
      </div>

      <AssistedResponseDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        invitationId={invitationId}
        candidateName={candidateName}
        jobTitle={jobTitle}
      />
      <ConfirmDialog
        open={textOpen}
        onClose={() => setTextOpen(false)}
        onConfirm={() => smsMutation.mutate()}
        title={maskedMobile ? `Text the offer link to ${maskedMobile}?` : "Text the offer link?"}
        description={`${candidateName} gets an SMS with a link to accept or decline ${jobTitle}. The link works once.`}
        confirmLabel="Send text"
        cancelLabel="Cancel"
        loading={smsMutation.isPending}
      />
    </>
  );
};
