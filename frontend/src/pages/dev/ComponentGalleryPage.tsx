import React, { useState } from "react";
import {
  Button,
  Input,
  Select,
  Textarea,
  Dialog,
  Badge,
} from "../../components/ui";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  PipelineIndicator,
  EmptyState,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  Pagination,
  SearchFilters,
  NotificationBell,
} from "../../components/common";
import { Plus, Trash2, Send, Download } from "lucide-react";
import { ApplicationStatus, DeploymentStatus, EmploymentStatus } from "../../lib/types/enums";

export const ComponentGalleryPage: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [searchVal, setSearchVal] = useState("");
  const [filterVal, setFilterVal] = useState<Record<string, string>>({});

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12 bg-white rounded-2xl border border-slate-200 my-8 shadow-sm">
      <PageHeader
        title="MEGS Component Library Gallery"
        description="Phase 2 Component Library Verification & Visual QA Inspection"
        breadcrumbs={[
          { label: "Design System", href: "/dev" },
          { label: "Component Gallery" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export Tokens
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setDialogOpen(true)}
            >
              Open Dialog Demo
            </Button>
          </div>
        }
      />

      {/* 1. Buttons */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          1. Button Variants & Sizes
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">Primary SM</Button>
          <Button variant="primary" size="md">Primary MD</Button>
          <Button variant="primary" size="lg">Primary LG</Button>
          <Button variant="secondary" size="md">Secondary</Button>
          <Button variant="outline" size="md">Outline</Button>
          <Button variant="ghost" size="md">Ghost</Button>
          <Button variant="danger" size="md" leftIcon={<Trash2 className="w-4 h-4" />}>
            Danger
          </Button>
          <Button variant="primary" size="md" loading>Loading</Button>
          <Button variant="primary" size="md" disabled>Disabled</Button>
        </div>
      </section>

      {/* 2. Inputs & Forms */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          2. Form Inputs, Select & Textarea
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="Candidate Full Name"
            placeholder="e.g. Juan dela Cruz"
            helperText="Enter name as listed on NBI clearance"
            required
          />
          <Input
            label="Invalid Field Demo"
            value="invalid-email@"
            error="Please enter a valid email address"
            readOnly
          />
          <Select
            label="Recruitment Department"
            options={[
              { value: "ENG", label: "Engineering Operations" },
              { value: "LOG", label: "Logistics & Manpower" },
              { value: "SEC", label: "Site Security Services" },
            ]}
          />
        </div>
        <Textarea
          label="Recruiter Decision Notes"
          placeholder="Document screening rationale, behavioral notes, and endorsement criteria..."
        />
      </section>

      {/* 3. Badges, Scores & Pipeline */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          3. Status Badges & Candidate Score Badges
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="neutral">Neutral Badge</Badge>
          <Badge variant="primary">Primary Badge</Badge>
          <Badge variant="success">Success Badge</Badge>
          <Badge variant="warning">Warning Badge</Badge>
          <Badge variant="danger">Danger Badge</Badge>
          <Badge variant="info">Info Badge</Badge>
          <Badge variant="purple">Purple Badge</Badge>
        </div>

        <div className="flex flex-wrap gap-2 items-center pt-2">
          <StatusBadge status={ApplicationStatus.SUBMITTED} />
          <StatusBadge status={ApplicationStatus.INITIAL_SCREENING} />
          <StatusBadge status={ApplicationStatus.CLIENT_ENDORSEMENT} />
          <StatusBadge status={ApplicationStatus.FINAL_INTERVIEW} />
          <StatusBadge status={ApplicationStatus.HIRED} />
          <StatusBadge status={ApplicationStatus.COMPLIANCE} />
          <StatusBadge status={ApplicationStatus.DEPLOYED} />
          <StatusBadge status={ApplicationStatus.TALENT_POOL} />
          <StatusBadge status={DeploymentStatus.ACTIVE} type="deployment" />
          <StatusBadge status={EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT} type="employment" />
        </div>

        <div className="flex flex-wrap gap-3 items-center pt-2">
          <ScoreBadge score={92.4} size="lg" />
          <ScoreBadge score={84.0} size="md" />
          <ScoreBadge score={67.5} size="md" />
          <ScoreBadge score={48.2} size="md" />
          <ScoreBadge score={null} size="sm" />
        </div>

        <div className="pt-4 bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-500 uppercase">
            Hiring Pipeline Step Indicator (Canonical Progression)
          </h3>
          <PipelineIndicator currentStatus={ApplicationStatus.FINAL_INTERVIEW} />
        </div>
      </section>

      {/* 4. Search & Filters Bar */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          4. SearchFilters Bar & Notification Bell
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchFilters
              searchValue={searchVal}
              onSearchChange={setSearchVal}
              filterValues={filterVal}
              onFilterChange={(k, v) => setFilterVal((prev) => ({ ...prev, [k]: v }))}
              onReset={() => {
                setSearchVal("");
                setFilterVal({});
              }}
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: [
                    { value: "SCREENING", label: "Initial Screening" },
                    { value: "ENDORSED", label: "Client Endorsed" },
                    { value: "HIRED", label: "Hired" },
                  ],
                },
              ]}
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  onClick={() => setConfirmOpen(true)}
                >
                  Bulk Action
                </Button>
              }
            />
          </div>
          <NotificationBell
            unreadCount={3}
            notifications={[
              {
                id: 1,
                userId: "u1",
                title: "Interview SLA Warning",
                message: "Candidate Juan dela Cruz interview deadline in 24 hours",
                type: "INTERVIEW_SLA",
                isRead: false,
                createdAt: new Date().toISOString(),
              },
              {
                id: 2,
                userId: "u1",
                title: "New Application Matched",
                message: "Warehouse Supervisor candidate scored 89.2% fit",
                type: "AI_MATCH",
                isRead: false,
                createdAt: new Date(Date.now() - 3600000).toISOString(),
              },
            ]}
          />
        </div>
      </section>

      {/* 5. Pagination */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          5. Table Pagination
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl p-2">
          <Pagination
            currentPage={activePage}
            totalPages={8}
            totalItems={78}
            pageSize={10}
            onPageChange={setActivePage}
          />
        </div>
      </section>

      {/* 6. Empty & Error States */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          6. Loading, Empty & Error States
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmptyState
            title="No Candidates in Talent Pool"
            description="Search by qualifications or add candidates to build your talent pool."
            action={
              <Button variant="outline" size="sm">
                Search Candidates
              </Button>
            }
          />
          <ErrorState
            message="Unable to load candidate timeline. Please try again."
            onRetry={() => alert("Retrying request...")}
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-mono text-slate-500">Skeleton Loader (Table):</h3>
          <LoadingState variant="table" rows={3} />
        </div>
      </section>

      {/* Dialogs Demos */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Schedule Initial Candidate Screening"
        description="Set interview date, time, and compliance SLA deadline."
      >
        <div className="space-y-4">
          <Input label="Interview Date & Time" type="datetime-local" required />
          <Textarea label="Interviewer Prep Notes" placeholder="Questions to ask..." />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setDialogOpen(false)}>
              Save Schedule
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          alert("Action confirmed!");
          setConfirmOpen(false);
        }}
        variant="danger"
        title="End Deployment & Return to Redeployment Pool"
        description="Are you sure you want to end this active site deployment? This will transition the employee status to AVAILABLE_FOR_REDEPLOYMENT."
        confirmLabel="End Deployment"
      />
    </div>
  );
};
