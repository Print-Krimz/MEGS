import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Input } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  Building2,
  Plus,
  ArrowRight,
  Mail,
  Phone,
  Briefcase,
  Truck,
} from "lucide-react";

export const ClientsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
  });

  const createClientMutation = useMutation({
    mutationFn: taApi.createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "clients"] });
      setCreateModalOpen(false);
      setName("");
      setIndustry("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setAddress("");
    },
  });

  const clients = clientsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Corporate Accounts"
        description="Manage client partner companies, active manpower requests, and on-site workforce allocations"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Clients" },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Client Account
          </Button>
        }
      />

      {clientsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : clientsQuery.isError ? (
        <ErrorState error={clientsQuery.error} onRetry={() => clientsQuery.refetch()} />
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="No Client Accounts Registered"
            description="Create your first client account to begin receiving manpower requests and assigning site deployments."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Add Client Account
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                    <div className="text-xs text-slate-500 font-mono">
                      Industry: {c.industry || "General Commercial"}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                      c.isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {c.isActive ? "ACTIVE PARTNER" : "INACTIVE"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {c.contactName && (
                    <div className="font-medium text-slate-800">
                      Contact Person: {c.contactName}
                    </div>
                  )}
                  {c.contactEmail && (
                    <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.contactEmail}</span>
                    </div>
                  )}
                  {c.contactPhone && (
                    <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.contactPhone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <div>
                      <span className="font-bold text-slate-900">
                        {c._count?.manpowerRequests || 0}
                      </span>{" "}
                      <span className="text-[10px] text-slate-400">MRFs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    <div>
                      <span className="font-bold text-slate-900">
                        {c._count?.deployments || 0}
                      </span>{" "}
                      <span className="text-[10px] text-slate-400">Deployed</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  Registered {formatDate(c.createdAt)}
                </span>
                <Link
                  to="/ta/clients/$clientId"
                  params={{ clientId: String(c.id) }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    View Client
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Corporate Client Account"
        description="Register a new business client partner"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createClientMutation.mutate({
              name,
              industry: industry || undefined,
              contactName: contactName || undefined,
              contactEmail: contactEmail || undefined,
              contactPhone: contactPhone || undefined,
              address: address || undefined,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Client Business / Corporate Name"
            placeholder="e.g. Acme Industrial Services Corp."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Industry / Sector"
            placeholder="e.g. Manufacturing, Logistics, Food Processing"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Person Full Name"
              placeholder="e.g. Engr. Roberto Tan"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <Input
              label="Contact Phone"
              placeholder="e.g. (02) 8123-4567"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <Input
            label="Official Contact Email"
            type="email"
            placeholder="e.g. hr@acmecorp.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Input
            label="Corporate / Facility Address"
            placeholder="e.g. Light Industry & Science Park II, Calamba, Laguna"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createClientMutation.isPending}>
              Register Client
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
