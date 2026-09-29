import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, Button, Input } from "../ui";
import { LoadingState, EmptyState, StatusBadge } from "../common";
import { formatDate } from "../../lib/utils";
import {
  Search,
  Copy,
  Building2,
  MapPin,
  Users,
  Calendar,
  Briefcase,
  X,
} from "lucide-react";
import { taApi } from "../../lib/api/ta.api";
import type { ManpowerRequest } from "../../lib/types/ta.types";

export interface CloneMRFModalProps {
  open: boolean;
  onClose: () => void;
  onSelectMRF: (mrf: ManpowerRequest, preserveClient: boolean) => void;
  currentClientId?: number;
  currentClientName?: string;
}

export const CloneMRFModal: React.FC<CloneMRFModalProps> = ({
  open,
  onClose,
  onSelectMRF,
  currentClientId,
  currentClientName,
}) => {
  const [search, setSearch] = useState("");
  const [preserveClient, setPreserveClient] = useState(true);

  // Reset search and preserveClient toggle whenever modal opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setPreserveClient(true);
    }
  }, [open]);

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs", "clone-list"],
    queryFn: () => taApi.listMRFs({ sortBy: "createdAt" }),
    enabled: open,
  });

  const mrfList: ManpowerRequest[] = useMemo(() => {
    return Array.isArray(mrfsQuery.data) ? mrfsQuery.data : [];
  }, [mrfsQuery.data]);

  const filteredMrfs = useMemo(() => {
    if (!search.trim()) return mrfList;

    const q = search.trim().toLowerCase();
    const rawIdQuery = q.replace(/^#/, "");

    return mrfList.filter((mrf) => {
      const idStr = String(mrf.id);
      const hashIdStr = `#${mrf.id}`.toLowerCase();
      const idMatch = idStr.includes(rawIdQuery) || hashIdStr.includes(q);
      const titleMatch = mrf.title.toLowerCase().includes(q);
      const clientName = (mrf.client?.name || `Client #${mrf.clientId}`).toLowerCase();
      const clientMatch = clientName.includes(q);

      return idMatch || titleMatch || clientMatch;
    });
  }, [mrfList, search]);

  const handleSelect = (mrf: ManpowerRequest) => {
    onSelectMRF(mrf, preserveClient);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Clone Past Manpower Request"
      description="Select a previous requisition to copy its job specifications, skills, and requirements."
      size="lg"
    >
      <div className="space-y-4">
        {/* Controls Bar: Search & Client Preservation Toggle */}
        <div className="space-y-2.5 pb-3 border-b border-slate-200">
          <Input
            type="text"
            placeholder="Search by ID (#12), job title, or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            rightIcon={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
            aria-label="Search past manpower requests"
          />

          {currentClientId ? (
            <div className="flex items-center gap-2 pt-0.5">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preserveClient}
                  onChange={(e) => setPreserveClient(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0B315D] focus:ring-[#0B315D] cursor-pointer"
                />
                <span>
                  Keep currently selected client ({currentClientName || `Client #${currentClientId}`})
                </span>
              </label>
            </div>
          ) : null}
        </div>

        {/* Content Area: Loading / Error / Empty / Card List */}
        {mrfsQuery.isLoading ? (
          <div className="py-4">
            <LoadingState variant="spinner" message="Loading previous manpower requests..." />
          </div>
        ) : mrfsQuery.isError ? (
          <div className="py-6 text-center bg-white border border-slate-200 rounded-lg p-5 space-y-2">
            <p className="text-sm text-rose-600 font-medium">Unable to load previous manpower requests.</p>
            <Button variant="outline" size="sm" onClick={() => mrfsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : filteredMrfs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-5 h-5 text-slate-400" />}
            title="No manpower requests found"
            description={
              search.trim()
                ? "No past requisitions match your search criteria. Try a different keyword or ID."
                : "There are no previous manpower requests available to clone."
            }
            action={
              search.trim() ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div
            className="max-h-[50vh] overflow-y-auto pr-1 space-y-3"
            tabIndex={0}
            aria-label="Past manpower requests list"
          >
            {filteredMrfs.map((mrf) => (
              <div
                key={mrf.id}
                className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 hover:border-teal-600 transition-colors shadow-xs"
                data-testid={`mrf-card-${mrf.id}`}
              >
                {/* Card Header: Title & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
                      #{mrf.id} - {mrf.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700 truncate">
                        {mrf.client?.name || `Client #${mrf.clientId}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={mrf.priority} type="priority" size="sm" />
                    <StatusBadge status={mrf.status} type="raw" size="sm" />
                  </div>
                </div>

                {/* Card Details: Location, Headcount, Created Date */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{mrf.location || "Location not specified"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{mrf.headcount} headcount</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatDate(mrf.createdAt)}</span>
                  </div>
                </div>

                {/* Skills Preview */}
                {mrf.requiredSkills?.trim() ? (
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200/60 rounded px-2.5 py-1.5">
                    <span className="font-semibold text-slate-700">Skills: </span>
                    <span className="line-clamp-2">{mrf.requiredSkills}</span>
                  </div>
                ) : null}

                {/* Action Footer: Employment Type & Clone Button */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {mrf.employmentType || "Standard Requisition"}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => handleSelect(mrf)}
                  >
                    Clone Specification
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {!mrfsQuery.isLoading && !mrfsQuery.isError
              ? `${filteredMrfs.length} ${filteredMrfs.length === 1 ? "request" : "requests"} found`
              : ""}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
