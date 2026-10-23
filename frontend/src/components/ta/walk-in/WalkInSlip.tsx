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
  /** One cell of the A4 sheet instead of the 80 mm receipt. Same content, laid out to fit 8 to a page. */
  sheet?: boolean;
}

/** The 80 mm receipt. Everything inside prints black on white. */
export const WalkInSlip: React.FC<WalkInSlipProps> = ({ slip, nextVisitDate, printedAt, sheet = false }) => {
  const trackUrl = `${window.location.origin}${slip.trackPath}`;
  if (sheet) {
    return (
      <div className="slip-cell flex h-full items-center gap-[4mm] overflow-hidden border-b border-r border-dashed border-slate-500 bg-white p-[5mm] text-left text-black">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide">MEGS</p>
          <p className="mt-1 break-words text-sm font-semibold">{slip.applicantName}</p>
          <p className="break-words text-xs">{slip.jobTitle}</p>
          {slip.clientName && <p className="break-words text-xs">{slip.clientName}</p>}
          <p className="mt-2 text-[10px]">Tracking code</p>
          <p className="text-lg font-bold tabular-nums tracking-wider">{slip.trackingCode}</p>
          <p className="mt-1 text-[10px]">Scan to see where your application stands.</p>
          {nextVisitDate && <p className="mt-1 text-xs font-semibold">Next visit: {formatDate(nextVisitDate)}</p>}
          <p className="mt-1 text-[10px]">Printed {formatDate(printedAt ?? new Date().toISOString())}</p>
        </div>
        <QRCodeSVG value={trackUrl} size={112} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={1} className="shrink-0" />
      </div>
    );
  }
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
