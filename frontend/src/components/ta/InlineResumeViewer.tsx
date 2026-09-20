import React from "react";
import {
  FileText,
  Maximize2,
  Download,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/Button";

export interface InlineResumeViewerProps {
  resumeUrl?: string | null;
  candidateName: string;
  candidateInitials?: string;
  photoUrl?: string | null;
  onOpenFullscreen?: () => void;
  onInspectPhoto?: () => void;
  onCollapse?: () => void;
}

export const InlineResumeViewer: React.FC<InlineResumeViewerProps> = ({
  resumeUrl,
  candidateName,
  onOpenFullscreen,
  onCollapse,
}) => {

  const hasResume = Boolean(resumeUrl && resumeUrl.trim().length > 0);
  const isImage = hasResume && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(resumeUrl!);
  const isPdf = hasResume && (/\.pdf(\?.*)?$/i.test(resumeUrl!) || (!isImage && resumeUrl!.startsWith("http")));

  return (
    <div className="border border-slate-300 bg-white rounded-lg shadow-xs flex flex-col overflow-hidden">
      {/* Viewer Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-teal-50 border border-teal-200 rounded text-teal-800 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              Resume
            </h3>
            <p className="text-xs text-slate-500 truncate">
              {candidateName} • Candidate document
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {hasResume && (
            <>
              {onOpenFullscreen && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
                  onClick={onOpenFullscreen}
                  aria-label="Open resume full screen"
                  title="Open resume full screen"
                  className="h-8 text-xs font-sans text-slate-700"
                >
                  <span className="hidden sm:inline">Fullscreen</span>
                </Button>
              )}
              <a
                href={resumeUrl!}
                target="_blank"
                rel="noreferrer"
                download={`${candidateName.replace(/\s+/g, "_")}_Resume`}
                aria-label="Download resume"
                title="Download original resume"
                className="inline-flex items-center justify-center h-8 px-3 gap-1.5 text-xs font-sans font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] select-none"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Download resume</span>
              </a>
            </>
          )}
          {onCollapse && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
              onClick={onCollapse}
              aria-label="Hide resume"
              title="Hide resume panel"
              className="h-8 text-xs font-sans text-slate-700"
            >
              <span className="hidden sm:inline">Hide resume</span>
            </Button>
          )}
        </div>
      </div>

      {/* Viewer Body */}
      <div className={`relative bg-slate-100 flex items-center justify-center overflow-hidden ${
        hasResume ? "min-h-[460px] h-[calc(100vh-300px)] max-h-[740px]" : "py-10 px-6 min-h-[220px]"
      }`}>
        {!hasResume ? (
          <div className="text-center p-6 bg-white border border-dashed border-slate-300 rounded-lg max-w-sm mx-4 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">No resume attached</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              This applicant has not uploaded a resume. Profile details are shown on the left.
            </p>
          </div>
        ) : isPdf ? (
          <iframe
            src={resumeUrl!}
            title={`${candidateName} - Resume`}
            className="w-full h-full border-none bg-white"
          />
        ) : isImage ? (
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <img
              src={resumeUrl!}
              alt={`${candidateName} resume`}
              className="max-h-full max-w-full object-contain rounded border border-slate-300 bg-white shadow-xs"
            />
          </div>
        ) : (
          <div className="text-center p-8 bg-white border border-slate-300 rounded-lg max-w-sm mx-4 space-y-3">
            <FileText className="w-10 h-10 text-slate-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Document available</h4>
            <p className="text-xs text-slate-500">
              This document type cannot be previewed here.
            </p>
            <a
              href={resumeUrl!}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded text-xs font-semibold hover:bg-teal-800 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download document
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
