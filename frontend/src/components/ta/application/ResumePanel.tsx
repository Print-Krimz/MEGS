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

/** Sticky right-hand column from 1024px. It holds the resume only, so it never needs its own scroll. */
export const ResumeColumn: React.FC<ViewerProps & { onHide: () => void; topOffset: number }> = ({
  resumeUrl,
  candidateName,
  candidateInitials,
  onFullscreen,
  onHide,
  topOffset,
}) => (
  <aside aria-label="Resume" className="lg:sticky" style={{ top: topOffset }}>
    <InlineResumeViewer
      resumeUrl={resumeUrl}
      candidateName={candidateName}
      candidateInitials={candidateInitials}
      onOpenFullscreen={onFullscreen}
      onCollapse={onHide}
      bodyClassName="min-h-[280px] h-[calc(100vh-16rem)] max-h-[800px]"
    />
  </aside>
);

/** Below 1024px: one "View resume" button and a drawer, so the resume never pushes the content down. */
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
        className="w-full gap-0 overflow-y-auto bg-white p-0 data-[state=closed]:duration-200 data-[state=open]:duration-200 motion-reduce:animate-none motion-reduce:transition-none sm:max-w-xl"
      >
        <SheetTitle className="sr-only">Resume of {candidateName}</SheetTitle>
        <SheetDescription className="sr-only">The resume the candidate uploaded.</SheetDescription>
        <div className="p-3 pt-12">
          <InlineResumeViewer
            resumeUrl={resumeUrl}
            candidateName={candidateName}
            candidateInitials={candidateInitials}
            onOpenFullscreen={onFullscreen}
            bodyClassName="min-h-[360px] h-[calc(100vh-10rem)]"
          />
        </div>
      </SheetContent>
    </Sheet>
  </>
);
