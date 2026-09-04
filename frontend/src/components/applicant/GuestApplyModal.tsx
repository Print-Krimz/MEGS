import React from "react";
import { Link } from "@tanstack/react-router";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Briefcase, UserPlus, LogIn, CheckCircle2, ShieldCheck } from "lucide-react";

export interface GuestApplyModalProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  jobId?: string | number;
}

export const GuestApplyModal: React.FC<GuestApplyModalProps> = ({
  open,
  onClose,
  jobTitle = "this position",
  jobId,
}) => {
  const redirectPath = jobId ? `/app/jobs/${jobId}` : "/app/jobs";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create an Account to Apply"
      description={`Join MEGS to complete your application for ${jobTitle}.`}
    >
      <div className="space-y-5 pt-1">
        <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-xl space-y-2.5">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Candidate Portal Benefits</span>
          </div>
          <ul className="text-xs text-slate-700 space-y-1.5 pl-6 list-disc">
            <li>Submit your application in 1 click with your profile resume</li>
            <li>Track interview milestones from screening to work site deployment</li>
            <li>Receive direct recruiter invitations for matching job openings</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
          <Link
            to="/register"
            search={{ redirect: redirectPath } as any}
            className="flex-1"
            onClick={onClose}
          >
            <Button
              variant="primary"
              size="md"
              leftIcon={<UserPlus className="w-4 h-4" />}
              className="w-full"
            >
              Create Candidate Account
            </Button>
          </Link>

          <Link
            to="/login"
            search={{ redirect: redirectPath } as any}
            className="flex-1"
            onClick={onClose}
          >
            <Button
              variant="outline"
              size="md"
              leftIcon={<LogIn className="w-4 h-4" />}
              className="w-full"
            >
              Already Registered? Sign In
            </Button>
          </Link>
        </div>
      </div>
    </Dialog>
  );
};
