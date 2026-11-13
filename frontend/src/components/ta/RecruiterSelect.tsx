import React from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { useRecordBase } from "../../hooks/useRecordBase";
import { Select } from "../ui";
import { notify } from "../../lib/feedback";

/**
 * Admin only. Picks the recruiter a new client or request starts with. Records made by the team leader are
 * invisible to recruiters until someone owns them, so the form offers this choice up front.
 */
export const RecruiterSelect: React.FC<{
  value: string;
  onChange: (recruiterId: string) => void;
  id?: string;
}> = ({ value, onChange, id }) => {
  const isAdmin = useRecordBase() === "/admin";
  const optionsQuery = useQuery({
    queryKey: ["admin", "analytics", "filters"],
    queryFn: () => adminApi.getFilterOptions(),
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
  });
  if (!isAdmin) return null;
  const recruiters = optionsQuery.data?.recruiters ?? [];
  const options = [
    { value: "", label: "No recruiter" },
    ...recruiters.map((r) => ({ value: r.id, label: r.name === r.email ? r.name : `${r.name} (${r.email})` })),
  ];
  return (
    <Select
      id={id}
      label="Recruiter (optional)"
      helperText="Recruiters only see records assigned to them."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      disabled={optionsQuery.isLoading}
    />
  );
};

/** Hands a record the team leader just created to the chosen recruiter. The record stays saved if this fails. */
export async function assignAfterCreate(kind: "client" | "request", id: number | string, recruiterId: string): Promise<void> {
  if (!recruiterId) return;
  try {
    if (kind === "client") await adminApi.assignClient(id, recruiterId);
    else await adminApi.assignMrf(id, recruiterId);
  } catch (error) {
    notify.error(
      kind === "client" ? "Client added, but no recruiter was set" : "Request created, but no recruiter was set",
      "Open the record and choose the recruiter from the Ownership panel.",
    );
  }
}
