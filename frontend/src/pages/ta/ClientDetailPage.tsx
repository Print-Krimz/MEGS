import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  StatusBadge,
  Tabs,
  RecordSummary,
} from "../../components/common";
import { RecordBreadcrumb } from "../../components/ta/recruitment/RecordBreadcrumb";
import { Button, Dialog, Input, PhoneInput, Select } from "../../components/ui";
import { ComboBox } from "../../components/ui/ComboBox";
import { cn, formatDate, getInitials } from "../../lib/utils";
import { PhilippineAddressFields } from "../../components/common/PhilippineAddressFields";
import { PHILIPPINE_INDUSTRY_SECTORS } from "../../lib/industry-data";
import { MapPin } from "lucide-react";
import { notify, fieldErrorsFrom } from "../../lib/feedback";
import { TA_COPY, formatPriority, formatTaStatus } from "../../lib/ta-copy";
import { plural } from "../../lib/plural";
import {
  validatePersonName,
  validateStandardText,
  validatePhilippineContactPhone,
} from "../../lib/statutory-validation";
import { z } from "zod";
import { FIELD_LIMITS } from "../../lib/field-limits";

// First and last name are joined with a space; capping each part keeps the joined name within the backend limit.
const CONTACT_NAME_PART_MAX = Math.floor((FIELD_LIMITS.name - 1) / 2);
const CONTACT_EMAIL_MESSAGE = "Enter a valid email address.";
const contactEmailSchema = z.string().trim().email(CONTACT_EMAIL_MESSAGE).max(FIELD_LIMITS.email, CONTACT_EMAIL_MESSAGE);
const contactNameLengthError = (first: string, last: string) =>
  [first.trim(), last.trim()].filter(Boolean).join(" ").length > FIELD_LIMITS.name
    ? `Contact name cannot exceed ${FIELD_LIMITS.name} characters.`
    : undefined;
// Backend fields that have an inline input on this form. Any other field's message goes in the toast.
const CLIENT_INLINE_FIELDS = [
  "name",
  "tradeName",
  "industry",
  "contactName",
  "contactEmail",
  "contactPhone",
  "street",
  "reviewThresholdDays",
  "medicalValidityMonths",
];

type ClientTab = "overview" | "requests" | "deployments" | "settings";

