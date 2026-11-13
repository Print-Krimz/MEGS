import React, { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { Button, Select } from "../ui";
import { notify } from "../../lib/feedback";

interface AssignmentPanelProps {
  mrfId: number;
  mrfOwnerId: string | null;
  clientId: number;
  clientName: string;
  clientOwnerId: string | null;
}

const NONE = "";

/**
 * Admin only. Who owns a request, and who owns its client by default. A request's job openings, candidates and
 * placements follow its owner, so moving the request moves all of them.
 */
export const AssignmentPanel: React.FC<AssignmentPanelProps> = ({ mrfId, mrfOwnerId, clientId, clientName, clientOwnerId }) => {
  const queryClient = useQueryClient();
  const [mrfOwner, setMrfOwner] = useState(mrfOwnerId ?? NONE);
  const [clientOwner, setClientOwner] = useState(clientOwnerId ?? NONE);

  useEffect(() => setMrfOwner(mrfOwnerId ?? NONE), [mrfOwnerId]);
  useEffect(() => setClientOwner(clientOwnerId ?? NONE), [clientOwnerId]);

  const optionsQuery = useQuery({
    queryKey: ["admin", "analytics", "filters"],
    queryFn: () => adminApi.getFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const recruiters = optionsQuery.data?.recruiters ?? [];
  const selectOptions = [{ value: NONE, label: "No recruiter" }, ...recruiters.map((r) => ({ value: r.id, label: r.name === r.email ? r.name : `${r.name} (${r.email})` }))];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "mrf", String(mrfId)] });
    queryClient.invalidateQueries({ queryKey: ["admin", "mrf", mrfId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "mrf", String(mrfId)] });
    queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
  };

  const mrfMutation = useMutation({
    mutationFn: () => adminApi.assignMrf(mrfId, mrfOwner || null),
    onSuccess: () => {
      notify.success("Request owner updated", "Its job openings, candidates and placements now belong to the new owner.");
      refresh();
    },
    onError: (error: Error) => notify.error("Could not change the owner", error.message),
  });

  const clientMutation = useMutation({
    mutationFn: () => adminApi.assignClient(clientId, clientOwner || null),
    onSuccess: () => {
      notify.success("Client owner updated", "New requests for this client start with this recruiter.");
      refresh();
    },
    onError: (error: Error) => notify.error("Could not change the owner", error.message),
  });

  const mrfHelpId = useId();
  const clientHelpId = useId();

  return (
    <section aria-label="Ownership" className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <h3 className="text-xs font-medium text-slate-600">Ownership</h3>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-end gap-2">
            <Select
              label="Request owner"
              aria-describedby={mrfHelpId}
              value={mrfOwner}
              onChange={(e) => setMrfOwner(e.target.value)}
              options={selectOptions}
              disabled={optionsQuery.isLoading}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="primary"
              className="md:min-h-10"
              onClick={() => mrfMutation.mutate()}
              disabled={mrfOwner === (mrfOwnerId ?? NONE) || mrfMutation.isPending}
            >
              Save
            </Button>
          </div>
          <p id={mrfHelpId} className="mt-1.5 text-xs text-slate-500">
            Its openings, candidates and placements follow this recruiter.
          </p>
        </div>
        <div>
          <div className="flex items-end gap-2">
            <Select
              label={`Client owner (${clientName})`}
              aria-describedby={clientHelpId}
              value={clientOwner}
              onChange={(e) => setClientOwner(e.target.value)}
              options={selectOptions}
              disabled={optionsQuery.isLoading}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="primary"
              className="md:min-h-10"
              onClick={() => clientMutation.mutate()}
              disabled={clientOwner === (clientOwnerId ?? NONE) || clientMutation.isPending}
            >
              Save
            </Button>
          </div>
          <p id={clientHelpId} className="mt-1.5 text-xs text-slate-500">
            The default owner for new requests from this client.
          </p>
        </div>
      </div>
    </section>
  );
};
