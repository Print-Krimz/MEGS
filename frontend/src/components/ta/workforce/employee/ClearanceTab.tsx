import React from "react";
import { ActionMenu, DataTable, type DataTableColumn } from "../../../common";
import { Button } from "../../../ui";
import {
  DocumentVersions,
  FollowUpTarget,
  RequirementBadge,
  SECTION_HEADING,
  ValidityBadge,
  ValidityDates,
  type VaultRequirement,
} from "./shared";

export interface ClearanceTabProps {
  compliance: VaultRequirement[];
  onPreview: (doc: { id: number; title: string }) => void;
  onReview: (req: VaultRequirement) => void;
  onRecordValidity: (req: VaultRequirement) => void;
  onRequestUpdate: (req: VaultRequirement) => void;
}

/** Documents that still need action, then the ones already verified. */
export const ClearanceTab: React.FC<ClearanceTabProps> = ({ compliance, onPreview, onReview, onRecordValidity, onRequestUpdate }) => {
  const verifiedItems = compliance.filter((req) => req.reviewStatus === "APPROVED");
  const followUpItems = compliance.filter((req) => req.reviewStatus !== "APPROVED");

  const documentActions = (req: VaultRequirement) => (
    <div className="flex items-center justify-end gap-2">
      {req.reviewStatus === "SUBMITTED" && (
        <Button variant="primary" size="sm" onClick={() => onReview(req)}>
          Review
        </Button>
      )}
      {req.documentId ? (
        <Button variant="outline" size="sm" onClick={() => onPreview({ id: req.documentId, title: req.documentLabel })}>
          View
        </Button>
      ) : (
        req.reviewStatus !== "SUBMITTED" && <span className="text-sm text-slate-600">Waiting for upload</span>
      )}
    </div>
  );

  const verifiedMenu = (req: VaultRequirement) => (
    <ActionMenu
      label={`More actions for ${req.documentLabel}`}
      items={[
        { label: "Record validity", onSelect: () => onRecordValidity(req) },
        { label: "Request updated copy", onSelect: () => onRequestUpdate(req) },
      ]}
    />
  );

  const followUpColumns: DataTableColumn<VaultRequirement>[] = [
    { key: "document", header: "Document", cell: (req) => <span className="font-medium text-slate-900">{req.documentLabel}</span> },
    { key: "target", header: "Target date", cell: (req) => <FollowUpTarget req={req} /> },
    { key: "status", header: "Status", cell: (req) => <RequirementBadge status={req.reviewStatus} /> },
    { key: "action", header: "Action", align: "right", cell: documentActions },
  ];

  const verifiedColumns: DataTableColumn<VaultRequirement>[] = [
    {
      key: "document",
      header: "Document",
      cell: (req) => (
        <div>
          <div className="font-medium text-slate-900">{req.documentLabel}</div>
          <DocumentVersions req={req} onPreview={onPreview} />
        </div>
      ),
    },
    { key: "client", header: "Client", hideBelow: "md", cell: (req) => req.clientName || "—" },
    { key: "dates", header: "Issued and expiry", cell: (req) => <ValidityDates req={req} /> },
    { key: "status", header: "Status", cell: (req) => <ValidityBadge req={req} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (req) => (
        <div className="flex items-center justify-end gap-2">
          {req.documentId && (
            <Button variant="outline" size="sm" onClick={() => onPreview({ id: req.documentId, title: req.documentLabel })}>
              View
            </Button>
          )}
          {verifiedMenu(req)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={SECTION_HEADING}>Clearance vault</h2>
        <span className="text-sm text-slate-700">
          {verifiedItems.length} of {compliance.length} verified
        </span>
      </div>

      {compliance.length === 0 ? (
        <p className="py-2 text-sm text-slate-600">No compliance documents attached.</p>
      ) : (
        <div className="space-y-6">
          {followUpItems.length > 0 && (
            <section className="space-y-3" aria-labelledby="emp-followup-heading">
              <h3 id="emp-followup-heading" className="text-sm font-semibold text-slate-900">Pending follow-up items</h3>
              <DataTable
                caption="Pending follow-up items"
                columns={followUpColumns}
                rows={followUpItems}
                getRowId={(req) => String(req.id)}
                density="compact"
                renderCard={(req) => (
                  <article className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-words font-medium text-slate-900">{req.documentLabel}</p>
                      <RequirementBadge status={req.reviewStatus} />
                    </div>
                    <p className="text-sm text-slate-600">Target date: <FollowUpTarget req={req} /></p>
                    <div className="pt-1">{documentActions(req)}</div>
                  </article>
                )}
              />
            </section>
          )}

          <section className="space-y-3" aria-labelledby="emp-verified-heading">
            <h3 id="emp-verified-heading" className="text-sm font-semibold text-slate-900">Verified documents</h3>
            {verifiedItems.length === 0 ? (
              <p className="py-1 text-sm text-slate-600">No verified documents on record yet.</p>
            ) : (
              <DataTable
                caption="Verified documents"
                columns={verifiedColumns}
                rows={verifiedItems}
                getRowId={(req) => String(req.id)}
                density="compact"
                renderCard={(req) => (
                  <article className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-slate-900">{req.documentLabel}</p>
                        {req.clientName && <p className="text-sm text-slate-600">{req.clientName}</p>}
                      </div>
                      <ValidityBadge req={req} />
                    </div>
                    <div className="text-sm text-slate-700"><ValidityDates req={req} /></div>
                    <DocumentVersions req={req} onPreview={onPreview} />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {req.documentId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => onPreview({ id: req.documentId, title: req.documentLabel })}
                        >
                          View
                        </Button>
                      )}
                      {verifiedMenu(req)}
                    </div>
                  </article>
                )}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
};
