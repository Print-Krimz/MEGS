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
  DataTable,
} from "../../components/common";
import type { DataTableColumn } from "../../components/common";
import { Button, Dialog, Input, PhoneInput } from "../../components/ui";
import { ComboBox } from "../../components/ui/ComboBox";
import { plural } from "../../lib/plural";
import { PhilippineAddressFields } from "../../components/common/PhilippineAddressFields";
import { PHILIPPINE_INDUSTRY_SECTORS } from "../../lib/industry-data";
import { Plus } from "lucide-react";
import { notify, fieldErrorsFrom } from "../../lib/feedback";
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
type ClientRow = any;
// First and last name are joined with a space; capping each part keeps the joined name within the backend limit.
const CONTACT_NAME_PART_MAX = Math.floor((FIELD_LIMITS.name - 1) / 2);
const CONTACT_EMAIL_MESSAGE = "Enter a valid email address.";
const contactEmailSchema = z.string().trim().email(CONTACT_EMAIL_MESSAGE).max(FIELD_LIMITS.email, CONTACT_EMAIL_MESSAGE);
const contactNameLengthError = (first: string, last: string) =>
  [first.trim(), last.trim()].filter(Boolean).join(" ").length > FIELD_LIMITS.name
    ? `Contact name cannot exceed ${FIELD_LIMITS.name} characters.`
    : undefined;
// Backend fields that have an inline input on this form. Any other field's message goes in the toast.
const CLIENT_INLINE_FIELDS = ["name", "tradeName", "industry", "contactName", "contactEmail", "contactPhone", "street"];

