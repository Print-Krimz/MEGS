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
import { Button, Dialog, Input, PhoneInput, Select } from "../../components/ui";
import { ComboBox } from "../../components/ui/ComboBox";
import { formatDate } from "../../lib/utils";
import { PhilippineAddressFields } from "../../components/common/PhilippineAddressFields";
import { PHILIPPINE_INDUSTRY_SECTORS } from "../../lib/industry-data";
import {
  ArrowLeft,
  Edit,
  Plus,
  MapPin,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY, formatPriority, formatTaStatus } from "../../lib/ta-copy";
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
  const [editBarangay, setEditBarangay] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editReviewThresholdDays, setEditReviewThresholdDays] = useState("5");
  const [editMedicalValidityMonths, setEditMedicalValidityMonths] = useState(6);

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
      setEditBarangay(client.barangay || "");
      setEditPostalCode(client.postalCode || "");
      setEditReviewThresholdDays(String(client.reviewThresholdDays ?? 5));
      setEditMedicalValidityMonths(client.medicalValidityMonths ?? 6);
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
        {(client.street || client.barangay || client.city || client.province || client.address) && (
          <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-500 block">Facility address</span>
              <span>
                {client.street || client.barangay || client.city || client.province
                  ? [client.street, client.barangay, client.city, client.province, client.postalCode].filter(Boolean).join(", ")
                  : client.address}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compliance & SLA Settings Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500">
            Compliance & SLA settings
          </h3>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="text-xs text-teal-700 hover:text-teal-900 font-medium cursor-pointer"
          >
            Edit settings
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Review SLA threshold</span>
            <span className="font-semibold text-slate-900">
              {client.reviewThresholdDays ?? 5} days
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Medical exam validity</span>
            <span className="font-semibold text-slate-900">
              {client.medicalValidityMonths ?? 6} months
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Pre-employment template</span>
            <span className="text-slate-900 font-medium">
              {client.complianceTemplates && client.complianceTemplates.length > 0
                ? `${client.complianceTemplates.length} custom requirement${client.complianceTemplates.length === 1 ? "" : "s"}`
                : "Default 201 checklist"}
            </span>
          </div>
        </div>

        {client.complianceTemplates && client.complianceTemplates.length > 0 ? (
          <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
            <span className="text-slate-500 block">Checklist requirements</span>
            <div className="flex flex-wrap gap-1.5">
              {client.complianceTemplates.map((t: any) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 text-slate-800 border border-slate-200"
                >
                  <span>{t.documentLabel}</span>
                  {t.isRequired ? (
                    <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">
                      Required
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-500 bg-white px-1 rounded border border-slate-200">
                      Optional
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 block mb-1">Standard 201 requirements</span>
            <p className="text-slate-700 leading-relaxed">
              Government Issued ID, NBI Clearance, Fit to Work Medical Exam, SSS Document, PhilHealth Member Data Record, Pag-IBIG Member ID, Client NDA & Security Briefing
            </p>
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
          setEditEmailError(null);
        }}
        title="Edit client"
        description={`Update details for ${client.name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editName.trim()) return;

            const nameErr = validateStandardText(editName, "Legal company name", { maxLength: 200 });
            if (nameErr) {
              notify.error("Invalid Company Name", nameErr);
              return;
            }

            if (editTradeName.trim()) {
              const tradeErr = validateStandardText(editTradeName, "Brand name", { maxLength: 200 });
              if (tradeErr) {
                notify.error("Invalid Brand Name", tradeErr);
                return;
              }
            }

            if (editContactFirstName.trim()) {
              const fnErr = validatePersonName(editContactFirstName, "Contact first name");
              if (fnErr) {
                notify.error("Invalid Contact Name", fnErr);
                return;
              }
            }

            if (editContactLastName.trim()) {
              const lnErr = validatePersonName(editContactLastName, "Contact last name");
              if (lnErr) {
                notify.error("Invalid Contact Name", lnErr);
                return;
              }
            }

            const contactNameErr = contactNameLengthError(editContactFirstName, editContactLastName);
            if (contactNameErr) {
              notify.error("Invalid Contact Name", contactNameErr);
              return;
            }

            if (editContactPhone.trim()) {
              const phoneErr = validatePhilippineContactPhone(editContactPhone, { label: "Contact phone" });
              if (phoneErr) {
                notify.error("Invalid Contact Phone", phoneErr);
                return;
              }
            }

            if (editContactEmail.trim() && !contactEmailSchema.safeParse(editContactEmail).success) {
              setEditEmailError(CONTACT_EMAIL_MESSAGE);
              return;
            }
            const hasAddress = [editStreet, editProvince, editCity, editBarangay, editPostalCode].some((value) => value.trim());
            if (hasAddress && (!editProvince.trim() || !editCity.trim() || !editBarangay.trim() || !editPostalCode.trim())) {
              notify.error("Address is incomplete", "Enter the province, city, barangay, and postal code.");
              return;
            }
            const reviewThreshold = Number(editReviewThresholdDays);
            if (!Number.isInteger(reviewThreshold) || reviewThreshold < 1 || reviewThreshold > 30) {
              notify.error("Invalid review threshold", "Enter an integer between 1 and 30 days.");
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
              maxLength={CONTACT_NAME_PART_MAX}
              nameInput
              placeholder="e.g. Roberto"
              value={editContactFirstName}
              onChange={(e) => setEditContactFirstName(e.target.value)}
            />
            <Input
              label="Contact last name"
              maxLength={CONTACT_NAME_PART_MAX}
              nameInput
              placeholder="e.g. Tan"
              error={contactNameLengthError(editContactFirstName, editContactLastName)}
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
              placeholder="e.g. hr@acmecorp.com"
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
            <Input
              label="Street or building address"
              placeholder="e.g. Bldg 4, Light Industry Park"
              value={editStreet}
              onChange={(e) => setEditStreet(e.target.value)}
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
            <div className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Compliance & SLA Configuration
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Review SLA threshold (days)"
                type="number"
                min={1}
                max={30}
                value={editReviewThresholdDays}
                onChange={(e) => setEditReviewThresholdDays(e.target.value)}
                helperText="Turnaround SLA (1 - 30 days, default: 5)"
                required
              />
              <Select
                label="Medical validity period"
                value={String(editMedicalValidityMonths)}
                onChange={(e) => setEditMedicalValidityMonths(Number(e.target.value))}
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
