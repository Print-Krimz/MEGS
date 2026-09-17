import React, { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader } from "../../components/common";
import { Button, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { ArrowLeft, Send, Building2 } from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";
import { EMPLOYMENT_TYPE_OPTIONS, WORK_ARRANGEMENT_OPTIONS } from "../../lib/hr-constants";

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
      notify.success("Manpower Request Created", `Requisition #${newMRF.id} (${newMRF.title}) registered.`);
      navigate({
        to: "/ta/mrfs/$mrfId",
        params: { mrfId: String(newMRF.id) },
      });
    },
    onError: (err: any) => {
      const formatted = formatErrorMessage(err);
      setValidationError("Failed to create MRF: " + formatted);
      notify.error("Creation Failed", err);
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
        title="Create Manpower Request (MRF)"
        description="Register a client labor requisition order with headcount allocation and compliance templates"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Manpower Requests", href: "/ta/mrfs" },
          { label: "Create" },
        ]}
        actions={
          <Link to="/ta/mrfs">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to List
            </Button>
          </Link>
        }
      />

      {validationError && (
        <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-800 text-xs font-mono flex items-center justify-between">
          <span>{validationError}</span>
          <button
            onClick={() => setValidationError(null)}
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
            Requisition Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboBox
              label="Client Account"
              placeholder="Search or select client account..."
              leftIcon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
              value={clientId ? String(clientId) : ""}
              onChange={handleClientChange}
              options={clientOptions}
              emptyText="No client accounts match your search"
              required
            />
            <Input
              label="Requisition Order Title"
              placeholder="e.g. 50x Forklift Operators - Warehouse Expansion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Target Headcount (pax)"
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              required
            />
            <Select
              label="Fulfillment Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              options={[
                { value: "LOW", label: "LOW" },
                { value: "NORMAL", label: "NORMAL" },
                { value: "HIGH", label: "HIGH" },
                { value: "URGENT", label: "URGENT (Critical Need)" },
              ]}
            />
            <Input
              label="Target Fill Date"
              type="date"
              value={targetFillDate}
              onChange={(e) => setTargetFillDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Work / Site Location"
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
            Qualifications & Compensation Range
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Minimum Monthly Compensation (PHP)"
              type="number"
              placeholder="e.g. 18000"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
            />
            <Input
              label="Maximum Monthly Compensation (PHP)"
              type="number"
              placeholder="e.g. 25000"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
            />
          </div>

          <Input
            label="Required Competencies / Keywords"
            placeholder="e.g. Forklift Operation, Heavy Machinery, Safety Certified"
            value={requiredSkills}
            onChange={(e) => setRequiredSkills(e.target.value)}
          />

          <Textarea
            label="Order Description & Client Specifics"
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
            Create Manpower Request
          </Button>
        </div>
      </form>
    </div>
  );
};
