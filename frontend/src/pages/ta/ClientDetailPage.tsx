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
import { ComboBox } from "../../components/ui/ComboBox";
import { formatDate } from "../../lib/utils";
import {
  PHILIPPINE_REGIONS_AND_PROVINCES,
  getCitiesForProvince,
} from "../../lib/geo-data";
import {
  ArrowLeft,
  Edit,
  Plus,
  MapPin,
} from "lucide-react";
import { notify } from "../../lib/feedback";

export const ClientDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { clientId } = useParams({ strict: false }) as { clientId: string };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTradeName, setEditTradeName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["ta", "clients"] });
      setEditModalOpen(false);
      notify.success("Client Updated", "Client profile details saved successfully.");
    },
    onError: (err: any) => {
      notify.error("Update Failed", err);
    },
  });

  const client = clientQuery.data;
  const mrfs = mrfsQuery.data || [];
  const deployments = deploymentsQuery.data || [];

  React.useEffect(() => {
    if (client) {
      setEditName(client.name || "");
      setEditTradeName(client.tradeName || "");
      setEditIndustry(client.industry || "");
      setEditContactName(client.contactName || "");
      setEditContactEmail(client.contactEmail || "");
      setEditContactPhone(client.contactPhone || "");
      setEditStreet(client.street || "");
      setEditProvince(client.province || "");
      setEditCity(client.city || "");
      setEditPostalCode(client.postalCode || "");
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500">
            Corporate Information
          </h3>
          {client.tradeName && (
            <span className="text-xs font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold">
              Brand: {client.tradeName}
            </span>
          )}
        </div>
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
        {(client.street || client.city || client.province || client.address) && (
          <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-mono text-[10px] uppercase text-slate-400 block">Facility / Registered Address</span>
              <span>
                {client.street || client.city || client.province
                  ? [client.street, client.city, client.province, client.postalCode].filter(Boolean).join(", ")
                  : client.address}
              </span>
            </div>
          </div>
        )}
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
              tradeName: editTradeName || undefined,
              industry: editIndustry || undefined,
              contactName: editContactName || undefined,
              contactEmail: editContactEmail || undefined,
              contactPhone: editContactPhone || undefined,
              street: editStreet || undefined,
              province: editProvince || undefined,
              city: editCity || undefined,
              postalCode: editPostalCode || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Registered Legal Corporate Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label="Trade Name / Operating Brand"
              placeholder="e.g. Acme Logistics"
              value={editTradeName}
              onChange={(e) => setEditTradeName(e.target.value)}
            />
          </div>
          <Input
            label="Industry / Sector"
            value={editIndustry}
            onChange={(e) => setEditIndustry(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            label="Official Contact Email"
            type="email"
            value={editContactEmail}
            onChange={(e) => setEditContactEmail(e.target.value)}
          />

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Facility / Corporate Address
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ComboBox
                label="Province / Region"
                placeholder="Select or enter province..."
                value={editProvince}
                onChange={(val) => {
                  setEditProvince(val);
                  setEditCity("");
                }}
                options={PHILIPPINE_REGIONS_AND_PROVINCES.map((p) => ({ value: p, label: p }))}
                allowCustom
              />
              <ComboBox
                label="City / Municipality"
                placeholder={editProvince ? "Select city..." : "Select province first"}
                value={editCity}
                onChange={setEditCity}
                options={getCitiesForProvince(editProvince).map((c) => ({ value: c, label: c }))}
                allowCustom
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Street / Building Address"
                  placeholder="e.g. Bldg 4, Light Industry Park"
                  value={editStreet}
                  onChange={(e) => setEditStreet(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Postal Code"
                  placeholder="e.g. 4027"
                  value={editPostalCode}
                  onChange={(e) => setEditPostalCode(e.target.value)}
                />
              </div>
            </div>
          </div>

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