export const ClientDetailPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ClientTab>("overview");
  const queryClient = useQueryClient();
  const { clientId } = useParams({ strict: false }) as { clientId: string };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const editNameInputRef = React.useRef<HTMLInputElement>(null);
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
  const [editBarangay, setEditBarangay] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editReviewThresholdDays, setEditReviewThresholdDays] = useState("5");
  const [editMedicalValidityMonths, setEditMedicalValidityMonths] = useState(6);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) =>
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

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
      setServerFieldErrors({});
      setEditModalOpen(false);
      notify.success("Client updated", "The client details were saved.");
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
      setEditBarangay(client.barangay || "");
      setEditPostalCode(client.postalCode || "");
      setEditReviewThresholdDays(String(client.reviewThresholdDays ?? 5));
      setEditMedicalValidityMonths(client.medicalValidityMonths ?? 6);
    }
  }, [client]);

  if (clientQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          flush
          title="Client"
          description="Loading client information..."
          breadcrumbs={[
            { label: TA_COPY.breadcrumbRoot, href: "/ta" },
            { label: TA_COPY.navigation.clients, href: "/ta/clients" },
            { label: "Client" },
          ]}
        />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (clientQuery.isError || !client) {
    return (
      <div className="space-y-6">
        <PageHeader
          flush
          title="Client"
          breadcrumbs={[
            { label: TA_COPY.breadcrumbRoot, href: "/ta" },
            { label: TA_COPY.navigation.clients, href: "/ta/clients" },
            { label: "Client" },
          ]}
        />
        <ErrorState subject="this client" error={clientQuery.error} onRetry={() => clientQuery.refetch()} />
      </div>
    );
  }

  const clientWords = client.name.trim().split(/\s+/);
  const activeDeployments = deployments.filter((dep) => dep.status === "ACTIVE").length;
  const hasAddress = Boolean(client.street || client.barangay || client.city || client.province || client.address);
  const addressText =
    client.street || client.barangay || client.city || client.province
      ? [client.street, client.barangay, client.city, client.province, client.postalCode].filter(Boolean).join(", ")
      : client.address;
  const customTemplates: any[] = client.complianceTemplates ?? [];
  const PREVIEW_COUNT = 3;

  const panelClass = "rounded-md border border-slate-300 bg-white";
  const panelTitleClass = "text-base font-semibold text-slate-950";

  const requestRow = (mrf: (typeof mrfs)[number]) => (
    <li key={mrf.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-semibold text-slate-950">{mrf.title}</div>
        <div className="text-sm text-slate-600">
          {plural(mrf.headcount, "position")} · Priority: {formatPriority(mrf.priority)} · {formatTaStatus(mrf.status)}
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/ta/mrfs/$mrfId" params={{ mrfId: String(mrf.id) }}>
          View request
        </Link>
      </Button>
    </li>
  );

  const deploymentRow = (dep: (typeof deployments)[number]) => (
    <li key={dep.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-semibold text-slate-950">
          {dep.employee?.user?.applicantProfile?.firstName || "Employee"}{" "}
          {dep.employee?.user?.applicantProfile?.lastName || ""}
        </div>
        <div className="text-sm text-slate-600">
          Site: {dep.site || "General facility"} · {formatTaStatus(dep.status)}
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
          View deployment
        </Link>
      </Button>
    </li>
  );

  const requestsEmpty = (
    <div className="space-y-3 p-6 text-sm text-slate-600">
      <p>No manpower requests placed by this client.</p>
      <Button asChild variant="primary" size="sm">
        <Link to="/ta/mrfs/create" search={{ clientId: client.id }}>
          Create the first request
        </Link>
      </Button>
    </div>
  );

  const deploymentsEmpty = (
    <div className="space-y-3 p-6 text-sm text-slate-600">
      <p>No deployments recorded for this client yet.</p>
      <Button asChild variant="outline" size="sm">
        <Link to="/ta/workforce" search={{ tab: "deployments", q: client.name }}>
          Open workforce deployments
        </Link>
      </Button>
    </div>
  );

  const previewHeader = (title: string, total: number, tab: ClientTab) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
      <h3 className={panelTitleClass}>
        {title} ({total})
      </h3>
      {total > PREVIEW_COUNT && (
        <Button variant="ghost" size="sm" onClick={() => setActiveTab(tab)}>
          View all
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <RecordBreadcrumb
        items={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
          { label: TA_COPY.navigation.clients, href: "/ta/clients" },
          { label: client.name },
        ]}
      />

      <RecordSummary
        titleAs="h1"
        title={client.name}
        subtitle={client.tradeName ? `Brand: ${client.tradeName}` : `Registered ${formatDate(client.createdAt)}`}
        avatarText={getInitials(clientWords[0], clientWords[1])}
        chips={<StatusBadge status={client.isActive ? "Active" : "Inactive"} type="raw" size="sm" />}
        facts={[
          { label: "Industry", value: client.industry || "General Commercial" },
          { label: "Review SLA", value: `${client.reviewThresholdDays ?? 5} days` },
          { label: "Active deployments", value: String(activeDeployments) },
          { label: "Open requests", value: String(mrfs.filter((m) => m.status !== "CANCELLED" && m.status !== "FILLED").length) },
          { label: "Contact", value: client.contactName || "Not set" },
        ]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/ta/workforce" search={{ tab: "deployments", q: client.name }}>
                Open in workforce
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
              Edit client
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link to="/ta/mrfs/create" search={{ clientId: client.id }}>
                Create manpower request
              </Link>
            </Button>
          </>
        }
      />

      <Tabs
        ariaLabel="Client sections"
        value={activeTab}
        onChange={(id) => setActiveTab(id as ClientTab)}
        items={[
          { id: "overview", label: "Overview", panelId: "client-tab-panel" },
          { id: "requests", label: "Requests", panelId: "client-tab-panel", badge: { text: String(mrfs.length), variant: "info" } },
          { id: "deployments", label: "Deployments", panelId: "client-tab-panel", badge: { text: String(deployments.length), variant: "info" } },
          { id: "settings", label: "Settings", panelId: "client-tab-panel" },
        ]}
      />

      <div id="client-tab-panel" role="tabpanel" className="space-y-5">
        {activeTab === "overview" && (
          <>
            <section className={cn(panelClass, "p-4 sm:p-5")}>
              <h3 className={cn(panelTitleClass, "mb-3 border-b border-slate-200 pb-2.5")}>Company information</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-slate-600">Industry</dt>
                  <dd className="text-slate-900">{client.industry || "General Commercial"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-600">Contact</dt>
                  <dd className="text-slate-900">{client.contactName || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-600">Email and phone</dt>
                  <dd className="break-all text-slate-900">
                    {client.contactEmail || "No email"}
                    {client.contactPhone ? ` · ${client.contactPhone}` : ""}
                  </dd>
                </div>
                {hasAddress && (
                  <div className="sm:col-span-3">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      Facility address
                    </dt>
                    <dd className="text-slate-900">{addressText}</dd>
                  </div>
                )}
              </dl>
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className={cn(panelClass, "overflow-hidden")}>
                {previewHeader("Manpower requests", mrfs.length, "requests")}
                {mrfs.length === 0 ? requestsEmpty : <ul className="divide-y divide-slate-200">{mrfs.slice(0, PREVIEW_COUNT).map(requestRow)}</ul>}
              </section>
              <section className={cn(panelClass, "overflow-hidden")}>
                {previewHeader("Deployments", deployments.length, "deployments")}
                {deployments.length === 0 ? deploymentsEmpty : <ul className="divide-y divide-slate-200">{deployments.slice(0, PREVIEW_COUNT).map(deploymentRow)}</ul>}
              </section>
            </div>
          </>
        )}

        {activeTab === "requests" && (
          <section className={cn(panelClass, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
              <h3 className={panelTitleClass}>Manpower requests ({mrfs.length})</h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/ta/mrfs/create" search={{ clientId: client.id }}>
                  New request
                </Link>
              </Button>
            </div>
            {mrfs.length === 0 ? requestsEmpty : <ul className="divide-y divide-slate-200">{mrfs.map(requestRow)}</ul>}
          </section>
        )}

        {activeTab === "deployments" && (
          <section className={cn(panelClass, "overflow-hidden")}>
            <div className="border-b border-slate-200 p-4">
              <h3 className={panelTitleClass}>Deployments ({deployments.length})</h3>
              <p className="text-sm text-slate-600">Personnel placed on this client&apos;s sites</p>
            </div>
            {deployments.length === 0 ? deploymentsEmpty : <ul className="divide-y divide-slate-200">{deployments.map(deploymentRow)}</ul>}
          </section>
        )}

        {activeTab === "settings" && (
          <section className={cn(panelClass, "p-4 sm:p-5")}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
              <h3 className={panelTitleClass}>Compliance and SLA settings</h3>
              <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                Edit settings
              </Button>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-slate-600">Review SLA threshold</dt>
                <dd className="text-slate-900">{client.reviewThresholdDays ?? 5} days</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Medical exam validity</dt>
                <dd className="text-slate-900">{client.medicalValidityMonths ?? 6} months</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Pre-employment template</dt>
                <dd className="text-slate-900">
                  {customTemplates.length > 0
                    ? `${customTemplates.length} custom requirement${customTemplates.length === 1 ? "" : "s"}`
                    : "Default 201 checklist"}
                </dd>
              </div>
            </dl>

            {customTemplates.length > 0 ? (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                <p className="text-xs font-medium text-slate-600">Checklist requirements</p>
                <div className="flex flex-wrap gap-1.5">
                  {customTemplates.map((t: any) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-800"
                    >
                      <span>{t.documentLabel}</span>
                      {!t.isRequired && <span className="text-slate-600">(optional)</span>}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
                <p className="mb-1 text-xs font-medium text-slate-600">Standard 201 requirements</p>
                <p className="leading-relaxed text-slate-700">
                  Government Issued ID, NBI Clearance, Fit to Work Medical Exam, SSS Document, PhilHealth Member Data Record, Pag-IBIG Member ID, Client NDA & Security Briefing
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Edit Client Modal */}
      <Dialog
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditEmailError(null);
          setServerFieldErrors({});
        }}
        title="Edit client"
        description={`Update details for ${client.name}`}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!editName.trim()) {
              setServerFieldErrors((prev) => ({ ...prev, name: "Enter the company name." }));
              notify.error("Check the highlighted fields", "Enter the company name.");
              editNameInputRef.current?.focus();
              return;
            }

            const nameErr = validateStandardText(editName, "Legal company name", { maxLength: 200 });
            if (nameErr) {
              notify.error("Check the highlighted fields", nameErr);
              return;
            }

            if (editTradeName.trim()) {
              const tradeErr = validateStandardText(editTradeName, "Brand name", { maxLength: 200 });
              if (tradeErr) {
                notify.error("Check the highlighted fields", tradeErr);
                return;
              }
            }

            if (editContactFirstName.trim()) {
              const fnErr = validatePersonName(editContactFirstName, "Contact first name");
              if (fnErr) {
                notify.error("Check the highlighted fields", fnErr);
                return;
              }
            }

            if (editContactLastName.trim()) {
              const lnErr = validatePersonName(editContactLastName, "Contact last name");
              if (lnErr) {
                notify.error("Check the highlighted fields", lnErr);
                return;
              }
            }

            const contactNameErr = contactNameLengthError(editContactFirstName, editContactLastName);
            if (contactNameErr) {
              notify.error("Check the highlighted fields", contactNameErr);
              return;
            }

            if (editContactPhone.trim()) {
              const phoneErr = validatePhilippineContactPhone(editContactPhone, { label: "Contact phone" });
              if (phoneErr) {
                notify.error("Check the highlighted fields", phoneErr);
                return;
              }
            }

            if (editContactEmail.trim() && !contactEmailSchema.safeParse(editContactEmail).success) {
              setEditEmailError(CONTACT_EMAIL_MESSAGE);
              return;
            }
            const hasAddress = [editStreet, editProvince, editCity, editBarangay, editPostalCode].some((value) => value.trim());
            if (hasAddress && (!editProvince.trim() || !editCity.trim() || !editBarangay.trim() || !editPostalCode.trim())) {
              notify.error("Check the highlighted fields", "Enter the province, city, barangay, and postal code.");
              return;
            }
            const reviewThreshold = Number(editReviewThresholdDays);
            if (!Number.isInteger(reviewThreshold) || reviewThreshold < 1 || reviewThreshold > 30) {
              notify.error("Check the highlighted fields", "Enter an integer between 1 and 30 days.");
              return;
            }
            const combinedName = [editContactFirstName.trim(), editContactLastName.trim()].filter(Boolean).join(" ");
            // Optional fields send null when emptied so the save clears them; undefined would leave the stored value.
            updateClientMutation.mutate({
              name: editName.trim(),
              tradeName: editTradeName.trim() || null,
              industry: editIndustry.trim() || null,
              contactName: combinedName || null,
              contactEmail: editContactEmail.trim() || null,
              contactPhone: editContactPhone.trim() || null,
              street: editStreet.trim() || null,
              barangay: editBarangay.trim() || null,
              province: editProvince.trim() || null,
              city: editCity.trim() || null,
              postalCode: editPostalCode.trim() || null,
              reviewThresholdDays: reviewThreshold,
              medicalValidityMonths: Number(editMedicalValidityMonths) || 6,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              ref={editNameInputRef}
              label="Legal company name"
              value={editName}
              error={serverFieldErrors.name}
              onChange={(e) => {
                setEditName(e.target.value);
                clearServerFieldError("name");
              }}
              required
            />
            <Input
              label="Brand name (optional)"
              placeholder="e.g. Acme Logistics"
              value={editTradeName}
              error={serverFieldErrors.tradeName}
              onChange={(e) => {
                setEditTradeName(e.target.value);
                clearServerFieldError("tradeName");
              }}
            />
          </div>
          <ComboBox
            label="Industry"
            placeholder="Select or enter industry sector..."
            value={editIndustry}
            error={serverFieldErrors.industry}
            onChange={(val) => {
              setEditIndustry(val);
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
              value={editContactFirstName}
              error={serverFieldErrors.contactName}
              onChange={(e) => {
                setEditContactFirstName(e.target.value);
                clearServerFieldError("contactName");
              }}
            />
            <Input
              label="Contact last name"
              maxLength={CONTACT_NAME_PART_MAX}
              nameInput
              placeholder="e.g. Tan"
              error={contactNameLengthError(editContactFirstName, editContactLastName)}
              value={editContactLastName}
              onChange={(e) => {
                setEditContactLastName(e.target.value);
                clearServerFieldError("contactName");
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneInput
              label="Contact phone"
              placeholder="0917 123 4567"
              value={editContactPhone}
              error={serverFieldErrors.contactPhone}
              onChange={(val) => {
                setEditContactPhone(val);
                clearServerFieldError("contactPhone");
              }}
            />
            <Input
              label="Contact email"
              type="email"
              placeholder="e.g. hr@acmecorp.com"
              value={editContactEmail}
              error={serverFieldErrors.contactEmail || editEmailError || undefined}
              onChange={(e) => {
                setEditContactEmail(e.target.value);
                clearServerFieldError("contactEmail");
                if (editEmailError) setEditEmailError(null);
              }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Facility address
            </div>
            <Input
              label="Street or building address"
              placeholder="e.g. Bldg 4, Light Industry Park"
              value={editStreet}
              error={serverFieldErrors.street}
              onChange={(e) => {
                setEditStreet(e.target.value);
                clearServerFieldError("street");
              }}
            />
            <PhilippineAddressFields
              province={editProvince}
              city={editCity}
              barangay={editBarangay}
              postalCode={editPostalCode}
              onChange={(patch) => {
                if (patch.province !== undefined) setEditProvince(patch.province);
                if (patch.city !== undefined) setEditCity(patch.city);
                if (patch.barangay !== undefined) setEditBarangay(patch.barangay);
                if (patch.postalCode !== undefined) setEditPostalCode(patch.postalCode);
              }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Compliance and SLA settings
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Review SLA threshold (days)"
                type="number"
                min={1}
                max={30}
                value={editReviewThresholdDays}
                error={serverFieldErrors.reviewThresholdDays}
                onChange={(e) => {
                  setEditReviewThresholdDays(e.target.value);
                  clearServerFieldError("reviewThresholdDays");
                }}
                helperText="Turnaround SLA (1 - 30 days, default: 5)"
                required
              />
              <Select
                label="Medical validity period"
                value={String(editMedicalValidityMonths)}
                error={serverFieldErrors.medicalValidityMonths}
                onChange={(e) => {
                  setEditMedicalValidityMonths(Number(e.target.value));
                  clearServerFieldError("medicalValidityMonths");
                }}
                helperText="Auto-expiration period for medical documents"
                options={[
                  { value: "6", label: "6 months (Standard policy)" },
                  { value: "12", label: "12 months (Extended policy)" },
                ]}
              />
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
