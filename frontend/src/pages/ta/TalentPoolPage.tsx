import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import {
  Sparkles,
  Search,
  PhoneCall,
  ArrowRight,
  MapPin,
} from "lucide-react";

export const TalentPoolPage: React.FC = () => {
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

  // Queries
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
      setFeedback({ type: "success", message: "Candidate contact outcome logged successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to log contact outcome: " + err.message });
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Talent Pool & Candidate Matching"
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
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-4 h-4 text-teal-600" />
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
            <Select
              label="Match Against Job (Optional)"
              value={selectedJobId}
              onChange={(e) => {
                setSelectedJobId(Number(e.target.value));
                if (validationError) setValidationError(null);
              }}
              options={[
                { value: 0, label: "All Job Categories (Keyword Search)" },
                ...jobs.map((j) => ({ value: j.id, label: j.title })),
              ]}
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

        <div className="flex justify-end gap-2 pt-2">
          {(searchText || selectedJobId > 0 || searchMutation.isSuccess || searchMutation.isError) && (
            <Button
              variant="outline"
              size="md"
              type="button"
              onClick={handleReset}
            >
              Clear Filter
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            type="submit"
            loading={searchMutation.isPending}
            leftIcon={<Search className="w-3.5 h-3.5" />}
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

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {c.firstName} {c.lastName}
                        </h4>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{c.user?.email || "No email"}</span>
                          {c.mobileNumber && <span>• {c.mobileNumber}</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 text-xs font-mono font-bold">
                          <Sparkles className="w-3 h-3 text-teal-600" />
                          <span>{simPercent}% Match</span>
                        </span>
                      </div>
                    </div>

                    {c.address && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 font-mono">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.city ? `${c.city}, ${c.province}` : c.address}</span>
                      </div>
                    )}

                    {c.professionalSummary && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {c.professionalSummary}
                      </p>
                    )}

                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.skills.slice(0, 5).map((s: any, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
                          >
                            {typeof s === "string" ? s : s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<PhoneCall className="w-3.5 h-3.5 text-slate-600" />}
                      onClick={() => {
                        setContactMembershipId(c.membershipId || c.applicantProfileId || 0);
                        setContactCandidateName(`${c.firstName} ${c.lastName}`);
                        setContactModalOpen(true);
                      }}
                    >
                      Log Contact
                    </Button>

                    <Link to="/ta/jobs">
                      <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Consider for Job
                      </Button>
                    </Link>
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
      >
        <div className="space-y-4">
          <Select
            label="Associated Job Requisition (Optional)"
            value={contactJobId}
            onChange={(e) => setContactJobId(Number(e.target.value))}
            options={[
              { value: 0, label: "General Re-engagement" },
              ...jobs.map((j) => ({ value: j.id, label: j.title })),
            ]}
          />
          <Select
            label="Candidate Response / Outcome"
            value={contactOutcome}
            onChange={(e) => setContactOutcome(e.target.value)}
            options={[
              { value: "INTERESTED", label: "INTERESTED (Ready for Interview)" },
              { value: "NOT_INTERESTED", label: "NOT INTERESTED (Declined)" },
              { value: "NO_RESPONSE", label: "NO RESPONSE (Unreachable)" },
              { value: "UNAVAILABLE", label: "UNAVAILABLE (Currently Employed elsewhere)" },
            ]}
          />
          <Textarea
            label="Recruiter Notes"
            placeholder="Document contact notes, phone conversation details..."
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
              onClick={() =>
                recordContactMutation.mutate({
                  membershipId: contactMembershipId,
                  jobPostingId: contactJobId,
                  outcome: contactOutcome,
                  notes: contactNotes || undefined,
                })
              }
            >
              Save Contact Record
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
