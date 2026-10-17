import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CircleCheck, Loader2 } from "lucide-react";
import { Button, Dialog } from "../ui";
import { taApi } from "../../lib/api/ta.api";
import type { ResumeAnalysisPhase } from "../../lib/types/ta.types";
import { cn } from "../../lib/utils";

const STEPS: { phase: ResumeAnalysisPhase; label: string }[] = [
  { phase: "QUEUED", label: "Waiting for its turn" },
  { phase: "READING_RESUME", label: "Opening the resume" },
  { phase: "EXTRACTING_TEXT", label: "Reading the resume text" },
  { phase: "AI_ANALYSIS", label: "Checking each job requirement" },
  { phase: "SCORING", label: "Saving the new score" },
];

const stepIndex = (phase: ResumeAnalysisPhase) => STEPS.findIndex((step) => step.phase === phase);

interface ResumeAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: number | string;
  candidateName: string;
  /** Changes on every new run so polling restarts from a clean state. */
  runId: number;
  /** Called once when the run reaches DONE or FAILED. */
  onFinished: () => void;
}

export const ResumeAnalysisDialog: React.FC<ResumeAnalysisDialogProps> = ({
  open,
  onClose,
  applicationId,
  candidateName,
  runId,
  onFinished,
}) => {
  const { data } = useQuery({
    queryKey: ["ta", "analysis-status", applicationId, runId],
    queryFn: () => taApi.getAnalysisStatus(applicationId),
    enabled: runId > 0,
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return phase === "DONE" || phase === "FAILED" || phase === "IDLE" ? false : 1000;
    },
    gcTime: 0,
  });

  const phase: ResumeAnalysisPhase = data?.phase ?? "QUEUED";
  const isDone = phase === "DONE";
  const isFailed = phase === "FAILED";
  const isLost = phase === "IDLE";
  const isRunning = !isDone && !isFailed && !isLost;
  const current = isDone ? STEPS.length : stepIndex(phase);

  const finishedRunRef = useRef(0);
  useEffect(() => {
    if ((isDone || isFailed) && finishedRunRef.current !== runId) {
      finishedRunRef.current = runId;
      onFinished();
    }
  }, [isDone, isFailed, runId, onFinished]);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
  }, [runId]);
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, runId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Refreshing assessment"
      description={candidateName}
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-[9rem_1fr] items-start">
        {/* Resume page with a scan line while the analysis runs */}
        <div
          aria-hidden="true"
          className="relative mx-auto w-28 sm:w-36 aspect-[8.5/11] border border-slate-300 bg-white overflow-hidden"
        >
          <div className="p-3 space-y-1.5">
            <div className="h-2 w-3/4 bg-slate-300" />
            <div className="h-1.5 w-1/2 bg-slate-200" />
            <div className="pt-2 space-y-1">
              {[100, 92, 96, 70, 88, 94, 60].map((width, i) => (
                <div key={i} className="h-1 bg-slate-200" style={{ width: `${width}%` }} />
              ))}
            </div>
            <div className="h-1.5 w-1/3 bg-slate-300 mt-2" />
            <div className="space-y-1">
              {[90, 84, 96, 66, 80].map((width, i) => (
                <div key={i} className="h-1 bg-slate-200" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
          {isRunning && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-teal-600 animate-resume-scan motion-reduce:animate-none">
              <div className="absolute inset-x-0 bottom-0.5 h-6 bg-teal-500/15" />
            </div>
          )}
          {isDone && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <CircleCheck className="w-9 h-9 text-emerald-700" />
            </div>
          )}
          {(isFailed || isLost) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <AlertTriangle className="w-9 h-9 text-amber-700" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <ol className="space-y-2.5">
            {STEPS.map((step, i) => {
              const state = i < current ? "done" : i === current && isRunning ? "active" : "pending";
              return (
                <li key={step.phase} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      state === "done" && "border-emerald-700 bg-emerald-700 text-white",
                      state === "active" && "border-teal-600 text-teal-700",
                      state === "pending" && "border-slate-300 text-slate-400"
                    )}
                  >
                    {state === "done" && <Check className="w-3 h-3" />}
                    {state === "active" && <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />}
                  </span>
                  <span
                    className={cn(
                      state === "done" && "text-slate-700",
                      state === "active" && "font-medium text-slate-950",
                      state === "pending" && "text-slate-500"
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div role="status" aria-live="polite" className="mt-4 border-t border-slate-200 pt-3 text-sm">
            {isRunning && (
              <p className="text-slate-600">
                {STEPS[Math.max(current, 0)]?.label}… <span className="tabular-nums">{elapsed}s</span>
              </p>
            )}
            {isDone && (
              <div className="space-y-1 text-slate-800">
                <p>Done. The assessment on this page is updated.</p>
                {typeof data?.fitScore === "number" ? (
                  <p>
                    Match score:{" "}
                    <span className="font-semibold tabular-nums">{data.fitScore.toFixed(1)}/100</span>
                  </p>
                ) : typeof data?.score === "number" ? (
                  <p>
                    Match score:{" "}
                    <span className="font-semibold tabular-nums">{data.score}/100</span>
                  </p>
                ) : null}
                {typeof data?.requirementsTotal === "number" && data.requirementsTotal > 0 && (
                  <p>
                    Job requirements met:{" "}
                    <span className="font-semibold tabular-nums">
                      {data.requirementsMet ?? 0} of {data.requirementsTotal}
                    </span>
                  </p>
                )}
              </div>
            )}
            {isFailed && (
              <p className="text-amber-800">
                The analysis could not finish. Review the resume manually; the application is marked as needing attention.
              </p>
            )}
            {isLost && (
              <p className="text-amber-800">
                Progress for this run is no longer available. Reload the page in a minute to see the latest score.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant={isRunning ? "outline" : "primary"} size="sm" onClick={onClose}>
          {isRunning ? "Continue in background" : "Close"}
        </Button>
      </div>
    </Dialog>
  );
};
