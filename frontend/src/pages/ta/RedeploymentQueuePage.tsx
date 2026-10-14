import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, EmptyState, Pagination } from "../../components/common";
import { Button, ComboBox, Dialog, Input, Textarea } from "../../components/ui";
import { employeesApi, type RedeploymentQueueResponse } from "../../lib/api/employees.api";
import { taApi } from "../../lib/api/ta.api";
import { formatDate, getApplicationStatusMeta } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";

type Row = RedeploymentQueueResponse["items"][number];

export const RedeploymentQueuePage: React.FC = () => {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [assignmentTarget, setAssignmentTarget] = useState<Row | null>(null);
  const [targetJobId, setTargetJobId] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  const query = useQuery({
    queryKey: ["ta", "redeployment-queue"],
    queryFn: employeesApi.getRedeploymentQueue,
  });

  const openJobsQuery = useQuery({
    queryKey: ["ta", "redeployment-open-jobs"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const assignRole = useMutation({
    mutationFn: () =>
      taApi.sendTalentPoolInvitation({
        applicantProfileId: assignmentTarget!.applicantProfileId!,
        targetJobId: Number(targetJobId),
        message: assignmentMessage.trim() || undefined,
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      setAssignmentTarget(null);
      setTargetJobId("");
      setAssignmentMessage("");
      notify.success(
        "Assignment sent",
        "The worker can review and accept the open role from their portal."
      );
    },
    onError: (error: any) =>
      notify.error("Assignment failed", error?.message || error),
  });

  if (query.isLoading) return <LoadingState variant="table" rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const items = (query.data?.items || []).filter((row) =>
    `${row.name} ${row.employeeNumber} ${row.previousClient || ""} ${row.previousRole || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const pages = Math.max(1, Math.ceil(items.length / 10));

  return (
    <div className="space-y-4">
      <Input
        label="Search redeployment queue"
        placeholder="Employee, previous client, or role"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {!items.length ? (
        <EmptyState
          title="No workers waiting for redeployment"
          description="Workers who confirm they want another assignment will appear here after their previous placement ends."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
              <tr>
                {["Employee", "Previous placement", "Available since", "Next action", "Actions"].map(
                  (label) => (
                    <th key={label} className="p-3">
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.slice((page - 1) * 10, page * 10).map((row) => (
                <tr key={row.id}>
                  <td className="p-3">
                    <Link
                      className="font-semibold hover:underline"
                      to="/ta/employees/$employeeId"
                      params={{ employeeId: String(row.id) }}
                    >
                      {row.name}
                    </Link>
                    <div className="mt-1 text-slate-500">{row.employeeNumber}</div>
                  </td>
                  <td className="p-3">
                    {row.previousClient || "Not recorded"}
                    <div className="mt-1 text-slate-500">{row.previousRole || "Role not recorded"}</div>
                  </td>
                  <td className="p-3">
                    {row.availableAt ? formatDate(row.availableAt) : "Not recorded"}
                  </td>
                  <td className="p-3">
                    <div>{row.nextAction}</div>
                    {row.applications.map((application) => (
                      <Link
                        key={application.id}
                        className="mt-1 block text-teal-700 hover:underline"
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(application.id) }}
                      >
                        {application.client || application.title} ·{" "}
                        {getApplicationStatusMeta(application.status).label}
                      </Link>
                    ))}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssignmentTarget(row);
                          setTargetJobId("");
                          setAssignmentMessage("");
                        }}
                      >
                        Assign to Open Role
                      </Button>
                      <Link
                        className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                        to="/ta/employees/$employeeId"
                        params={{ employeeId: String(row.id) }}
                      >
                        View 201
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length > 10 && (
        <Pagination
          currentPage={page}
          totalPages={pages}
          onPageChange={setPage}
          totalItems={items.length}
          pageSize={10}
        />
      )}
      <Dialog
        open={Boolean(assignmentTarget)}
        onClose={() => setAssignmentTarget(null)}
        title="Assign to open role"
        description={`Select an open job requisition to invite or assign ${assignmentTarget?.name}.`}
        overflowVisible
      >
        <div className="space-y-4">
          {!assignmentTarget?.applicantProfileId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              This employee does not have an applicant profile linked to their account and cannot be invited directly.
            </div>
          )}
          <ComboBox
            label="Open Job Requisition"
            placeholder="Select an open job..."
            loading={openJobsQuery.isLoading}
            loadingText="Loading open jobs..."
            value={targetJobId}
            onChange={(val) => setTargetJobId(val)}
            options={(openJobsQuery.data || []).map((job) => ({
              value: String(job.id),
              label: job.title,
              subtitle: `${job.mrf?.client?.name || "General Client"} • ${job.location || "On-site"}`,
            }))}
            disabled={openJobsQuery.isError}
            error={openJobsQuery.isError ? "Failed to load open jobs. Please try again." : undefined}
          />
          <Textarea
            label="Invitation Message (Optional)"
            placeholder="Add an optional note or assignment details for the worker..."
            value={assignmentMessage}
            onChange={(event) => setAssignmentMessage(event.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignmentTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={assignRole.isPending}
              disabled={!targetJobId || !assignmentTarget?.applicantProfileId}
              onClick={() => assignRole.mutate()}
            >
              Send opportunity
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
