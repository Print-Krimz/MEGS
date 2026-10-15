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
import { PhilippineAddressFields } from "../../components/common/PhilippineAddressFields";
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
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";
import {
  validatePersonName,
  validateStandardText,
  validatePhilippineContactPhone,
} from "../../lib/statutory-validation";
import { z } from "zod";
import { FIELD_LIMITS } from "../../lib/field-limits";

const EMPTY_LIST: any[] = [];
// First and last name are joined with a space; capping each part keeps the joined name within the backend limit.
const CONTACT_NAME_PART_MAX = Math.floor((FIELD_LIMITS.name - 1) / 2);
const CONTACT_EMAIL_MESSAGE = "Enter a valid email address.";
const contactEmailSchema = z.string().trim().email(CONTACT_EMAIL_MESSAGE).max(FIELD_LIMITS.email, CONTACT_EMAIL_MESSAGE);
const contactNameLengthError = (first: string, last: string) =>
  [first.trim(), last.trim()].filter(Boolean).join(" ").length > FIELD_LIMITS.name
    ? `Contact name cannot exceed ${FIELD_LIMITS.name} characters.`
    : undefined;

export const ClientsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
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
  const [barangay, setBarangay] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
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
      setBarangay("");
      setPostalCode("");
      notify.success("Client added", `Client '${newClient?.name || name}' was registered.`);
    },
    onError: (err: any) => {
      notify.error("Unable to add client", err);
    },
  });

  const clients = clientsQuery.data ?? EMPTY_LIST;

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
  }, [clients, filterValues, search]);

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
            description="No clients matched your search and filters. Try clearing the filters."
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
                    {(c.street || c.barangay || c.city || c.province || c.postalCode || c.address) && (
                      <div className="flex items-start gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {c.street || c.city || c.province
                            ? [c.street, c.barangay, c.city, c.province, c.postalCode].filter(Boolean).join(", ")
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
          setEmailError(null);
        }}
        title="Add client"
        description="Register the company and its main contact details."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;

            const nameErr = validateStandardText(name, "Legal company name", { maxLength: 200 });
            if (nameErr) {
              notify.error("Invalid Company Name", nameErr);
              return;
            }

            if (tradeName.trim()) {
              const tradeErr = validateStandardText(tradeName, "Brand name", { maxLength: 200 });
              if (tradeErr) {
                notify.error("Invalid Brand Name", tradeErr);
                return;
              }
            }

            if (contactFirstName.trim()) {
              const fnErr = validatePersonName(contactFirstName, "Contact first name");
              if (fnErr) {
                notify.error("Invalid Contact Name", fnErr);
                return;
              }
            }

            if (contactLastName.trim()) {
              const lnErr = validatePersonName(contactLastName, "Contact last name");
              if (lnErr) {
                notify.error("Invalid Contact Name", lnErr);
                return;
              }
            }

            const contactNameErr = contactNameLengthError(contactFirstName, contactLastName);
            if (contactNameErr) {
              notify.error("Invalid Contact Name", contactNameErr);
              return;
            }

            if (contactPhone.trim()) {
              const phoneErr = validatePhilippineContactPhone(contactPhone, { label: "Contact phone" });
              if (phoneErr) {
                notify.error("Invalid Contact Phone", phoneErr);
                return;
              }
            }

            if (contactEmail.trim() && !contactEmailSchema.safeParse(contactEmail).success) {
              setEmailError(CONTACT_EMAIL_MESSAGE);
              return;
            }
            const hasAddress = [street, province, city, barangay, postalCode].some((value) => value.trim());
            if (hasAddress && (!province.trim() || !city.trim() || !barangay.trim() || !postalCode.trim())) {
              notify.error("Address is incomplete", "Enter the province, city, barangay, and postal code.");
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
              barangay: barangay.trim() || undefined,
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
              maxLength={CONTACT_NAME_PART_MAX}
              nameInput
              placeholder="e.g. Roberto"
              value={contactFirstName}
              onChange={(e) => setContactFirstName(e.target.value)}
            />
            <Input
              label="Contact last name"
              maxLength={CONTACT_NAME_PART_MAX}
              nameInput
              placeholder="e.g. Tan"
              error={contactNameLengthError(contactFirstName, contactLastName)}
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
              placeholder="e.g. hr@acmecorp.com"
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
            <Input
              label="Street or building address"
              placeholder="e.g. Bldg 4, Light Industry & Science Park II"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
            <PhilippineAddressFields
              province={province}
              city={city}
              barangay={barangay}
              postalCode={postalCode}
              onChange={(patch) => {
                if (patch.province !== undefined) setProvince(patch.province);
                if (patch.city !== undefined) setCity(patch.city);
                if (patch.barangay !== undefined) setBarangay(patch.barangay);
                if (patch.postalCode !== undefined) setPostalCode(patch.postalCode);
              }}
            />
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
