import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  StatusBadge,
} from "../../components/common";
import { Button, Dialog, Input, PhoneInput } from "../../components/ui";
import { ComboBox } from "../../components/ui/ComboBox";
import { formatDate } from "../../lib/utils";
import {
  PHILIPPINE_REGIONS_AND_PROVINCES,
  getCitiesForProvince,
} from "../../lib/geo-data";
import { PHILIPPINE_INDUSTRY_SECTORS } from "../../lib/industry-data";
import {
  ArrowLeft,
  Edit,
  Plus,
  MapPin,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY, formatPriority, formatTaStatus } from "../../lib/ta-copy";

export const ClientDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { clientId } = useParams({ strict: false }) as { clientId: string };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTradeName, setEditTradeName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editContactFirstName, setEditContactFirstName] = useState("");
  const [editContactLastName, setEditContactLastName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editEmailError, setEditEmailError] = useState<string | null>(null);
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editPostalCodeError, setEditPostalCodeError] = useState<string | null>(null);

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
      notify.success("Client updated", "The client details were saved.");
    },
    onError: (err: any) => {
      notify.error("Unable to update client", err);
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
      const nameParts = (client.contactName || "").trim().split(/\s+/);
      if (nameParts.length <= 1) {
        setEditContactFirstName(nameParts[0] || "");
        setEditContactLastName("");
      } else {
        setEditContactFirstName(nameParts.slice(0, -1).join(" "));
        setEditContactLastName(nameParts[nameParts.length - 1]);
      }
      setEditContactEmail(client.contactEmail || "");
      setEditEmailError(null);
      setEditContactPhone(client.contactPhone || "");
      setEditStreet(client.street || "");
      setEditProvince(client.province || "");
      setEditCity(client.city || "");
      setEditPostalCode(client.postalCode || "");
      setEditPostalCodeError(null);
    }
  }, [client]);

  if (clientQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Client details" description="Loading client information..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (clientQuery.isError || !client) {
    return (
      <div className="space-y-6">
        <PageHeader title="Client details" description="Account details" />
        <ErrorState error={clientQuery.error} onRetry={() => clientQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={`Client #${client.id} • Registered ${formatDate(client.createdAt)}`}
        meta={<StatusBadge status={client.isActive ? "Active client" : "Inactive"} type="raw" size="sm" />}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.clients, href: "/ta/clients" },
          { label: client.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/clients">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to clients
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => setEditModalOpen(true)}
            >
              Edit client
            </Button>
            <Link to="/ta/mrfs/create">
              <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Create manpower request
              </Button>
            </Link>
          </div>
        }
      />

      {/* Account Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500">
            Company information
          </h3>
          {client.tradeName && (
            <span className="text-xs font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold">
              Brand: {client.tradeName}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Industry</span>
            <span className="font-semibold text-slate-900">{client.industry || "General Commercial"}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Contact</span>
            <span className="font-semibold text-slate-900">{client.contactName || "N/A"}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Email and phone</span>
            <span className="text-slate-800 font-mono">
              {client.contactEmail || "No email"} {client.contactPhone ? `• ${client.contactPhone}` : ""}
            </span>
          </div>
        </div>
        {(client.street || client.city || client.province || client.address) && (
          <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-500 block">Facility address</span>
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
              <h3 className="text-sm font-bold text-slate-900">Manpower requests ({mrfs.length})</h3>
              <p className="text-xs text-slate-500">Staffing requests for this client</p>
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
                      {mrf.headcount} positions • Priority: {formatPriority(mrf.priority)} • {formatTaStatus(mrf.status)}
                    </div>
                  </div>
                  <Link to="/ta/mrfs/$mrfId" params={{ mrfId: String(mrf.id) }}>
                    <Button variant="outline" size="sm">
                      View request
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
              <h3 className="text-sm font-bold text-slate-900">Active site deployments ({deployments.length})</h3>
              <p className="text-xs text-slate-500">Personnel currently dispatched on client sites</p>
            </div>
            <Link to="/ta/workforce" search={{ tab: "deployments" }}>
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
                      Site: {dep.site || "General facility"} • {formatTaStatus(dep.status)}
                    </div>
                  </div>
                  <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
                    <Button variant="outline" size="sm">
                      View deployment
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
        onClose={() => {
          setEditModalOpen(false);
          setEditPostalCodeError(null);
          setEditEmailError(null);
        }}
        title="Edit client"
        description={`Update details for ${client.name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editName.trim()) return;
            if (editContactEmail.trim() && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(editContactEmail.trim())) {
              setEditEmailError("Official contact email must be a valid @gmail.com address");
              return;
            }
            if (editPostalCode.trim().length > 0 && editPostalCode.trim().length !== 4) {
              setEditPostalCodeError("Postal code must be exactly 4 digits");
              return;
            }
            const combinedName = [editContactFirstName.trim(), editContactLastName.trim()].filter(Boolean).join(" ");
            updateClientMutation.mutate({
              name: editName.trim(),
              tradeName: editTradeName.trim() || undefined,
              industry: editIndustry.trim() || undefined,
              contactName: combinedName || undefined,
              contactEmail: editContactEmail.trim() || undefined,
              contactPhone: editContactPhone.trim() || undefined,
              street: editStreet.trim() || undefined,
              province: editProvince.trim() || undefined,
              city: editCity.trim() || undefined,
              postalCode: editPostalCode.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Legal company name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label="Brand name (optional)"
              placeholder="e.g. Acme Logistics"
              value={editTradeName}
              onChange={(e) => setEditTradeName(e.target.value)}
            />
          </div>
          <ComboBox
            label="Industry"
            placeholder="Select or enter industry sector..."
            value={editIndustry}
            onChange={(val) => setEditIndustry(val)}
            options={PHILIPPINE_INDUSTRY_SECTORS.map((s) => ({ value: s, label: s }))}
            allowCustom
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact first name"
              placeholder="e.g. Roberto"
              value={editContactFirstName}
              onChange={(e) => setEditContactFirstName(e.target.value)}
            />
            <Input
              label="Contact last name"
              placeholder="e.g. Tan"
              value={editContactLastName}
              onChange={(e) => setEditContactLastName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneInput
              label="Contact phone"
              placeholder="0917 123 4567"
              value={editContactPhone}
              onChange={setEditContactPhone}
            />
            <Input
              label="Contact email"
              type="email"
              placeholder="e.g. hr.acmecorp@gmail.com"
              value={editContactEmail}
              error={editEmailError || undefined}
              onChange={(e) => {
                setEditContactEmail(e.target.value);
                if (editEmailError) setEditEmailError(null);
              }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Facility address
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ComboBox
                label="Province or region"
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
                label="City or municipality"
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
                  label="Street or building address"
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
                  maxLength={4}
                  inputMode="numeric"
                  helperText="4-digit PH postal code"
                  error={editPostalCodeError || undefined}
                  onChange={(e) => {
                    setEditPostalCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                    if (editPostalCodeError) setEditPostalCodeError(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updateClientMutation.isPending}>
              Save client
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
