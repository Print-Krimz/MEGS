import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  SearchFilters,
  Pagination,
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
  Building2,
  Plus,
  ArrowRight,
  Mail,
  Phone,
  Briefcase,
  Truck,
  MapPin,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";

const EMPTY_LIST: any[] = [];

export const ClientsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [industry, setIndustry] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [street, setStreet] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
  });

  const myJobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown", { mineOnly: true }],
    queryFn: () => taApi.listJobs({ mineOnly: true }),
  });

  const createClientMutation = useMutation({
    mutationFn: taApi.createClient,
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "clients"] });
      setCreateModalOpen(false);
      setName("");
      setTradeName("");
      setIndustry("");
      setContactFirstName("");
      setContactLastName("");
      setContactEmail("");
      setEmailError(null);
      setContactPhone("");
      setStreet("");
      setProvince("");
      setCity("");
      setPostalCode("");
      setPostalCodeError(null);
      notify.success("Client added", `Client '${newClient?.name || name}' was registered.`);
    },
    onError: (err: any) => {
      notify.error("Unable to add client", err);
    },
  });

  const clients = clientsQuery.data ?? EMPTY_LIST;
  const myJobs = myJobsQuery.data ?? EMPTY_LIST;

  const myClientIds = React.useMemo(() => {
    const ids = new Set<number>();
    myJobs.forEach((j: any) => {
      if (j.mrf?.clientId) ids.add(j.mrf.clientId);
      if (j.mrf?.client?.id) ids.add(j.mrf.client.id);
    });
    return ids;
  }, [myJobs]);

  const availableIndustries = React.useMemo(() => {
    const indSet = new Set<string>();
    clients.forEach((c) => {
      if (c.industry && c.industry.trim()) {
        indSet.add(c.industry.trim());
      }
    });
    return Array.from(indSet).sort();
  }, [clients]);

  const filteredClients = React.useMemo(() => {
    return clients.filter((c) => {
      if (mineOnly && !myClientIds.has(c.id)) {
        return false;
      }
      if (filterValues.status === "ACTIVE" && !c.isActive) return false;
      if (filterValues.status === "INACTIVE" && c.isActive) return false;
      if (filterValues.industry && c.industry !== filterValues.industry) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const match =
          c.name?.toLowerCase().includes(q) ||
          c.tradeName?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.contactName?.toLowerCase().includes(q) ||
          c.contactEmail?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.province?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [clients, mineOnly, myClientIds, filterValues, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = filteredClients.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (k: string, v: string) => {
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.navigation.clients}
        description="Manage client companies, staffing requests, and site assignments."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.clients },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add client
          </Button>
        }
      />

      {/* Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search clients by company, contact, or industry..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Client status",
            placeholder: "All account statuses",
            options: [
              { value: "ACTIVE", label: "Active partners" },
              { value: "INACTIVE", label: "Inactive accounts" },
            ],
          },
          ...(availableIndustries.length > 0
            ? [
                {
                  key: "industry",
                  label: "Industry Sector",
                  placeholder: "All industry sectors",
                  searchable: true,
                  options: availableIndustries.map((ind) => ({
                    value: ind,
                    label: ind,
                  })),
                },
              ]
            : []),
        ]}
        actions={
          <div className="flex items-center border border-slate-300 bg-slate-100 p-0.5 rounded text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMineOnly(false);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                !mineOnly
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All clients
            </button>
            <button
              type="button"
              onClick={() => {
                setMineOnly(true);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                mineOnly
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My clients
            </button>
          </div>
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
            title="No clients registered"
            description="Add a client to begin creating manpower requests and assigning employees to sites."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Add client
              </Button>
            }
          />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="No matching clients"
            description={
              mineOnly
                ? "You do not have any openings or placements tied to clients matching your search."
                : "No clients matched your search and filters. Try clearing the filters."
            }
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedClients.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                      {c.tradeName && (
                        <div className="text-xs text-teal-700 font-mono font-medium">
                          Brand: {c.tradeName}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 font-mono">
                        Industry: {c.industry || "General commercial"}
                      </div>
                    </div>
                    <StatusBadge status={c.isActive ? "Active client" : "Inactive"} type="raw" size="sm" />
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    {c.contactName && (
                      <div className="font-medium text-slate-800">
                        Contact: {c.contactName}
                      </div>
                    )}
                    {c.contactEmail && (
                      <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{c.contactEmail}</span>
                      </div>
                    )}
                    {c.contactPhone && (
                      <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{c.contactPhone}</span>
                      </div>
                    )}
                    {(c.street || c.city || c.province || c.address) && (
                      <div className="flex items-start gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {c.street || c.city || c.province
                            ? [c.street, c.city, c.province, c.postalCode].filter(Boolean).join(", ")
                            : c.address}
                        </span>
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
                        <span className="text-xs text-slate-500">Requests</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <Truck className="w-3.5 h-3.5 text-emerald-600" />
                      <div>
                        <span className="font-bold text-slate-900">
                          {c._count?.deployments || 0}
                        </span>{" "}
                        <span className="text-xs text-slate-500">Deployed</span>
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
                      View client
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredClients.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="clients"
          />
        </div>
      )}

      {/* Add Client Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setPostalCodeError(null);
          setEmailError(null);
        }}
        title="Add client"
        description="Register the company and its main contact details."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (contactEmail.trim() && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(contactEmail.trim())) {
              setEmailError("Official contact email must be a valid @gmail.com address");
              return;
            }
            if (postalCode.trim().length > 0 && postalCode.trim().length !== 4) {
              setPostalCodeError("Postal code must be exactly 4 digits");
              return;
            }
            const combinedName = [contactFirstName.trim(), contactLastName.trim()].filter(Boolean).join(" ");
            createClientMutation.mutate({
              name: name.trim(),
              tradeName: tradeName.trim() || undefined,
              industry: industry.trim() || undefined,
              contactName: combinedName || undefined,
              contactEmail: contactEmail.trim() || undefined,
              contactPhone: contactPhone.trim() || undefined,
              street: street.trim() || undefined,
              province: province.trim() || undefined,
              city: city.trim() || undefined,
              postalCode: postalCode.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Legal company name"
              placeholder="e.g. Acme Industrial Services Corp."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Brand name (optional)"
              placeholder="e.g. Acme Logistics"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </div>

          <ComboBox
            label="Industry"
            placeholder="Select or enter industry sector..."
            value={industry}
            onChange={(val) => setIndustry(val)}
            options={PHILIPPINE_INDUSTRY_SECTORS.map((s) => ({ value: s, label: s }))}
            allowCustom
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact first name"
              placeholder="e.g. Roberto"
              value={contactFirstName}
              onChange={(e) => setContactFirstName(e.target.value)}
            />
            <Input
              label="Contact last name"
              placeholder="e.g. Tan"
              value={contactLastName}
              onChange={(e) => setContactLastName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneInput
              label="Contact phone"
              placeholder="0917 123 4567"
              value={contactPhone}
              onChange={setContactPhone}
            />
            <Input
              label="Contact email"
              type="email"
              placeholder="e.g. hr.acmecorp@gmail.com"
              value={contactEmail}
              error={emailError || undefined}
              onChange={(e) => {
                setContactEmail(e.target.value);
                if (emailError) setEmailError(null);
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
                value={province}
                onChange={(val) => {
                  setProvince(val);
                  setCity("");
                }}
                options={PHILIPPINE_REGIONS_AND_PROVINCES.map((p) => ({ value: p, label: p }))}
                allowCustom
              />
              <ComboBox
                label="City or municipality"
                placeholder={province ? "Select city..." : "Select province first"}
                value={city}
                onChange={setCity}
                options={getCitiesForProvince(province).map((c) => ({ value: c, label: c }))}
                allowCustom
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Street or building address"
                  placeholder="e.g. Bldg 4, Light Industry & Science Park II"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Postal Code"
                  placeholder="e.g. 4027"
                  value={postalCode}
                  maxLength={4}
                  inputMode="numeric"
                  helperText="4-digit PH postal code"
                  error={postalCodeError || undefined}
                  onChange={(e) => {
                    setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                    if (postalCodeError) setPostalCodeError(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createClientMutation.isPending}>
            Add client
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
