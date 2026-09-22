import React, { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader } from "../../components/common";
import { Button, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { ArrowLeft, Send, Building2 } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  MRF_EDUCATION_OPTIONS,
  MRF_EXPERIENCE_OPTIONS,
} from "../../lib/hr-constants";
import { TA_COPY } from "../../lib/ta-copy";

export const MRFCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [headcount, setHeadcount] = useState<number>(1);
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [location, setLocation] = useState("");
  const [targetFillDate, setTargetFillDate] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [requiredExperience, setRequiredExperience] = useState("");
  const [requiredEducation, setRequiredEducation] = useState("");
  const [requiredCertifications, setRequiredCertifications] = useState("");
  const [description, setDescription] = useState("");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [employmentType, setEmploymentType] = useState("Contractual");
  const [workArrangement, setWorkArrangement] = useState("On-site");

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const createMRFMutation = useMutation({
    mutationFn: taApi.createMRF,
    onSuccess: (newMRF) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      notify.success("Manpower request created", `Request #${newMRF.id} (${newMRF.title}) is ready.`);
      navigate({
        to: "/ta/mrfs/$mrfId",
        params: { mrfId: String(newMRF.id) },
      });
    },
    onError: (err: any) => {
      const formatted = formatErrorMessage(err);
      setValidationError("Unable to create this manpower request: " + formatted);
      notify.error("Unable to create request", err);
    },
  });

  const clients = clientsQuery.data || [];

  const handleClientChange = (val: string) => {
    const numericId = Number(val);
    setClientId(numericId);
    if (numericId) {
      const chosenClient = clients.find((c) => c.id === numericId);
      if (chosenClient) {
        const fullAddr = [chosenClient.street, chosenClient.city, chosenClient.province, chosenClient.postalCode]
          .filter(Boolean)
          .join(", ") || chosenClient.address;
        if (fullAddr && (!location || location === "Philippines")) {
          setLocation(fullAddr);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setValidationError("Please select a client account before submitting.");
      return;
    }

    setValidationError(null);
    createMRFMutation.mutate({
      clientId,
      title,
      headcount,
      priority,
      location: location || undefined,
      targetFillDate: targetFillDate ? new Date(targetFillDate).toISOString() : undefined,
      requiredSkills: requiredSkills || undefined,
      requiredExperience: requiredExperience || undefined,
      requiredEducation: requiredEducation || undefined,
      requiredCertifications: requiredCertifications || undefined,
      description: description || undefined,
      salaryRangeMin: salaryMin ? Number(salaryMin) : undefined,
      salaryRangeMax: salaryMax ? Number(salaryMax) : undefined,
      employmentType,
      workArrangement,
    });
  };

  const clientOptions = clients.map((c) => ({
    value: String(c.id),
    label: c.tradeName ? `${c.name} (${c.tradeName})` : c.name,
    subtitle: `${c.industry || "General Industry"} • ${[c.city, c.province].filter(Boolean).join(", ") || c.address || "Philippines"}`,
    badge: `ID #${c.id}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create manpower request (MRF)"
        description="Tell us how many workers the client needs and when they are needed."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.manpowerRequests, href: "/ta/mrfs" },
          { label: "Create" },
        ]}
        actions={
          <Link to="/ta/mrfs">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to requests
            </Button>
          </Link>
        }
      />

      {validationError && (
        <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-800 text-xs font-mono flex items-center justify-between" role="alert" aria-live="assertive">
          <span>{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            aria-label="Dismiss error"
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
        {/* Core Order Information */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
            Request details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboBox
              label="Client"
              placeholder="Search or select client account..."
              leftIcon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
              value={clientId ? String(clientId) : ""}
              onChange={handleClientChange}
              options={clientOptions}
              emptyText="No client accounts match your search"
              required
            />
            <Input
              label="Request title"
              placeholder="e.g. 50x Forklift Operators - Warehouse Expansion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Number of workers needed"
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              required
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              options={[
                { value: "LOW", label: "Low" },
                { value: "NORMAL", label: "Normal" },
                { value: "HIGH", label: "High" },
                { value: "URGENT", label: "Urgent — critical need" },
              ]}
            />
            <Input
              label="Target fill date"
              type="date"
              value={targetFillDate}
              onChange={(e) => setTargetFillDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Work site"
              placeholder="e.g. Calamba, Laguna Plant"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <ComboBox
              label="Employment Type"
              placeholder="Select employment type..."
              value={employmentType}
              onChange={(val) => setEmploymentType(val || "Contractual")}
              options={EMPLOYMENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
              allowCustom
              required
            />
            <ComboBox
              label="Work Arrangement"
              placeholder="Select arrangement..."
              value={workArrangement}
              onChange={(val) => setWorkArrangement(val || "On-site")}
              options={WORK_ARRANGEMENT_OPTIONS.map((w) => ({ value: w, label: w }))}
              allowCustom
              required
            />
          </div>
        </div>

        {/* Skills & Compensation */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
            Skills and qualifications
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Minimum monthly salary (PHP)"
              type="number"
              placeholder="e.g. 18000"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
            />
            <Input
              label="Maximum monthly salary (PHP)"
              type="number"
              placeholder="e.g. 25000"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
            />
          </div>

          <Input
            label="Required skills"
            placeholder="e.g. Forklift Operation, Heavy Machinery, Safety Certified"
            value={requiredSkills}
            onChange={(e) => setRequiredSkills(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComboBox
              label="Required experience"
              placeholder="Select or specify required experience..."
              value={requiredExperience}
              onChange={(val) => setRequiredExperience(val || "")}
              options={MRF_EXPERIENCE_OPTIONS.map((e) => ({ value: e, label: e }))}
              allowCustom
            />
            <ComboBox
              label="Minimum education"
              placeholder="Select minimum education..."
              value={requiredEducation}
              onChange={(val) => setRequiredEducation(val || "")}
              options={MRF_EDUCATION_OPTIONS.map((ed) => ({ value: ed, label: ed }))}
            />
          </div>

          <Input
            label="Required certifications & licenses"
            placeholder="e.g. Professional Driver's License (Code 2/3), TESDA NC II Automotive Servicing, PRC License"
            value={requiredCertifications}
            onChange={(e) => setRequiredCertifications(e.target.value)}
          />

          <Textarea
            label="Notes for this client"
            placeholder="Specify shift schedules, client site notes, uniform provisions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100">
          <Link to="/ta/mrfs" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={createMRFMutation.isPending}
            leftIcon={<Send className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto"
          >
              Create request
          </Button>
        </div>
      </form>
    </div>
  );
};
