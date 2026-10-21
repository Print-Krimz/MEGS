import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import { TalentPoolCandidate } from "../../lib/types/ta.types";
import { SendInvitationModal } from "../../components/ta/SendInvitationModal";
import { InvitationsTrackerDrawer } from "../../components/ta/InvitationsTrackerDrawer";
import { PoolCandidateCard } from "../../components/ta/PoolCandidateCard";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";

const SEARCH_LIMIT = 20;

const CONTACT_OUTCOME_OPTIONS = [
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "NO_RESPONSE", label: "No response" },
  { value: "UNAVAILABLE", label: "Unavailable (working elsewhere)" },
];

export const TalentPoolPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // The search lives in the address (?q= or ?jobId=) so a refresh or a shared link shows the same results.
  const urlSearch = useSearch({ strict: false }) as { q?: string | number; jobId?: string | number };
  const urlText = urlSearch?.q !== undefined ? String(urlSearch.q) : "";
  const urlJobId = Number(urlSearch?.jobId) || 0;

  const [searchText, setSearchText] = useState(urlJobId ? "" : urlText);
  const [selectedJobId, setSelectedJobId] = useState<number>(urlJobId);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Contact Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMembershipId, setContactMembershipId] = useState<number>(0);
  const [contactCandidateName, setContactCandidateName] = useState("");
  const [contactOutcome, setContactOutcome] = useState("INTERESTED");
  const [contactNotes, setContactNotes] = useState("");
  const [contactJobId, setContactJobId] = useState<number>(0);
  const [contactJobError, setContactJobError] = useState<string | null>(null);

  // Invitation Modal & Tracker Drawer State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [trackerDrawerOpen, setTrackerDrawerOpen] = useState(false);
  const [candidateToInvite, setCandidateToInvite] = useState<TalentPoolCandidate | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown"],
    queryFn: ({ signal }) => taApi.listJobs(undefined, { signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const searchMutation = useMutation({
    mutationFn: taApi.searchTalentPool,
  });

  const sendInvitationMutation = useMutation({
    mutationFn: taApi.sendTalentPoolInvitation,
    onSuccess: () => {
      setInviteModalOpen(false);
      setCandidateToInvite(null);
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      notify.success("Invitation sent", "The candidate is notified in the app and by email.");
    },
    onError: (err: any) => {
      notify.error("Unable to send invitation", err);
    },
  });

  const recordContactMutation = useMutation({
    mutationFn: taApi.recordContact,
    onSuccess: () => {
      setContactModalOpen(false);
      setContactNotes("");
      setContactJobError(null);
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool"] });
      notify.success("Contact saved", "The outreach was added to the candidate's record.");
    },
    onError: (err: any) => {
      notify.error("Unable to save contact", err);
    },
  });

  const writeUrl = (text: string, jobId: number) => {
    navigate({
      to: "/ta/talent-pool",
      search: (jobId ? { jobId } : text ? { q: text } : {}) as never,
      replace: true,
    });
  };

  // A job search ranks by match score; a word search by profile similarity. One at a time.
  const runSearch = (text: string, jobId: number) =>
    searchMutation.mutate(jobId ? { jobId, k: SEARCH_LIMIT } : { text, k: SEARCH_LIMIT });

  // Opened from a link or refreshed with a search in the address: run it once.
  const ranFromUrl = useRef(false);
  useEffect(() => {
    if (ranFromUrl.current) return;
    ranFromUrl.current = true;
    if (urlJobId) runSearch(urlJobId ? "" : urlText, urlJobId);
    else if (urlText.trim().length >= 2) runSearch(urlText.trim(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchText.trim();
    if (!selectedJobId) {
      if (!query) {
        setValidationError("Enter at least 2 characters or choose a job opening.");
        return;
      }
      if (query.length < 2) {
        setValidationError("Search must be at least 2 characters long.");
        return;
      }
    }
    setValidationError(null);
    writeUrl(query, selectedJobId);
    runSearch(query, selectedJobId);
  };

  const handleReset = () => {
    setSearchText("");
    setSelectedJobId(0);
    setValidationError(null);
    searchMutation.reset();
    writeUrl("", 0);
  };

  const jobs = jobsQuery.data || [];
  const results = searchMutation.data?.items ?? [];
  const unsearchablePoolCount = searchMutation.data?.unsearchableCount ?? 0;

  const handleOpenContactModal = (c: TalentPoolCandidate) => {
    setContactMembershipId(c.membershipId || c.applicantProfileId || 0);
    setContactCandidateName(`${c.firstName} ${c.lastName}`);
    // Only the job the TA is comparing against is suggested. Otherwise the job stays empty and must be chosen.
    setContactJobId(selectedJobId || 0);
    setContactOutcome("INTERESTED");
    setContactNotes("");
    setContactJobError(null);
    setContactModalOpen(true);
  };

  const handleSaveContact = () => {
    if (!contactJobId || contactJobId <= 0) {
      setContactJobError("Choose a job opening for this contact record.");
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

  const jobOptions = jobs.map((j) => ({
    value: String(j.id),
    label: j.title,
    subtitle: j.location || "Philippines",
    badge: j.status ? j.status.charAt(0) + j.status.slice(1).toLowerCase() : undefined,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={TA_COPY.pageTitles.candidatePool}
        description="Find past applicants and available candidates by skills and experience."
        breadcrumbs={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
          { label: TA_COPY.navigation.candidatePool },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => setTrackerDrawerOpen(true)}>
            {TA_COPY.invitations.sent}
          </Button>
        }
      />

      <form onSubmit={handleSearch} className="space-y-4 rounded-md border border-slate-300 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-7">
            <Input
              label="Search skills, keywords, or qualifications"
              placeholder="e.g. Electrician with TESDA NC II, industrial machinery repair, Laguna area"
              value={searchText}
              disabled={selectedJobId > 0}
              helperText={selectedJobId > 0 ? "Clear the job opening to search by words." : undefined}
              error={validationError || undefined}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="sm:col-span-5">
            <ComboBox
              label="Compare with a job opening (optional)"
              placeholder="Search job openings"
              value={selectedJobId ? String(selectedJobId) : ""}
              onChange={(val) => {
                setSelectedJobId(Number(val) || 0);
                if (validationError) setValidationError(null);
              }}
              options={[{ value: "", label: "No job opening (search by words)" }, ...jobOptions]}
              clearable={Boolean(selectedJobId)}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {(searchText || selectedJobId > 0 || searchMutation.isSuccess || searchMutation.isError) && (
            <Button variant="outline" size="sm" type="button" onClick={handleReset} className="w-full sm:w-auto">
              Clear filters
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={searchMutation.isPending}
            className="w-full sm:w-auto"
          >
            Search candidate pool
          </Button>
        </div>
      </form>

      {/* Results View */}
      {searchMutation.isPending ? (
        <LoadingState variant="cards" />
      ) : searchMutation.isError ? (
        <ErrorState
          subject="candidate pool results"
          error={searchMutation.error}
          onRetry={() => {
            if (searchText.trim().length >= 2 || selectedJobId > 0) runSearch(searchText.trim(), selectedJobId);
            else searchMutation.reset();
          }}
        />
      ) : searchMutation.isSuccess && results.length === 0 ? (
        <EmptyState
          title="No matching candidate profiles found"
          description={
            unsearchablePoolCount > 0
              ? `${plural(unsearchablePoolCount, "pool member")} can't be searched yet because ${unsearchablePoolCount === 1 ? "their profile is" : "their profiles are"} still being prepared. Try again later.`
              : "Try different keywords, or compare with a job opening."
          }
        />
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              {plural(results.length, "candidate")} found
              {results.length >= SEARCH_LIMIT ? ` (showing the top ${SEARCH_LIMIT})` : ""}
            </span>
            <span>{searchMutation.variables?.jobId ? "Sorted by match score" : "Sorted by profile similarity"}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.map((res) => {
              const c = res.candidate;
              const unavailable = c.availability === "UNAVAILABLE";

              return (
                <PoolCandidateCard
                  key={c.id}
                  result={res}
                  actions={
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleOpenContactModal(c)}>
                        Log contact
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={unavailable}
                        title={unavailable ? "This candidate is marked unavailable" : undefined}
                        onClick={() => {
                          setCandidateToInvite(c);
                          setInviteModalOpen(true);
                        }}
                      >
                        {TA_COPY.invitations.inviteToApply}
                      </Button>
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Search the candidate pool"
          description="Enter skills or keywords, or compare the pool with a job opening, then choose Search."
        />
      )}

      {/* Record Contact Log Modal */}
      <Dialog
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title="Log candidate contact"
        description={`Record outreach notes for ${contactCandidateName}`}
        overflowVisible
      >
        <div className="space-y-4">
          <ComboBox
            label="Job opening"
            placeholder="Search job openings"
            value={contactJobId ? String(contactJobId) : ""}
            error={contactJobError || undefined}
            onChange={(val) => {
              setContactJobId(Number(val) || 0);
              if (contactJobError) setContactJobError(null);
            }}
            options={jobOptions}
            emptyText="No matching job openings found"
            required
          />
          <Select
            label="Candidate response"
            value={contactOutcome}
            onChange={(e) => setContactOutcome(e.target.value)}
            options={CONTACT_OUTCOME_OPTIONS}
          />
          <Textarea
            label="Contact notes"
            placeholder="Phone conversation notes, availability window, salary expectations..."
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setContactModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={recordContactMutation.isPending}
              onClick={handleSaveContact}
            >
              Save contact
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Send Job Invitation Modal */}
      <SendInvitationModal
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setCandidateToInvite(null);
        }}
        candidate={candidateToInvite}
        targetJobId={selectedJobId > 0 ? selectedJobId : undefined}
        targetJobTitle={jobs.find((j) => j.id === selectedJobId)?.title}
        jobs={jobs}
        onSend={(payload) => sendInvitationMutation.mutate(payload)}
        loading={sendInvitationMutation.isPending}
      />

      {/* Sent invitations drawer */}
      <InvitationsTrackerDrawer
        open={trackerDrawerOpen}
        onClose={() => setTrackerDrawerOpen(false)}
        jobPostingId={selectedJobId > 0 ? selectedJobId : undefined}
      />
    </div>
  );
};
