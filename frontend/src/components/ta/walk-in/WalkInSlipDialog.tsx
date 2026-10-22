import React, { useEffect, useState } from "react";
import { Dialog, Button } from "../../ui";
import { DateField } from "../../common/DateField";
import { getManilaToday } from "../../../lib/field-limits";
import { WalkInSlip } from "./WalkInSlip";
import type { WalkInSlip as WalkInSlipData } from "../../../lib/types/application.types";

interface WalkInSlipDialogProps {
  slip: WalkInSlipData | null;
  onClose: () => void;
}

export const WalkInSlipDialog: React.FC<WalkInSlipDialogProps> = ({ slip, onClose }) => {
  const [nextVisitDate, setNextVisitDate] = useState("");

  useEffect(() => {
    setNextVisitDate("");
  }, [slip?.trackingCode]);

  return (
    <Dialog
      open={Boolean(slip)}
      onClose={onClose}
      title="Print the slip"
      description="Give it to the applicant. The QR shows their progress without a login."
      size="md"
    >
      {slip && (
        <div className="space-y-4">
          <div className="no-print">
            <DateField
              id="walk-in-next-visit"
              label="Next visit (optional)"
              min={getManilaToday()}
              value={nextVisitDate}
              onChange={(e) => setNextVisitDate(e.target.value)}
              help="Printed on the slip only."
            />
          </div>
          <WalkInSlip slip={slip} nextVisitDate={nextVisitDate || undefined} />
          <div className="no-print flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.print()}>Print slip</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
