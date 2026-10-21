import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, DocumentPreviewModal } from "../../components/common";
import { Button, Select } from "../../components/ui";
import { employeesApi, type EmployeeCredentialAlert } from "../../lib/api/employees.api";
import { formatDate } from "../../lib/utils";

const alertLabel: Record<EmployeeCredentialAlert["alertType"], string> = {
  REVIEW_REQUIRED: "Needs review",
  VALIDITY_UNKNOWN: "Validity not recorded",
  EXPIRED: "Expired",
  EXPIRING_SOON: "Expiring soon",
  UPDATE_OVERDUE: "Updated copy overdue",
};

export const EmployeeCredentialAlertsPage: React.FC = () => {
  const [filter, setFilter] = useState("ALL");
  const [preview, setPreview] = useState<{ id: number; title: string } | null>(null);
  const alertsQuery = useQuery({
    queryKey: ["ta", "employee-credential-alerts"],
    queryFn: employeesApi.getCredentialAlerts,
  });

  if (alertsQuery.isLoading) return <LoadingState variant="table" rows={5} />;
  if (alertsQuery.isError) return <ErrorState error={alertsQuery.error} onRetry={() => alertsQuery.refetch()} />;

  const alerts = alertsQuery.data || [];
  const visible = filter === "ALL" ? alerts : alerts.filter((item) => item.alertType === filter);
  if (alerts.length === 0) {
    return <EmptyState title="No document alerts" description="Required employee documents are current, or have not yet been reviewed." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">Review expiring, expired, or not-yet-verified employee documents.</p>
        <Select label="Show" value={filter} onChange={(event) => setFilter(event.target.value)} options={[
          { value: "ALL", label: `All alerts (${alerts.length})` },
          ...Object.entries(alertLabel).map(([value, label]) => ({ value, label })),
        ]} />
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No matching documents" description="Choose another alert type to see more records." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-xs font-medium text-slate-600">
              <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Client / role</th><th className="px-4 py-3">Validity</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((item) => (
                <tr key={item.requirementId}>
                  <td className="px-4 py-3">
                    <Link to="/ta/employees/$employeeId" params={{ employeeId: String(item.employeeId) }} className="focus-ring inline-flex font-semibold text-slate-900 hover:underline pointer-coarse:min-h-11 pointer-coarse:items-center">{item.employeeName}</Link>
                    <div className="mt-0.5 font-mono text-xs text-slate-600">{item.employeeNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.documentLabel}</div>
                    <div className="mt-0.5 text-slate-600">{alertLabel[item.alertType]}</div>
                    {item.updateRequestDeadline && <div className="mt-0.5 text-slate-600">Updated copy due {formatDate(item.updateRequestDeadline)}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{item.clientName}</div>
                    <div className="mt-0.5 text-slate-600">{item.jobTitle}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.issuedAt && <div>Issued {formatDate(item.issuedAt)}</div>}
                    {item.expiresAt ? <div>Expires {formatDate(item.expiresAt)}</div> : <div>Expiry not recorded</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {item.documentId && <Button variant="outline" size="sm" onClick={() => setPreview({ id: item.documentId!, title: item.documentLabel })}>View</Button>}
                      <Button asChild variant="outline" size="sm"><Link to="/ta/employees/$employeeId" params={{ employeeId: String(item.employeeId) }}>Open record</Link></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DocumentPreviewModal open={Boolean(preview)} documentId={preview?.id} title={preview?.title} onClose={() => setPreview(null)} />
    </div>
  );
};
