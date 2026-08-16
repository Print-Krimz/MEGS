import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Dialog, Input } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  ArrowLeft,
  Edit,
  Plus,
} from "lucide-react";

export const ClientDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { clientId } = useParams({ strict: false }) as { clientId: string };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const clientQuery = useQuery({
    queryKey: ["ta", "client", clientId],
    queryFn: () => taApi.getClientDetails(clientId),
    enabled: Boolean(clientId),
  });

  const mrfsQuery = useQuery({
    queryKey: ["ta", "mrfs", { clientId }],
    queryFn: () => taApi.listMRFs({ clientId }),
    enabled: Boolean(clientId),
  });

  const deploymentsQuery = useQuery({
    queryKey: ["ta", "deployments", { clientId }],
    queryFn: () => taApi.listDeployments({ clientId }),
    enabled: Boolean(clientId),
  });

  const updateClientMutation = useMutation({
    mutationFn: (data: any) => taApi.updateClient(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "client", clientId] });
      setEditModalOpen(false);
    },
  });

  const client = clientQuery.data;
  const mrfs = mrfsQuery.data || [];
  const deployments = deploymentsQuery.data || [];

  React.useEffect(() => {
    if (client) {
      setEditName(client.name);
      setEditIndustry(client.industry || "");
      setEditContactName(client.contactName || "");
      setEditContactEmail(client.contactEmail || "");
      setEditContactPhone(client.contactPhone || "");
      setEditAddress(client.address || "");
    }
  }, [client]);

  if (clientQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Client Account Details" description="Loading client data..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (clientQuery.isError || !client) {
    return (
      <div className="space-y-6">
        <PageHeader title="Client Account Details" description="Account details" />
        <ErrorState error={clientQuery.error} onRetry={() => clientQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={`Client Account #${client.id} • Registered ${formatDate(client.createdAt)}`}
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Clients", href: "/ta/clients" },
          { label: client.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/clients">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Clients
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => setEditModalOpen(true)}
            >
              Edit Account
            </Button>
            <Link to="/ta/mrfs/create">
              <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Create MRF Order
              </Button>
            </Link>
          </div>
        }
      />

      {/* Account Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
          Corporate Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-mono block">Industry Sector</span>
            <span className="font-semibold text-slate-900">{client.industry || "General Commercial"}</span>
          </div>
          <div>
            <span className="text-slate-400 font-mono block">Contact Representative</span>
            <span className="font-semibold text-slate-900">{client.contactName || "N/A"}</span>
          </div>
          <div>
            <span className="text-slate-400 font-mono block">Email & Phone</span>
            <span className="text-slate-800 font-mono">
              {client.contactEmail || "No email"} {client.contactPhone ? `• ${client.contactPhone}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Active MRFs & Deployments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manpower Requests */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900">Manpower Orders ({mrfs.length})</h3>
              <p className="text-xs text-slate-500">Active labor requisitions for this client</p>
            </div>
            <Link to="/ta/mrfs/create">
              <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3 h-3" />}>
                New
              </Button>
            </Link>
          </div>

          {mrfs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No manpower requests placed by this client.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {mrfs.map((mrf) => (
                <div key={mrf.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{mrf.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {mrf.headcount} pax • Priority: {mrf.priority} • Status: {mrf.status}
                    </div>
                  </div>
                  <Link to="/ta/mrfs/$mrfId" params={{ mrfId: String(mrf.id) }}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Deployments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900">Active Site Deployments ({deployments.length})</h3>
              <p className="text-xs text-slate-500">Personnel currently dispatched on client sites</p>
            </div>
            <Link to="/ta/deployments">
              <Button variant="ghost" size="sm">
                All
              </Button>
            </Link>
          </div>

          {deployments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No active personnel deployments recorded for this client.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {deployments.map((dep) => (
                <div key={dep.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">
                      {dep.employee?.user?.applicantProfile?.firstName || "Employee"}{" "}
                      {dep.employee?.user?.applicantProfile?.lastName || ""}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Site: {dep.site || "General Facility"} • Status: {dep.status}
                    </div>
                  </div>
                  <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
                    <Button variant="outline" size="sm">
                      Deployment
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Client Modal */}
      <Dialog
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Client Information"
        description={`Update details for ${client.name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateClientMutation.mutate({
              name: editName,
              industry: editIndustry || undefined,
              contactName: editContactName || undefined,
              contactEmail: editContactEmail || undefined,
              contactPhone: editContactPhone || undefined,
              address: editAddress || undefined,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Client Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Industry"
            value={editIndustry}
            onChange={(e) => setEditIndustry(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              value={editContactName}
              onChange={(e) => setEditContactName(e.target.value)}
            />
            <Input
              label="Contact Phone"
              value={editContactPhone}
              onChange={(e) => setEditContactPhone(e.target.value)}
            />
          </div>
          <Input
            label="Contact Email"
            value={editContactEmail}
            onChange={(e) => setEditContactEmail(e.target.value)}
          />
          <Input
            label="Corporate Address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updateClientMutation.isPending}>
              Save Client
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
