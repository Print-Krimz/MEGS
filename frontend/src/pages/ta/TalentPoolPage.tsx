import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea, ComboBox } from "../../components/ui";
import {
  Sparkles,
  Search,
  PhoneCall,
  ArrowRight,
  MapPin,
  Briefcase,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TalentPoolCandidate } from "../../lib/types/ta.types";

export const TalentPoolPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<number>(0);
  const [searchK, setSearchK] = useState<number>(10);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Contact Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMembershipId, setContactMembershipId] = useState<number>(0);
  const [contactCandidateName, setContactCandidateName] = useState("");
  const [contactOutcome, setContactOutcome] = useState("INTERESTED");
  const [contactNotes, setContactNotes] = useState("");
  const [contactJobId, setContactJobId] = useState<number>(0);
  const [contactJobError, setContactJobError] = useState<string | null>(null);

  // Consider / Reactivation Modal State
  const [considerModalOpen, setConsiderModalOpen] = useState(false);
  const [considerCandidate, setConsiderCandidate] = useState<TalentPoolCandidate | null>(null);
  const [considerJobId, setConsiderJobId] = useState<number>(0);
  const [considerNotes, setConsiderNotes] = useState("");
  const [considerOutcome, setConsiderOutcome] = useState<"INTERESTED" | "NOT_INTERESTED" | "NO_RESPONSE" | "UNAVAILABLE">("INTERESTED");
  const [considerJobError, setConsiderJobError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown"],
    queryFn: () => taApi.listJobs(),
  });

  const searchMutation = useMutation({
    mutationFn: taApi.searchTalentPool,
  });

  const recordContactMutation = useMutation({
    mutationFn: taApi.recordContact,
    onSuccess: () => {
      setContactModalOpen(false);
      setContactNotes("");
      setContactJobError(null);
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool"] });
      const msg = "Candidate outreach log saved successfully.";
      setFeedback({ type: "success", message: msg });
      notify.success("Contact Logged", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to log contact outcome: " + err.message });
      notify.error("Logging Failed", err);
    },
  });

  const considerCandidateMutation = useMutation({
    mutationFn: taApi.considerCandidateForJob,
    onSuccess: (res) => {
      setConsiderModalOpen(false);
      setConsiderNotes("");
      setConsiderJobError(null);
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool"] });
      const fitScoreMsg = res.score?.finalFitScore !== undefined ? ` (Fit Score: ${res.score.finalFitScore}%)` : "";
      const msg = `Candidate reactivated into Application #${res.application?.id || ""}${fitScoreMsg} for selected job requisition.`;
      setFeedback({ type: "success", message: msg });
      notify.success("Candidate Reactivated", msg);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to reactivate candidate: " + err.message });
      notify.error("Reactivation Failed", err);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchText.trim();
    if (!query && !selectedJobId) {
      setValidationError("Please enter keywords (at least 2 characters) or select a job requisition.");
      return;
    }
    if (query && query.length < 2) {
      setValidationError("Search query must be at least 2 characters long.");
      return;
    }
    setValidationError(null);
    searchMutation.mutate({
      text: query || undefined,
      jobId: selectedJobId || undefined,
      k: searchK,
    });
  };

  const handleReset = () => {
    setSearchText("");
    setSelectedJobId(0);
    setSearchK(10);
    setValidationError(null);
    searchMutation.reset();
  };

  const jobs = jobsQuery.data || [];
  const results = searchMutation.data || [];

  const handleOpenContactModal = (c: TalentPoolCandidate) => {
    setContactMembershipId(c.membershipId || c.applicantProfileId || 0);
    setContactCandidateName(`${c.firstName} ${c.lastName}`);
    setContactJobId(jobs[0]?.id || 0);
    setContactOutcome("INTERESTED");
    setContactNotes("");
    setContactJobError(null);
    setContactModalOpen(true);
  };

  const handleSaveContact = () => {
    if (!contactJobId || contactJobId <= 0) {
      setContactJobError("Please select a target job requisition for this contact record.");
      return;
    }
    setContactJobError(null);
    recordContactMutation.mutate({
      membershipId: contactMembershipId,
      jobPostingId: contactJobId,
      outcome: contactOutcome,
      notes: contactNotes || undefined,
    });
  };

  const handleOpenConsiderModal = (c: TalentPoolCandidate) => {
    setConsiderCandidate(c);
    setConsiderJobId(selectedJobId > 0 ? selectedJobId : jobs[0]?.id || 0);
    setConsiderOutcome("INTERESTED");
    setConsiderNotes("");
    setConsiderJobError(null);
    setConsiderModalOpen(true);
  };

  const handleConfirmConsider = () => {
    if (!considerCandidate) return;
    if (!considerJobId || considerJobId <= 0) {
      setConsiderJobError("Please select an active target job requisition.");
      return;
    }
    setConsiderJobError(null);
    considerCandidateMutation.mutate({
      applicantProfileId: considerCandidate.applicantProfileId,
      targetJobId: considerJobId,
      notes: considerNotes || undefined,
      contactOutcome: considerOutcome,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate pool"
        description="Search past applicants, pre-screened talent, and redeployment candidates across qualifications and experience"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Talent Pool" },
        ]}
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Semantic Search Box */}
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
          <h3 className="text-xs font-mono font-bold uppercase text-slate-800">
            Candidate Search & Match
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-6">
            <Input
              label="Search by Skills, Keywords, or Qualifications"
              placeholder="e.g. Electrician with TESDA NC II, industrial machinery repair, Laguna area"
              value={searchText}
              error={validationError || undefined}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="sm:col-span-4">
            <ComboBox
              label="Match Against Job (Optional)"
              placeholder="Search or select job requisition..."
              value={selectedJobId ? String(selectedJobId) : ""}
              onChange={(val) => {
                setSelectedJobId(Number(val) || 0);
                if (validationError) setValidationError(null);
              }}
              options={[
                { value: "", label: "All Job Categories (Keyword Search)" },
                ...jobs.map((j) => ({
                  value: String(j.id),
                  label: j.title,
                  subtitle: `REQ #${j.id} • ${j.location || "Philippines"}`,
                  badge: j.status,
                })),
              ]}
              clearable={Boolean(selectedJobId)}
            />
          </div>

          <div className="sm:col-span-2">
            <Select
              label="Max Results"
              value={searchK}
              onChange={(e) => setSearchK(Number(e.target.value))}
              options={[
                { value: 5, label: "Top 5" },
                { value: 10, label: "Top 10" },
                { value: 20, label: "Top 20" },
                { value: 50, label: "Top 50" },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {(searchText || selectedJobId > 0 || searchMutation.isSuccess || searchMutation.isError) && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              Clear Filter
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={searchMutation.isPending}
            leftIcon={<Search className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto"
          >
            Search Talent Pool
          </Button>
        </div>
      </form>

      {/* Results View */}
      {searchMutation.isPending ? (
        <LoadingState variant="cards" />
      ) : searchMutation.isError ? (
        <ErrorState
          error={searchMutation.error}
          onRetry={() => {
            const query = searchText.trim();
            if (query.length >= 2 || selectedJobId > 0) {
              searchMutation.mutate({
                text: query || undefined,
                jobId: selectedJobId || undefined,
                k: searchK,
              });
            } else {
              searchMutation.reset();
            }
          }}
        />
      ) : searchMutation.isSuccess && results.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Sparkles className="w-6 h-6 text-teal-600" />}
            title="No matching candidate profiles found"
            description="Try modifying search keywords or searching against all job categories."
          />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span>Found {results.length} matching candidates</span>
            <span>Sorted by Match Score</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((res) => {
              const c = res.candidate;
              const simPercent = Math.round((res.similarity || 0) * 100);

              const availabilityBadgeClass =
                c.availability === "AVAILABLE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : c.availability === "UNAVAILABLE"
                  ? "bg-slate-100 text-slate-600 border-slate-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {c.firstName} {c.lastName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${availabilityBadgeClass}`}
                          >
                            {c.availability}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{c.email || "No email"}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 text-xs font-mono font-bold">
                          <Sparkles className="w-3 h-3 text-teal-600" />
                          <span>{simPercent}% Match</span>
                        </span>
                      </div>
                    </div>

                    {c.currentRole && (
                      <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.currentRole}</span>
                      </div>
                    )}

                    {(c.city || c.province) && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 font-mono">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{[c.city, c.province].filter(Boolean).join(", ")}</span>
                      </div>
                    )}

                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.skills.slice(0, 6).map((s: any, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
                          >
                            {typeof s === "string" ? s : s.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {c.lastContactedAt && (
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Last contacted: {new Date(c.lastContactedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<PhoneCall className="w-3.5 h-3.5 text-slate-600" />}
                      onClick={() => handleOpenContactModal(c)}
                    >
                      Log Contact
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      disabled={c.availability === "UNAVAILABLE"}
                      onClick={() => handleOpenConsiderModal(c)}
                    >
                      Consider for Job
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-3">
          <Sparkles className="w-8 h-8 text-teal-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-900">Search Candidate Talent Pool</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Use the search bar above to find matching profiles across past applicants and pre-screened candidate records.
          </p>
        </div>
      )}

      {/* Record Contact Log Modal */}
      <Dialog
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title="Log Candidate Contact Outcome"
        description={`Record outreach notes for ${contactCandidateName}`}
        overflowVisible
      >
        <div className="space-y-4">
          <ComboBox
            label="Associated Job Requisition *"
            placeholder="Search target job opening..."
            value={contactJobId ? String(contactJobId) : ""}
            error={contactJobError || undefined}
            onChange={(val) => {
              setContactJobId(Number(val) || 0);
              if (contactJobError) setContactJobError(null);
            }}
            options={jobs.map((j) => ({
              value: String(j.id),
              label: j.title,
              subtitle: `REQ #${j.id} • ${j.location || "Philippines"}`,
              badge: j.status,
            }))}
            emptyText="No matching job openings found"
            required
          />
          <Select
            label="Candidate Response / Outcome *"
            value={contactOutcome}
            onChange={(e) => setContactOutcome(e.target.value)}
            options={[
              { value: "INTERESTED", label: "INTERESTED (Ready for Role)" },
              { value: "NOT_INTERESTED", label: "NOT INTERESTED (Declined)" },
              { value: "NO_RESPONSE", label: "NO RESPONSE (Unreachable)" },
              { value: "UNAVAILABLE", label: "UNAVAILABLE (Employed elsewhere)" },
            ]}
          />
          <Textarea
            label="Recruiter Outreach Notes"
            placeholder="Document phone conversation notes, availability window, salary expectations..."
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setContactModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={recordContactMutation.isPending}
              onClick={handleSaveContact}
            >
              Save Contact Record
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Consider / Reactivate Candidate for Job Modal */}
      <Dialog
        open={considerModalOpen}
        onClose={() => setConsiderModalOpen(false)}
        title="Consider Candidate for Job Requisition"
        description={
          considerCandidate
            ? `Reactivate ${considerCandidate.firstName} ${considerCandidate.lastName} into a new job application.`
            : "Reactivate talent pool candidate into an open requisition."
        }
        overflowVisible
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-slate-800">
              Candidate: {considerCandidate?.firstName} {considerCandidate?.lastName}
            </div>
            <div className="text-slate-500 font-mono">Email: {considerCandidate?.email}</div>
            {considerCandidate?.currentRole && (
              <div className="text-slate-600">Current Role: {considerCandidate.currentRole}</div>
            )}
          </div>

          <ComboBox
            label="Target Job Requisition *"
            placeholder="Search target job requisition..."
            value={considerJobId ? String(considerJobId) : ""}
            error={considerJobError || undefined}
            onChange={(val) => {
              setConsiderJobId(Number(val) || 0);
              if (considerJobError) setConsiderJobError(null);
            }}
            options={jobs.map((j) => ({
              value: String(j.id),
              label: j.title,
              subtitle: `REQ #${j.id} • ${j.location || "Philippines"}`,
              badge: j.status,
            }))}
            emptyText="No matching job requisitions found"
            required
          />

          <Select
            label="Contact Outcome Initial State"
            value={considerOutcome}
            onChange={(e) => setConsiderOutcome(e.target.value as any)}
            options={[
              { value: "INTERESTED", label: "INTERESTED (Candidate Confirmed Interest)" },
              { value: "NO_RESPONSE", label: "NO RESPONSE (Attempting Initial Outreach)" },
            ]}
          />

          <Textarea
            label="Recruiter Reactivation Notes"
            placeholder="Document why this talent pool candidate is being considered for this specific requisition..."
            value={considerNotes}
            onChange={(e) => setConsiderNotes(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setConsiderModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={considerCandidateMutation.isPending}
              onClick={handleConfirmConsider}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Reactivate & Apply Candidate
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
