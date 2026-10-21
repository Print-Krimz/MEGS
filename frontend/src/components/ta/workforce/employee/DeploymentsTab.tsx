import React from "react";
import { Link } from "@tanstack/react-router";
import { StatusBadge } from "../../../common";
import { Button } from "../../../ui";
import type { Deployment } from "../../../../lib/types/employee.types";
import { formatDate } from "../../../../lib/utils";
import { SECTION_HEADING } from "./shared";

export interface DeploymentsTabProps {
  deployments: Deployment[];
  employeeStatus: string;
  employeeName: string;
}

export const DeploymentsTab: React.FC<DeploymentsTabProps> = ({ deployments, employeeStatus, employeeName }) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className={SECTION_HEADING}>Deployments ({deployments.length})</h2>
      <Link
        to="/ta/workforce"
        search={{ tab: "deployments", q: employeeName }}
        className="focus-ring inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-0"
      >
        View all deployments
      </Link>
    </div>
    {deployments.length === 0 ? (
      <p className="py-2 text-sm text-slate-600">No deployments yet.</p>
    ) : (
      <ul className="divide-y divide-slate-200">
        {deployments.map((dep) => (
          <li key={dep.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-900">{dep.client?.name || "Client"}</p>
              <p className="text-sm text-slate-600">
                {dep.site || "Client site"} · {dep.contractStart ? formatDate(dep.contractStart) : "Not set"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "open"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={dep.status} employeeStatus={employeeStatus} type="deployment" />
              <Button asChild variant="outline" size="sm">
                <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
                  View deployment
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);
