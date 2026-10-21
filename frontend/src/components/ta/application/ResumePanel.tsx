import React from "react";
import { FileText } from "lucide-react";
import { Button } from "../../ui";
import { InlineResumeViewer } from "../InlineResumeViewer";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../../shadcn/sheet";

interface ViewerProps {
  resumeUrl?: string | null;
  candidateName: string;
  candidateInitials: string;
  onFullscreen: () => void;
}

/** Gap kept under the sticky resume so its bottom edge never touches the window edge. */
const BOTTOM_GAP = 16;

/**
 * The resume inside the side column (the layout draws the column itself). It sticks under the app
 * header and stage bar and takes the rest of the window height, so the document never sits in a
 * short box with empty space under it.
 */
export const ResumeRail: React.FC<ViewerProps & { onHide: () => void; topOffset: number }> = ({
  resumeUrl,
  candidateName,
  candidateInitials,
  onFullscreen,
  onHide,
  topOffset,
}) => {
  const hasResume = Boolean(resumeUrl?.trim());
  return (
    <div
      className="sticky"
      style={{ top: topOffset, height: hasResume ? `max(24rem, calc(100dvh - ${topOffset + BOTTOM_GAP}px))` : undefined }}
    >
      <InlineResumeViewer
        resumeUrl={resumeUrl}
        candidateName={candidateName}
        candidateInitials={candidateInitials}
        onOpenFullscreen={onFullscreen}
        onCollapse={onHide}
      />
    </div>
  );
};

/** Docked on the right edge while the resume is hidden: one click brings the column back. */
export const ResumeDockTab: React.FC<{ onShow: () => void }> = ({ onShow }) => (
  <button
    type="button"
    onClick={onShow}
    aria-label="Show resume"
    title="Show resume"
    className="focus-ring fixed right-0 top-1/3 z-30 flex h-28 w-10 items-center justify-center rounded-l-md border border-r-0 border-navy bg-navy text-sm font-medium text-white shadow-md hover:bg-navy-hover"
  >
    <span className="[writing-mode:vertical-rl]">Resume</span>
  </button>
);

/** Below 1024px: a "View resume" button in the summary and a wide sheet, so the resume never pushes the content down. */
export const ResumeDrawerButton: React.FC<ViewerProps & { open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
  resumeUrl,
  candidateName,
  candidateInitials,
  onFullscreen,
}) => (
  <>
    <Button variant="outline" size="sm" leftIcon={<FileText className="h-3.5 w-3.5" />} onClick={() => onOpenChange(true)} aria-label="View Resume">
      View resume
    </Button>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 bg-white p-0 data-[state=closed]:duration-200 data-[state=open]:duration-200 motion-reduce:animate-none motion-reduce:transition-none sm:max-w-3xl"
      >
        <SheetTitle className="sr-only">Resume of {candidateName}</SheetTitle>
        <SheetDescription className="sr-only">The resume the candidate uploaded.</SheetDescription>
        <div className="h-full p-3 pt-12">
          <InlineResumeViewer
            resumeUrl={resumeUrl}
            candidateName={candidateName}
            candidateInitials={candidateInitials}
            onOpenFullscreen={onFullscreen}
          />
        </div>
      </SheetContent>
    </Sheet>
  </>
);