export const ClientsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) =>
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

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
      setServerFieldErrors({});
      setContactPhone("");
      setStreet("");
      setProvince("");
      setCity("");
      setBarangay("");
      setPostalCode("");
      notify.success("Client added", `Client '${newClient?.name || name}' was registered.`);
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const entries = Object.entries(fieldErrors);
      if (entries.length > 0) {
        setServerFieldErrors(fieldErrors);
        const toastEntry = entries.find(([field]) => !CLIENT_INLINE_FIELDS.includes(field)) ?? entries[0];
        notify.error("Check the highlighted fields", toastEntry[1]);
        return;
      }
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

  const columns: DataTableColumn<ClientRow>[] = [
    {
      key: "name",
      header: "Client",
      primary: true,
      cell: (c) => c.name,
    },
    { key: "industry", header: "Industry", cell: (c) => c.industry || "General commercial" },
    {
      key: "contact",
      header: "Contact",
      cell: (c) =>
        c.contactName || c.contactEmail ? (
          <span>
            {c.contactName && <span className="block">{c.contactName}</span>}
            {c.contactEmail && <span className="block break-all text-xs text-slate-600">{c.contactEmail}</span>}
          </span>
        ) : (
          <span className="text-slate-600">No contact</span>
        ),
    },
    { key: "requests", header: "Requests", align: "right", cell: (c) => c._count?.manpowerRequests || 0 },
    { key: "deployed", header: "Deployed", align: "right", cell: (c) => c._count?.deployments || 0 },
    {
      key: "status",
      header: "Status",
      cell: (c) =>
        c.isActive ? <span className="text-slate-700">Active</span> : <StatusBadge status="Inactive" type="raw" size="sm" />,
    },
  ];

  const renderCard = (c: ClientRow) => (
    <div className="space-y-1.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/ta/clients/$clientId"
          params={{ clientId: String(c.id) }}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline-offset-2 hover:underline focus-ring"
        >
          {c.name}
        </Link>
        {!c.isActive && <StatusBadge status="Inactive" type="raw" size="sm" />}
      </div>
      <p className="text-sm text-slate-600">
        {[c.tradeName ? `Brand: ${c.tradeName}` : null, c.industry || "General commercial"].filter(Boolean).join(" · ")}
      </p>
      {(c.contactName || c.contactEmail || c.contactPhone) && (
        <p className="break-words text-sm text-slate-700">
          {[c.contactName, c.contactEmail, c.contactPhone].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="text-sm text-slate-700">
        {plural(c._count?.manpowerRequests || 0, "request")} · {c._count?.deployments || 0} deployed
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={TA_COPY.navigation.clients}
        description="Manage client companies, staffing requests, and site assignments."
        breadcrumbs={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
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

      <SearchFilters
        className="!mb-0"
        searchLabel="Search clients"
        searchPlaceholder="Search clients"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Client status",
            placeholder: "All statuses",
            searchable: true,
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
          {
            key: "industry",
            label: "Industry",
            placeholder: "All industries",
            searchable: true,
            options: availableIndustries.map((ind) => ({
              value: ind,
              label: ind,
            })),
          },
        ]}
      />

      {clientsQuery.isLoading ? (
        <LoadingState variant="table" />
      ) : clientsQuery.isError ? (
        <ErrorState subject="clients" error={clientsQuery.error} onRetry={() => clientsQuery.refetch()} />
      ) : (
        <DataTable
          density="compact"
          caption="Clients"
          columns={columns}
          rows={paginatedClients}
          getRowId={(c) => String(c.id)}
          renderCard={renderCard}
          cardsBelow="md"
          rowHref={(c) => `/ta/clients/${c.id}`}
          empty={
            clients.length === 0 ? (
              <EmptyState
                bare
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
            ) : (
              <EmptyState
                bare
                title="No matching clients"
                description="No clients matched your search and filters. Try clearing the filters."
                action={
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Reset filters
                  </Button>
                }
              />
            )
          }
          footer={
            <Pagination
              variant="inset"
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredClients.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onPageChange={setPage}
              itemLabel="clients"
            />
          }
        />
      )}

      {/* Add Client Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEmailError(null);
          setServerFieldErrors({});
        }}
        title="Add client"
        description="Register the company and its main contact details."
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setServerFieldErrors((prev) => ({ ...prev, name: "Enter the company name." }));
              notify.error("Check the highlighted fields", "Enter the company name.");
              nameInputRef.current?.focus();
              return;
            }

            const nameErr = validateStandardText(name, "Legal company name", { maxLength: 200 });
            if (nameErr) {
              notify.error("Check the highlighted fields", nameErr);
              return;
            }

            if (tradeName.trim()) {
              const tradeErr = validateStandardText(tradeName, "Brand name", { maxLength: 200 });
              if (tradeErr) {
                notify.error("Check the highlighted fields", tradeErr);
                return;
              }
            }

            if (contactFirstName.trim()) {
              const fnErr = validatePersonName(contactFirstName, "Contact first name");
              if (fnErr) {
                notify.error("Check the highlighted fields", fnErr);
                return;
              }
            }

            if (contactLastName.trim()) {
              const lnErr = validatePersonName(contactLastName, "Contact last name");
              if (lnErr) {
                notify.error("Check the highlighted fields", lnErr);
                return;
              }
            }

            const contactNameErr = contactNameLengthError(contactFirstName, contactLastName);
            if (contactNameErr) {
              notify.error("Check the highlighted fields", contactNameErr);
              return;
            }

            if (contactPhone.trim()) {
              const phoneErr = validatePhilippineContactPhone(contactPhone, { label: "Contact phone" });
              if (phoneErr) {
                notify.error("Check the highlighted fields", phoneErr);
                return;
              }
            }

            if (contactEmail.trim() && !contactEmailSchema.safeParse(contactEmail).success) {
              setEmailError(CONTACT_EMAIL_MESSAGE);
              return;
            }
            const hasAddress = [street, province, city, barangay, postalCode].some((value) => value.trim());
            if (hasAddress && (!province.trim() || !city.trim() || !barangay.trim() || !postalCode.trim())) {
              notify.error("Check the highlighted fields", "Enter the province, city, barangay, and postal code.");
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
              ref={nameInputRef}
              label="Legal company name"
              placeholder="e.g. Acme Industrial Services Corp."
              value={name}
              error={serverFieldErrors.name}
              onChange={(e) => {
                setName(e.target.value);
                clearServerFieldError("name");
              }}
              required
            />
            <Input
              label="Brand name (optional)"
              placeholder="e.g. Acme Logistics"
              value={tradeName}
              error={serverFieldErrors.tradeName}
              onChange={(e) => {
                setTradeName(e.target.value);
                clearServerFieldError("tradeName");
              }}
            />
          </div>

          <ComboBox
            label="Industry"
            placeholder="Select or enter industry sector..."
            value={industry}
            error={serverFieldErrors.industry}
            onChange={(val) => {
              setIndustry(val);
              clearServerFieldError("industry");
            }}
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
              error={serverFieldErrors.contactName}
              onChange={(e) => {
                setContactFirstName(e.target.value);
                clearServerFieldError("contactName");
              }}
            />
            <Input
              label="Contact last name"
              maxLength={CONTACT_NAME_PART_MAX}
              nameInput
              placeholder="e.g. Tan"
              error={contactNameLengthError(contactFirstName, contactLastName)}
              value={contactLastName}
              onChange={(e) => {
                setContactLastName(e.target.value);
                clearServerFieldError("contactName");
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneInput
              label="Contact phone"
              placeholder="0917 123 4567"
              value={contactPhone}
              error={serverFieldErrors.contactPhone}
              onChange={(val) => {
                setContactPhone(val);
                clearServerFieldError("contactPhone");
              }}
            />
            <Input
              label="Contact email"
              type="email"
              placeholder="e.g. hr@acmecorp.com"
              value={contactEmail}
              error={serverFieldErrors.contactEmail || emailError || undefined}
              onChange={(e) => {
                setContactEmail(e.target.value);
                clearServerFieldError("contactEmail");
                if (emailError) setEmailError(null);
              }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Facility address
            </div>
            <Input
              label="Street or building address"
              placeholder="e.g. Bldg 4, Light Industry & Science Park II"
              value={street}
              error={serverFieldErrors.street}
              onChange={(e) => {
                setStreet(e.target.value);
                clearServerFieldError("street");
              }}
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
