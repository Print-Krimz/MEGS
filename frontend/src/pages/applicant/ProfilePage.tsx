import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantApi } from "../../lib/api/applicant.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  DocumentPreviewModal,
} from "../../components/common";
import {
  Input,
  Button,
  Textarea,
  Dialog,
  Select,
} from "../../components/ui";
import { formatDate, extractDocumentId } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { computeAutoFillDiff } from "../../lib/resume-autofill";
import {
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  Users,
  FolderOpen,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  FileCheck,
} from "lucide-react";

type ProfileTab =
  | "personal"
  | "documents"
  | "experience"
  | "education"
  | "skills"
  | "trainings"
  | "references"
  | "assets";

export const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const validTabs: ProfileTab[] = [
    "personal",
    "documents",
    "experience",
    "education",
    "skills",
    "trainings",
    "references",
    "assets",
  ];

  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (typeof window !== "undefined") {
      const paramTab = new URLSearchParams(window.location.search).get("tab") as ProfileTab;
      if (paramTab && validTabs.includes(paramTab)) {
        return paramTab;
      }
    }
    return "personal";
  });

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
  });

  const profile = profileQuery.data;

  // Document Preview State
  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    title?: string;
  } | null>(null);

  // Candidate Photo Error State
  const [imgError, setImgError] = useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [profile?.photoUrl]);

  const candidateInitials = `${profile?.firstName?.[0] || ""}${profile?.lastName?.[0] || ""}`.toUpperCase() || "AP";

  // Dialog States
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [eduModalOpen, setEduModalOpen] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "experience" | "education" | "training" | "reference" | "asset";
    id: number | string;
    label: string;
  } | null>(null);

  // Personal Info Form State
  const [personalForm, setPersonalForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    mobileNumber: "",
    gender: "",
    civilStatus: "",
    nationality: "",
    birthPlace: "",
    religion: "",
    height: "",
    weight: "",
    address: "",
    province: "",
    city: "",
    preferredWorkLocations: "",
    professionalSummary: "",
    sss: "",
    philhealth: "",
    pagibig: "",
    tin: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    emergencyContactAddress: "",
    additionalNotes: "",
  });

  // Skills input state
  const [skillInput, setSkillInput] = useState("");
  const [skillsList, setSkillsList] = useState<string[]>([]);

  // Auto-Fill & Extraction State
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // Update local form when data arrives
  React.useEffect(() => {
    if (profile) {
      setPersonalForm((prev) => ({
        firstName: prev.firstName || profile.firstName || "",
        lastName: prev.lastName || profile.lastName || "",
        middleName: prev.middleName || profile.middleName || "",
        dateOfBirth: prev.dateOfBirth || (profile.dateOfBirth ? profile.dateOfBirth.substring(0, 10) : ""),
        mobileNumber: prev.mobileNumber || profile.mobileNumber || "",
        gender: prev.gender || profile.gender || "",
        civilStatus: prev.civilStatus || profile.civilStatus || "",
        nationality: prev.nationality || profile.nationality || "",
        birthPlace: prev.birthPlace || profile.birthPlace || "",
        religion: prev.religion || profile.religion || "",
        height: prev.height || (profile.height !== null && profile.height !== undefined ? String(profile.height) : ""),
        weight: prev.weight || (profile.weight !== null && profile.weight !== undefined ? String(profile.weight) : ""),
        address: prev.address || profile.address || "",
        province: prev.province || profile.province || "",
        city: prev.city || profile.city || "",
        preferredWorkLocations: prev.preferredWorkLocations || profile.preferredWorkLocations || "",
        professionalSummary: prev.professionalSummary || profile.professionalSummary || "",
        sss: prev.sss || profile.sss || "",
        philhealth: prev.philhealth || profile.philhealth || "",
        pagibig: prev.pagibig || profile.pagibig || "",
        tin: prev.tin || profile.tin || "",
        emergencyContactName: prev.emergencyContactName || profile.emergencyContactName || "",
        emergencyContactPhone: prev.emergencyContactPhone || profile.emergencyContactPhone || "",
        emergencyContactRelationship: prev.emergencyContactRelationship || profile.emergencyContactRelationship || "",
        emergencyContactAddress: prev.emergencyContactAddress || profile.emergencyContactAddress || "",
        additionalNotes: prev.additionalNotes || profile.additionalNotes || "",
      }));

      if (profile.skills) {
        const parsed = profile.skills.map((s: any) =>
          typeof s === "string" ? s : s.name || s.skillName || ""
        ).filter(Boolean);
        setSkillsList((prev) => (prev.length > 0 ? prev : parsed));
      }
    }
  }, [profile]);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: applicantApi.upsertProfile,
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(["applicant", "profile"], savedProfile);
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      void refreshUser();
      setFeedback({ type: "success", message: "Personal information saved successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to save personal information: " + err.message });
    },
  });

  const uploadResumeMutation = useMutation({
    mutationFn: applicantApi.uploadResume,
    onSuccess: (data) => {
      if (data?.profile) {
        queryClient.setQueryData(["applicant", "profile"], data.profile);
      }
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      void refreshUser();

      if (data?.extractedData) {
        const diff = computeAutoFillDiff(personalForm, data.extractedData);

        // Apply newly auto-filled personal fields
        setPersonalForm((prev) => ({
          ...prev,
          firstName: prev.firstName || data.profile?.firstName || data.extractedData?.firstName || "",
          middleName: prev.middleName || data.profile?.middleName || data.extractedData?.middleName || "",
          lastName: prev.lastName || data.profile?.lastName || data.extractedData?.lastName || "",
          mobileNumber: prev.mobileNumber || data.profile?.mobileNumber || data.extractedData?.mobileNumber || "",
          dateOfBirth: prev.dateOfBirth || (data.profile?.dateOfBirth ? data.profile.dateOfBirth.substring(0, 10) : "") || data.extractedData?.dateOfBirth || "",
          birthPlace: prev.birthPlace || data.profile?.birthPlace || data.extractedData?.birthPlace || "",
          gender: prev.gender || data.profile?.gender || data.extractedData?.gender || "",
          civilStatus: prev.civilStatus || data.profile?.civilStatus || data.extractedData?.civilStatus || "",
          nationality: prev.nationality || data.profile?.nationality || data.extractedData?.nationality || "",
          religion: prev.religion || data.profile?.religion || data.extractedData?.religion || "",
          height: prev.height || (data.profile?.height !== null && data.profile?.height !== undefined ? String(data.profile.height) : "") || (data.extractedData?.height !== null && data.extractedData?.height !== undefined ? String(data.extractedData.height) : "") || "",
          weight: prev.weight || (data.profile?.weight !== null && data.profile?.weight !== undefined ? String(data.profile.weight) : "") || (data.extractedData?.weight !== null && data.extractedData?.weight !== undefined ? String(data.extractedData.weight) : "") || "",
          address: prev.address || data.profile?.address || data.extractedData?.address || "",
          province: prev.province || data.profile?.province || data.extractedData?.province || "",
          city: prev.city || data.profile?.city || data.extractedData?.city || "",
          preferredWorkLocations: prev.preferredWorkLocations || data.profile?.preferredWorkLocations || data.extractedData?.preferredWorkLocations || "",
          professionalSummary: prev.professionalSummary || data.profile?.professionalSummary || data.extractedData?.professionalSummary || "",
        }));

        setAutoFilledFields((prev) => {
          const next = new Set(prev);
          Object.keys(diff.autoFilledFields).forEach((k) => next.add(k));
          return next;
        });

        // Auto-populate skills list if extracted
        const extractedSkills = data.extractedData.skills;
        if (extractedSkills && extractedSkills.length > 0) {
          setSkillsList((prev) => {
            const combined = [...prev];
            extractedSkills.forEach((s) => {
              if (!combined.some((item) => item.toLowerCase() === s.toLowerCase())) {
                combined.push(s);
              }
            });
            return combined;
          });
        }

        setFeedback({
          type: "success",
          message: "Resume uploaded and profile details auto-filled successfully. Review and edit any field before saving.",
        });
      } else if (data?.extractionStatus === "UNAVAILABLE") {
        setFeedback({
          type: "success",
          message: "Resume uploaded. Automatic profile extraction was unavailable for this file format.",
        });
      } else {
        setFeedback({ type: "success", message: "Resume uploaded successfully." });
      }
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to upload resume: " + err.message });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: applicantApi.uploadPhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setFeedback({ type: "success", message: "Photo uploaded successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to upload photo: " + err.message });
    },
  });

  const addExpMutation = useMutation({
    mutationFn: applicantApi.addWorkExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setExpModalOpen(false);
      setFeedback({ type: "success", message: "Work experience added successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to add work experience." });
    },
  });

  const deleteExpMutation = useMutation({
    mutationFn: applicantApi.deleteWorkExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Work experience entry removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete work experience." });
    },
  });

  const addEduMutation = useMutation({
    mutationFn: applicantApi.addEducation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setEduModalOpen(false);
      setFeedback({ type: "success", message: "Education record added successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to add education record." });
    },
  });

  const deleteEduMutation = useMutation({
    mutationFn: applicantApi.deleteEducation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Education record removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete education record." });
    },
  });

  const updateSkillsMutation = useMutation({
    mutationFn: applicantApi.updateSkills,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setFeedback({ type: "success", message: "Skills updated successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to update skills." });
    },
  });

  const addTrainingMutation = useMutation({
    mutationFn: applicantApi.addTraining,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setTrainingModalOpen(false);
      setFeedback({ type: "success", message: "Training certification added successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to add training certification." });
    },
  });

  const deleteTrainingMutation = useMutation({
    mutationFn: applicantApi.deleteTraining,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Training certification removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete training certification." });
    },
  });

  const addRefMutation = useMutation({
    mutationFn: applicantApi.addReference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setRefModalOpen(false);
      setFeedback({ type: "success", message: "Character reference added successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to add character reference." });
    },
  });

  const deleteRefMutation = useMutation({
    mutationFn: applicantApi.deleteReference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Character reference removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete character reference." });
    },
  });

  const addAssetMutation = useMutation({
    mutationFn: applicantApi.addAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setAssetModalOpen(false);
      setFeedback({ type: "success", message: "Document uploaded successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to upload document." });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: applicantApi.deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Document removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete document." });
    },
  });

  const isNotFoundError =
    profileQuery.isError &&
    (profileQuery.error?.message?.includes("not found") ||
      profileQuery.error?.message?.includes("404") ||
      Boolean((profileQuery.error as any)?.status === 404));

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Profile" description="Loading profile..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (profileQuery.isError && !isNotFoundError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Profile" description="Manage your qualifications" />
        <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
      </div>
    );
  }

  // Work experience form submit
  const handleAddExp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addExpMutation.mutate({
      roleTitle: formData.get("jobTitle") as string,
      company: formData.get("companyName") as string,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
      isCurrent: formData.get("isCurrent") === "on",
      summary: (formData.get("responsibilities") as string) || undefined,
    });
  };

  // Education form submit
  const handleAddEdu = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addEduMutation.mutate({
      school: formData.get("schoolName") as string,
      degree: formData.get("degree") as string,
      fieldOfStudy: (formData.get("fieldOfStudy") as string) || "General",
      startDate: (formData.get("startDate") as string) || new Date().toISOString(),
      endDate: (formData.get("endDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    });
  };

  // Training form submit
  const handleAddTraining = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addTrainingMutation.mutate({
      title: formData.get("title") as string,
      provider: formData.get("issuer") as string,
      completionDate: (formData.get("issueDate") as string) || undefined,
    });
  };

  // Reference form submit
  const handleAddRef = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addRefMutation.mutate({
      name: formData.get("name") as string,
      relationship: formData.get("relationship") as string,
      phone: formData.get("contactNumber") as string,
      email: (formData.get("email") as string) || undefined,
    });
  };

  // Asset upload submit
  const handleAddAsset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addAssetMutation.mutate(formData);
  };

  // Skills add / remove
  const handleAddSkill = () => {
    if (!skillInput.trim()) return;
    if (skillsList.includes(skillInput.trim())) return;
    const updated = [...skillsList, skillInput.trim()];
    setSkillsList(updated);
    setSkillInput("");
    updateSkillsMutation.mutate(updated);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = skillsList.filter((s) => s !== skillToRemove);
    setSkillsList(updated);
    updateSkillsMutation.mutate(updated);
  };

  const tabs: { id: ProfileTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "documents", label: "Resume & Photo", icon: FileText },
    { id: "experience", label: "Work History", icon: Briefcase },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "skills", label: "Skills", icon: Award },
    { id: "trainings", label: "Trainings", icon: FileCheck },
    { id: "references", label: "References", icon: Users },
    { id: "assets", label: "201 Clearances", icon: FolderOpen },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Profile & Qualifications"
        description="Maintain verified identity, qualifications, and profile records"
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Profile" },
        ]}
      />

      {feedback && (
        <div
          className={`p-3 border-l-4 border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-700 text-teal-950"
              : "bg-rose-50 border-rose-700 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Navigation Sidebar */}
        <div className="lg:w-60 shrink-0">
          <div className="bg-white border border-slate-300 divide-y divide-slate-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors text-left ${
                    isActive
                      ? "bg-slate-900 text-white font-bold"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-teal-400" : "text-slate-400"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 bg-white border border-slate-300 p-5">
          {/* TAB 1: PERSONAL INFO */}
          {activeTab === "personal" && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-950">Personal Information</h3>
                <p className="text-[11px] text-slate-500 font-sans">
                  Ensure contact details and full legal name match government-issued identification.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateProfileMutation.mutate({
                    ...personalForm,
                    height: personalForm.height ? parseFloat(personalForm.height) : undefined,
                    weight: personalForm.weight ? parseFloat(personalForm.weight) : undefined,
                  });
                }}
                className="space-y-6"
              >
                {/* 1. Legal Name & Contact */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    1. Legal Identity & Contact Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="First Name"
                      value={personalForm.firstName}
                      helperText={autoFilledFields.has("firstName") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, firstName: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("firstName"); return n; });
                      }}
                      required
                    />
                    <Input
                      label="Middle Name"
                      value={personalForm.middleName}
                      helperText={autoFilledFields.has("middleName") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, middleName: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("middleName"); return n; });
                      }}
                    />
                    <Input
                      label="Last Name"
                      value={personalForm.lastName}
                      helperText={autoFilledFields.has("lastName") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, lastName: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("lastName"); return n; });
                      }}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="Contact Number"
                      placeholder="e.g. 09171234567"
                      value={personalForm.mobileNumber}
                      helperText={autoFilledFields.has("mobileNumber") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, mobileNumber: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("mobileNumber"); return n; });
                      }}
                      required
                    />
                    <Input
                      label="Date of Birth"
                      type="date"
                      value={personalForm.dateOfBirth}
                      helperText={autoFilledFields.has("dateOfBirth") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("dateOfBirth"); return n; });
                      }}
                    />
                    <Input
                      label="Place of Birth"
                      placeholder="e.g. Quezon City"
                      value={personalForm.birthPlace}
                      helperText={autoFilledFields.has("birthPlace") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, birthPlace: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("birthPlace"); return n; });
                      }}
                    />
                  </div>
                </div>

                {/* 2. Demographics & Physical */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    2. Demographics & Background
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Select
                      label="Gender"
                      value={personalForm.gender}
                      helperText={autoFilledFields.has("gender") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, gender: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("gender"); return n; });
                      }}
                      options={[
                        { value: "", label: "-- Select Gender --" },
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Non-Binary", label: "Non-Binary" },
                        { value: "Prefer not to say", label: "Prefer not to say" },
                      ]}
                    />
                    <Select
                      label="Civil Status"
                      value={personalForm.civilStatus}
                      helperText={autoFilledFields.has("civilStatus") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, civilStatus: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("civilStatus"); return n; });
                      }}
                      options={[
                        { value: "", label: "-- Select Status --" },
                        { value: "Single", label: "Single" },
                        { value: "Married", label: "Married" },
                        { value: "Widowed", label: "Widowed" },
                        { value: "Separated", label: "Separated" },
                        { value: "Divorced", label: "Divorced" },
                      ]}
                    />
                    <Input
                      label="Nationality"
                      placeholder="e.g. Filipino"
                      value={personalForm.nationality}
                      helperText={autoFilledFields.has("nationality") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, nationality: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("nationality"); return n; });
                      }}
                    />
                    <Input
                      label="Religion"
                      placeholder="e.g. Roman Catholic"
                      value={personalForm.religion}
                      helperText={autoFilledFields.has("religion") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, religion: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("religion"); return n; });
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="Height (cm)"
                      type="number"
                      placeholder="e.g. 170"
                      value={personalForm.height}
                      helperText={autoFilledFields.has("height") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, height: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("height"); return n; });
                      }}
                    />
                    <Input
                      label="Weight (kg)"
                      type="number"
                      placeholder="e.g. 65"
                      value={personalForm.weight}
                      helperText={autoFilledFields.has("weight") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, weight: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("weight"); return n; });
                      }}
                    />
                    <Input
                      label="Preferred Work Locations"
                      placeholder="e.g. Makati, Taguig, Ortigas, Remote"
                      value={personalForm.preferredWorkLocations}
                      helperText={autoFilledFields.has("preferredWorkLocations") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({
                          ...prev,
                          preferredWorkLocations: e.target.value,
                        }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("preferredWorkLocations"); return n; });
                      }}
                    />
                  </div>
                </div>

                {/* 3. Residential Address */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    3. Residential Address
                  </h4>
                  <Input
                    label="Complete Residential Address"
                    placeholder="House/Unit No., Street, Barangay"
                    value={personalForm.address}
                    helperText={autoFilledFields.has("address") ? "✓ Extracted from resume" : undefined}
                    onChange={(e) => {
                      setPersonalForm((prev) => ({ ...prev, address: e.target.value }));
                      setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("address"); return n; });
                    }}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Province / Region"
                      placeholder="e.g. Metro Manila"
                      value={personalForm.province}
                      helperText={autoFilledFields.has("province") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, province: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("province"); return n; });
                      }}
                    />
                    <Input
                      label="City / Municipality"
                      placeholder="e.g. Quezon City"
                      value={personalForm.city}
                      helperText={autoFilledFields.has("city") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, city: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("city"); return n; });
                      }}
                    />
                  </div>
                </div>

                {/* 4. Professional Summary */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    4. Professional Summary & Career Objective
                  </h4>
                  <Textarea
                    label="Professional Summary"
                    rows={3}
                    placeholder="Briefly describe your professional background, core expertise, and career objectives..."
                    value={personalForm.professionalSummary}
                    helperText={autoFilledFields.has("professionalSummary") ? "✓ Extracted from resume" : undefined}
                    onChange={(e) => {
                      setPersonalForm((prev) => ({
                        ...prev,
                        professionalSummary: e.target.value,
                      }));
                      setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("professionalSummary"); return n; });
                    }}
                  />
                </div>

                {/* 5. Statutory & Government ID Numbers */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    5. Statutory & Government ID Numbers (Optional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Input
                      label="SSS Number"
                      placeholder="e.g. 00-0000000-0"
                      value={personalForm.sss}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({ ...prev, sss: e.target.value }))
                      }
                    />
                    <Input
                      label="PhilHealth Number"
                      placeholder="e.g. 00-000000000-0"
                      value={personalForm.philhealth}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({ ...prev, philhealth: e.target.value }))
                      }
                    />
                    <Input
                      label="Pag-IBIG / HDMF Number"
                      placeholder="e.g. 0000-0000-0000"
                      value={personalForm.pagibig}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({ ...prev, pagibig: e.target.value }))
                      }
                    />
                    <Input
                      label="TIN Number"
                      placeholder="e.g. 000-000-000-000"
                      value={personalForm.tin}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({ ...prev, tin: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* 6. Emergency Contact */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    6. Emergency Contact Person
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="Contact Full Name"
                      placeholder="Full Name"
                      value={personalForm.emergencyContactName}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({
                          ...prev,
                          emergencyContactName: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Contact Number"
                      placeholder="e.g. 09181234567"
                      value={personalForm.emergencyContactPhone}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({
                          ...prev,
                          emergencyContactPhone: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Relationship"
                      placeholder="e.g. Spouse / Parent / Sibling"
                      value={personalForm.emergencyContactRelationship}
                      onChange={(e) =>
                        setPersonalForm((prev) => ({
                          ...prev,
                          emergencyContactRelationship: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Input
                    label="Emergency Contact Residential Address"
                    placeholder="Address of emergency contact person (optional)"
                    value={personalForm.emergencyContactAddress}
                    onChange={(e) =>
                      setPersonalForm((prev) => ({
                        ...prev,
                        emergencyContactAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* 7. Additional Notes */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    7. Additional Notes (Optional)
                  </h4>
                  <Textarea
                    label="Additional Notes / Remarks"
                    rows={2}
                    placeholder="Any special accommodations, schedule constraints, or additional remarks..."
                    value={personalForm.additionalNotes}
                    onChange={(e) =>
                      setPersonalForm((prev) => ({
                        ...prev,
                        additionalNotes: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={updateProfileMutation.isPending}
                  >
                    Save Personal Details
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: RESUME & PHOTO */}
          {activeTab === "documents" && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-950">Resume & Identification Photo</h3>
                <p className="text-[11px] text-slate-500 font-sans">
                  Upload latest curriculum vitae in PDF format and standard identity photo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Resume Box */}
                <div className="bg-slate-50 border border-slate-300 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 uppercase">
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    <span>Resume (PDF)</span>
                  </div>

                  {profile?.resumeUrl ? (
                    <div className="p-2.5 bg-white border border-slate-300 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span className="text-xs font-mono text-slate-800 truncate">
                          Resume on file
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs font-bold font-mono text-teal-800 uppercase hover:underline shrink-0 cursor-pointer"
                        onClick={() =>
                          setPreviewDocState({
                            open: true,
                            documentId: extractDocumentId(profile.resumeUrl),
                            title: "Resume",
                          })
                        }
                      >
                        View PDF
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 border border-dashed border-slate-300 text-center text-xs font-mono text-slate-500 bg-white">
                      No resume uploaded yet
                    </div>
                  )}

                  <label className="block">
                    <input
                      data-testid="resume-autofill-upload-input"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            setFeedback({ type: "error", message: "Maximum resume upload size is 5 MB." });
                            return;
                          }
                          const fd = new FormData();
                          fd.append("file", file);
                          uploadResumeMutation.mutate(fd);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                      loading={uploadResumeMutation.isPending}
                      className="w-full cursor-pointer"
                      onClick={(e) => {
                        const input = e.currentTarget.parentElement?.querySelector("input");
                        input?.click();
                      }}
                    >
                      {uploadResumeMutation.isPending ? "Reading Resume..." : "Upload Resume (PDF)"}
                    </Button>
                  </label>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Uploading a PDF resume extracts and auto-fills profile details for your review.
                  </p>
                </div>

                {/* Photo Box */}
                <div className="bg-slate-50 border border-slate-300 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 uppercase">
                    <User className="w-3.5 h-3.5 text-teal-700" />
                    <span>Candidate Photo</span>
                  </div>

                  {profile?.photoUrl ? (
                    <div className="flex items-center gap-3">
                      {!imgError ? (
                        <img
                          src={profile.photoUrl}
                          alt="Profile avatar"
                          className="w-14 h-14 object-cover border border-slate-400"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <div className="w-14 h-14 bg-slate-200 border border-slate-400 flex items-center justify-center font-bold text-slate-700 font-mono text-base">
                          {candidateInitials}
                        </div>
                      )}
                      <div className="text-xs text-slate-700 font-mono">
                        Active identity photo on file
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border border-dashed border-slate-300 text-center text-xs font-mono text-slate-500 bg-white">
                      No photo attached
                    </div>
                  )}

                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const fd = new FormData();
                          fd.append("file", file);
                          uploadPhotoMutation.mutate(fd);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                      loading={uploadPhotoMutation.isPending}
                      className="w-full cursor-pointer"
                      onClick={(e) => {
                        const input = e.currentTarget.parentElement?.querySelector("input");
                        input?.click();
                      }}
                    >
                      Upload Photo (PNG/JPG)
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WORK EXPERIENCE */}
          {activeTab === "experience" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">Work Experience History</h3>
                  <p className="text-xs text-slate-500">
                    Chronological employment background for manpower placement
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setExpModalOpen(true)}
                >
                  Add Experience
                </Button>
              </div>

              {!profile?.workExperiences || profile.workExperiences.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No work experience entries recorded. Click "Add Experience" to begin.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.workExperiences.map((exp: any) => (
                    <div key={exp.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">{exp.roleTitle}</div>
                        <div className="text-xs text-slate-700 font-medium">
                          {exp.company}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {formatDate(exp.startDate)} —{" "}
                          {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "N/A"}
                        </div>
                        {exp.summary && (
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                            {exp.summary}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: "experience",
                            id: exp.id,
                            label: `${exp.roleTitle} at ${exp.company}`,
                          })
                        }
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EDUCATION */}
          {activeTab === "education" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">Educational Attainment</h3>
                  <p className="text-xs text-slate-500">
                    Degrees, vocational courses, and academic background
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setEduModalOpen(true)}
                >
                  Add Education
                </Button>
              </div>

              {!profile?.educations || profile.educations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No education entries recorded. Click "Add Education" to begin.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.educations.map((edu: any) => (
                    <div key={edu.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">{edu.degree}</div>
                        <div className="text-xs text-slate-700 font-medium">
                          {edu.school}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {edu.fieldOfStudy && <span>{edu.fieldOfStudy} • </span>}
                          {edu.startDate && <span>From {formatDate(edu.startDate)} </span>}
                          {edu.endDate && <span>to {formatDate(edu.endDate)}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: "education",
                            id: edu.id,
                            label: `${edu.degree} from ${edu.school}`,
                          })
                        }
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SKILLS */}
          {activeTab === "skills" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Technical & Practical Skills</h3>
                <p className="text-xs text-slate-500">
                  List skills and competencies used for job matching and placement.
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Forklift Operation, CCTV Monitoring, Python, Customer Care"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="flex-1"
                />
                <Button variant="primary" size="md" onClick={handleAddSkill}>
                  Add Skill
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {skillsList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 w-full">
                    No skills added yet. Type a skill name and press Enter.
                  </div>
                ) : (
                  skillsList.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-900 border border-slate-300 font-mono text-[11px] font-bold uppercase"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-rose-700 focus:outline-none font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: TRAININGS & CERTIFICATIONS */}
          {activeTab === "trainings" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">
                    Certifications & Seminars
                  </h3>
                  <p className="text-xs text-slate-500">
                    TESDA, safety certifications, and industry trainings
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setTrainingModalOpen(true)}
                >
                  Add Training
                </Button>
              </div>

              {!profile?.trainings || profile.trainings.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No training records added. Click "Add Training" to record credentials.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.trainings.map((t: any) => (
                    <div key={t.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">{t.title}</div>
                        <div className="text-xs text-slate-700 font-medium">{t.provider}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {t.completionDate && <span>Completed: {formatDate(t.completionDate)}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: "training",
                            id: t.id,
                            label: t.title,
                          })
                        }
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: CHARACTER REFERENCES */}
          {activeTab === "references" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">Character References</h3>
                  <p className="text-xs text-slate-500">
                    Professional and personal references for background verification
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setRefModalOpen(true)}
                >
                  Add Reference
                </Button>
              </div>

              {!profile?.characterReferences || profile.characterReferences.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No references listed. Click "Add Reference" to record contacts.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.characterReferences.map((r: any) => (
                    <div key={r.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-700 font-medium">
                          {r.relationship}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          <span>Phone: {r.phone}</span>
                          {r.email && <span> • Email: {r.email}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            type: "reference",
                            id: r.id,
                            label: r.name,
                          })
                        }
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 9: 201 CLEARANCES & ASSETS */}
          {activeTab === "assets" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">
                    Pre-Employment 201 Clearances & Assets
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload NBI clearance, SSS, PhilHealth, Pag-IBIG, and medical clearance files
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setAssetModalOpen(true)}
                >
                  Upload Document
                </Button>
              </div>

              {!profile?.assets || profile.assets.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No 201 compliance documents uploaded. Click "Upload Document" to attach government clearances.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.assets.map((asset: any) => (
                    <div key={asset.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">{asset.label}</div>
                        <div className="text-xs text-slate-600 font-mono">
                          Type: {asset.documentType || "Government Clearance"}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Uploaded: {formatDate(asset.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.fileUrl && (
                          <a
                            href={asset.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-teal-700 hover:underline"
                          >
                            View
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({
                              type: "asset",
                              id: asset.id,
                              label: asset.label,
                            })
                          }
                          className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Experience Modal */}
      <Dialog
        open={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        title="Add Work Experience"
        description="Record a previous employment role"
      >
        <form onSubmit={handleAddExp} className="space-y-4">
          <Input label="Job Title / Position" name="jobTitle" required />
          <Input label="Company / Employer Name" name="companyName" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" name="startDate" required />
            <Input label="End Date" type="date" name="endDate" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isCurrent" name="isCurrent" className="rounded text-teal-600" />
            <label htmlFor="isCurrent" className="text-xs text-slate-700">
              I currently work in this position
            </label>
          </div>
          <Textarea label="Responsibilities & Duties" name="responsibilities" rows={3} />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setExpModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addExpMutation.isPending}>
              Save Experience
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Education Modal */}
      <Dialog
        open={eduModalOpen}
        onClose={() => setEduModalOpen(false)}
        title="Add Educational Background"
        description="Record a degree, diploma, or certificate"
      >
        <form onSubmit={handleAddEdu} className="space-y-4">
          <Input label="School / Institution Name" name="schoolName" required />
          <Input label="Degree / Course Level" name="degree" placeholder="e.g. High School Diploma, BS Nursing" required />
          <Input label="Field of Study" name="fieldOfStudy" placeholder="e.g. General Sciences, Electrical" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" name="startDate" />
            <Input label="End Date" type="date" name="endDate" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEduModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addEduMutation.isPending}>
              Save Education
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Training Modal */}
      <Dialog
        open={trainingModalOpen}
        onClose={() => setTrainingModalOpen(false)}
        title="Add Training or Certification"
        description="Record industry credentials"
      >
        <form onSubmit={handleAddTraining} className="space-y-4">
          <Input label="Certificate / Course Title" name="title" required />
          <Input label="Issuing Organization" name="issuer" placeholder="e.g. TESDA, Red Cross, DOLE" required />
          <Input label="Completion Date" type="date" name="issueDate" />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setTrainingModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addTrainingMutation.isPending}>
              Save Training
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Reference Modal */}
      <Dialog
        open={refModalOpen}
        onClose={() => setRefModalOpen(false)}
        title="Add Character Reference"
        description="Record a professional or personal contact"
      >
        <form onSubmit={handleAddRef} className="space-y-4">
          <Input label="Contact Full Name" name="name" required />
          <Input label="Relationship / Title" name="relationship" placeholder="e.g. Former Supervisor" required />
          <Input label="Contact Phone Number" name="contactNumber" required />
          <Input label="Email Address" type="email" name="email" />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setRefModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addRefMutation.isPending}>
              Save Reference
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Asset Modal */}
      <Dialog
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        title="Upload 201 Document / Clearance"
        description="Attach PDF or image scan of pre-employment clearance"
      >
        <form onSubmit={handleAddAsset} className="space-y-4">
          <Input label="Document Label / Title" name="label" placeholder="e.g. NBI Clearance, SSS Form, Medical Certificate" required />
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Clearance File (PDF or Image) <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              name="file"
              required
              className="block w-full text-xs text-slate-700 border border-slate-300 rounded-lg file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setAssetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addAssetMutation.isPending}>
              Upload Clearance
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Item Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "experience") deleteExpMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "education") deleteEduMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "training") deleteTrainingMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "reference") deleteRefMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "asset") deleteAssetMutation.mutate(deleteTarget.id);
        }}
        variant="danger"
        title="Delete Qualification Entry"
        description={`Are you sure you want to remove ${deleteTarget?.label || "this record"}? This action cannot be undone.`}
        confirmLabel="Remove Entry"
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDocState?.open)}
        onClose={() => setPreviewDocState(null)}
        documentId={previewDocState?.documentId}
        title={previewDocState?.title}
      />
    </div>
  );
};
