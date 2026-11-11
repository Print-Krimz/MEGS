import React, { lazy, Suspense, useState } from "react";
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
import { Button, Dialog } from "../../components/ui";
import { plural } from "../../lib/plural";
import {
  ClientFields,
  CLIENT_INLINE_FIELDS,
  emptyClientDraft,
  errorKeysFor,
  toCreateClientDto,
  validateClientDraft,
  withoutErrors,
  type ClientDraft,
} from "../../components/ta/client/ClientFields";
import { FileUp, Plus } from "lucide-react";
import { notify, fieldErrorsFrom } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";

const EMPTY_LIST: any[] = [];
type ClientRow = any;
const AddClientsFromFilesDialog = lazy(() =>
  import("../../components/ta/client/AddClientsFromFilesDialog").then((m) => ({ default: m.AddClientsFromFilesDialog })));

export const ClientsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filesOpen, setFilesOpen] = useState(false);
  const [draft, setDraft] = useState<ClientDraft>(emptyClientDraft);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setDraft(emptyClientDraft);
      setErrors({});
      notify.success("Client added", `Client '${newClient?.name || draft.name}' was registered.`);
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const entries = Object.entries(fieldErrors);
      if (entries.length > 0) {
        setErrors(fieldErrors);
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
        breadcrumbs={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
          { label: TA_COPY.navigation.clients },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" leftIcon={<FileUp className="w-3.5 h-3.5" />} onClick={() => setFilesOpen(true)}>
              Add from files
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Add client
            </Button>
          </>
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
          setErrors({});
        }}
        title="Add client"
        description="Register the company and its main contact details."
        size="xl"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const found = validateClientDraft(draft);
            const first = Object.entries(found)[0];
            if (first) {
              setErrors(found);
              if (found.name) nameInputRef.current?.focus();
              if (first[0] !== "contactEmail") notify.error("Check the highlighted fields", first[1]);
              return;
            }
            createClientMutation.mutate(toCreateClientDto(draft));
          }}
          className="space-y-5"
        >
          <ClientFields
            idPrefix="add-client"
            value={draft}
            errors={errors}
            nameRef={nameInputRef}
            onChange={(patch) => {
              setDraft((prev) => ({ ...prev, ...patch }));
              setErrors((prev) => withoutErrors(prev, errorKeysFor(patch)));
            }}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={createClientMutation.isPending}>
            Add client
            </Button>
          </div>
        </form>
      </Dialog>

      <Suspense fallback={null}>{filesOpen && <AddClientsFromFilesDialog open onClose={() => setFilesOpen(false)} />}</Suspense>
    </div>
  );
};
