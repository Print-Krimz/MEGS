import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatDate } from "../../../lib/utils";
import type { WalkInSlip as WalkInSlipData } from "../../../lib/types/application.types";

interface WalkInSlipProps {
  slip: WalkInSlipData;
  /** Printed under the code when set. Not saved anywhere. */
  nextVisitDate?: string;
  /** When the slip was opened for printing. Defaults to now. */
  printedAt?: string;
}

/** The 80 mm receipt. Everything inside prints black on white. */
export const WalkInSlip: React.FC<WalkInSlipProps> = ({ slip, nextVisitDate, printedAt }) => {
  const trackUrl = `${window.location.origin}${slip.trackPath}`;
  return (
    <div className="print-slip mx-auto w-[80mm] max-w-full border border-slate-300 bg-white p-4 text-center text-black">
      <p className="text-sm font-bold uppercase tracking-wide">MEGS</p>
      <p className="mt-3 text-base font-semibold">{slip.applicantName}</p>
      <p className="mt-1 text-sm">{slip.jobTitle}</p>
      {slip.clientName && <p className="text-sm">{slip.clientName}</p>}
      <p className="mt-4 text-xs">Tracking code</p>
      <p className="text-2xl font-bold tabular-nums tracking-wider">{slip.trackingCode}</p>
      <div className="mt-3 flex justify-center">
        <QRCodeSVG value={trackUrl} size={160} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={2} />
      </div>
      <p className="mt-3 text-xs">Scan to see where your application stands.</p>
      {nextVisitDate && (
        <p className="mt-3 text-sm font-semibold">Next visit: {formatDate(nextVisitDate)}</p>
      )}
      <p className="mt-3 text-xs">Printed {formatDate(printedAt ?? new Date().toISOString())}</p>
    </div>
  );
};
