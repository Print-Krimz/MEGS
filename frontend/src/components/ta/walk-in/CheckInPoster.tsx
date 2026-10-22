import React, { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Dialog } from "../../ui";

const SCREEN_SCALE = 0.4;

/** A4 poster. Everything inside prints black on white. */
export const CheckInPoster: React.FC<{ scaleOnScreen?: boolean }> = ({ scaleOnScreen = false }) => {
  const url = `${window.location.origin}/check-in`;
  return (
    <div
      className="print-poster flex flex-col items-center bg-white px-[18mm] py-[20mm] text-center text-black"
      style={{
        width: "210mm",
        height: "297mm",
        ...(scaleOnScreen ? { transform: `scale(${SCREEN_SCALE})`, transformOrigin: "top left" } : {}),
      }}
    >
      <p className="text-[28pt] font-bold tracking-[0.2em]">MEGS</p>
      <h1 className="mt-[16mm] text-[44pt] font-bold leading-tight">Applying today? Scan to check in.</h1>
      <div className="mt-[14mm]">
        <QRCodeSVG value={url} size={380} level="M" bgColor="#ffffff" fgColor="#000000" marginSize={2} />
      </div>
      <ol className="mt-[14mm] list-decimal space-y-[3mm] pl-[10mm] text-left text-[20pt] leading-snug">
        <li>Scan the code with your phone camera.</li>
        <li>Pick your job and enter your details.</li>
        <li>Show your number at the desk.</li>
      </ol>
      <p className="mt-auto text-[14pt]">Cannot scan? Open {url} in your phone browser.</p>
    </div>
  );
};

interface CheckInPosterDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CheckInPosterDialog: React.FC<CheckInPosterDialogProps> = ({ open, onClose }) => {
  // The slip prints on 80 mm paper. While this dialog is open the page size is A4 instead.
  useEffect(() => {
    if (!open) return;
    const style = document.createElement("style");
    style.media = "print";
    style.textContent = "@page { size: A4; margin: 0; }";
    document.head.appendChild(style);
    return () => style.remove();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Print check-in poster"
      description="Put it at the entrance. Applicants scan it to join the queue."
      size="md"
    >
      <div className="space-y-4">
        <div
          className="no-print mx-auto overflow-hidden rounded-md border border-slate-300 shadow-sm"
          style={{ width: `calc(210mm * ${SCREEN_SCALE})`, height: `calc(297mm * ${SCREEN_SCALE})`, maxWidth: "100%" }}
        >
          <CheckInPoster scaleOnScreen />
        </div>
        <div className="no-print flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print poster</Button>
        </div>
      </div>
    </Dialog>
  );
};
