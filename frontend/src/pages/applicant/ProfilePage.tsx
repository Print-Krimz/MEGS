import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
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
  PhoneInput,
} from "../../components/ui";
import { SkillsSection } from "../../components/applicant/SkillsSection";
import { formatDate, extractDocumentId } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import {
  computeAutoFillDiff,
  filterDuplicateEducations,
  filterDuplicateExperiences,
  filterDuplicateReferences,
  filterDuplicateSkills,
  filterDuplicateTrainings,
} from "../../lib/resume-autofill";
import { ProfileApplications } from "./components/profile/ProfileApplications";
import { ProfileDisclosure } from "./components/profile/ProfileDisclosure";
import { ProfileOverview } from "./components/profile/ProfileOverview";
import { ProfileSectionNav } from "./components/profile/ProfileSectionNav";
import type { ProfileSection } from "./components/profile/profile-navigation";
import { parseProfileSection } from "./components/profile/profile-navigation";
import type { ResumeReviewSummary } from "./components/profile/profile-types";
import {
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";

export const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { refreshUser, user } = useAuth();
  const navigate = useNavigate({ from: "/app/profile" });

  const [activeSection, setActiveSection] = useState<ProfileSection>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return parseProfileSection(params.get("section"), params.get("tab"));
    }
    return "overview";
  });

  const [openPersonalSection, setOpenPersonalSection] = useState("identity");
  const [openQualificationSection, setOpenQualificationSection] = useState("experience");

  const handleSectionChange = (section: ProfileSection) => {
    setActiveSection(section);
    void navigate({
      search: (previous) => ({ ...previous, section, tab: undefined }),
      replace: true,
    });
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
    fileUrl?: string | null;
    title?: string;
  } | null>(null);

  // Candidate Photo Error State
  const [imgError, setImgError] = useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [profile?.photoUrl]);

  const candidateInitials = `${profile?.firstName?.[0] || ""}${profile?.lastName?.[0] || ""}`.toUpperCase() || "AP";

  // Dialog & Editing States
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<any | null>(null);

  const [eduModalOpen, setEduModalOpen] = useState(false);
  const [editingEdu, setEditingEdu] = useState<any | null>(null);

  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any | null>(null);

  const [refModalOpen, setRefModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<any | null>(null);
  const [refPhone, setRefPhone] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "experience" | "education" | "training" | "reference";
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

  // Skills state
  const [skillsList, setSkillsList] = useState<string[]>([]);

  // Auto-Fill & Extraction State
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [resumeReview, setResumeReview] = useState<ResumeReviewSummary | null>(null);

  // Update local form when data arrives
  React.useEffect(() => {
    if (profile) {
      setPersonalForm((prev) => ({
        firstName: profile.firstName || prev.firstName || "",
        lastName: profile.lastName || prev.lastName || "",
        middleName: profile.middleName || prev.middleName || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.substring(0, 10) : prev.dateOfBirth || "",
        mobileNumber: profile.mobileNumber || prev.mobileNumber || "",
        gender: profile.gender || prev.gender || "",
        civilStatus: profile.civilStatus || prev.civilStatus || "",
        nationality: profile.nationality || prev.nationality || "",
        birthPlace: profile.birthPlace || prev.birthPlace || "",
        religion: profile.religion || prev.religion || "",
        height: profile.height !== null && profile.height !== undefined ? String(profile.height) : prev.height || "",
        weight: profile.weight !== null && profile.weight !== undefined ? String(profile.weight) : prev.weight || "",
        address: profile.address || prev.address || "",
        province: profile.province || prev.province || "",
        city: profile.city || prev.city || "",
        preferredWorkLocations: profile.preferredWorkLocations || prev.preferredWorkLocations || "",
        professionalSummary: profile.professionalSummary || prev.professionalSummary || "",
        sss: profile.sss || prev.sss || "",
        philhealth: profile.philhealth || prev.philhealth || "",
        pagibig: profile.pagibig || prev.pagibig || "",
        tin: profile.tin || prev.tin || "",
        emergencyContactName: profile.emergencyContactName || prev.emergencyContactName || "",
        emergencyContactPhone: profile.emergencyContactPhone || prev.emergencyContactPhone || "",
        emergencyContactRelationship: profile.emergencyContactRelationship || prev.emergencyContactRelationship || "",
        emergencyContactAddress: profile.emergencyContactAddress || prev.emergencyContactAddress || "",
        additionalNotes: profile.additionalNotes || prev.additionalNotes || "",
      }));

      if (profile.skills && profile.skills.length > 0) {
        const parsed = profile.skills.map((s: any) =>
          typeof s === "string" ? s : s.name || s.skillName || ""
        ).filter(Boolean);
        setSkillsList(parsed);
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
        const previousProfile = profile;
        const experienceDiff = filterDuplicateExperiences(
          previousProfile?.workExperiences || [],
          data.extractedData.workExperiences || [],
        );
        const educationDiff = filterDuplicateEducations(
          previousProfile?.educations || [],
          data.extractedData.educations || [],
        );
        const skillsDiff = filterDuplicateSkills(
          previousProfile?.skills || [],
          data.extractedData.skills || [],
        );
        const trainingDiff = filterDuplicateTrainings(
          previousProfile?.trainings || [],
          data.extractedData.trainings || [],
        );
        const referenceDiff = filterDuplicateReferences(
          previousProfile?.characterReferences || [],
          data.extractedData.characterReferences || [],
        );
        const firstQualificationSection = experienceDiff.newItems.length > 0
          ? "experience"
          : educationDiff.newItems.length > 0
            ? "education"
            : skillsDiff.newItems.length > 0
              ? "skills"
              : trainingDiff.newItems.length > 0
                ? "trainings"
                : referenceDiff.newItems.length > 0
                  ? "references"
                  : undefined;
        setResumeReview({
          personalFields: Object.keys(diff.autoFilledFields),
          workExperienceCount: experienceDiff.newItems.length,
          educationCount: educationDiff.newItems.length,
          skillsCount: skillsDiff.newItems.length,
          trainingCount: trainingDiff.newItems.length,
          referenceCount: referenceDiff.newItems.length,
          firstSection: Object.keys(diff.autoFilledFields).length > 0
            ? "personal"
            : firstQualificationSection
              ? "qualifications"
              : "overview",
          firstQualificationSection,
        });

        const p = data.profile || {};
        const ext = data.extractedData || {};
        setPersonalForm({
          firstName: ext.firstName || p.firstName || "",
          middleName: ext.middleName ?? p.middleName ?? "",
          lastName: ext.lastName || p.lastName || "",
          mobileNumber: ext.mobileNumber || p.mobileNumber || "",
          dateOfBirth: ext.dateOfBirth || (p.dateOfBirth ? p.dateOfBirth.substring(0, 10) : "") || "",
          birthPlace: ext.birthPlace || p.birthPlace || "",
          gender: ext.gender || p.gender || "",
          civilStatus: ext.civilStatus || p.civilStatus || "",
          nationality: ext.nationality || p.nationality || "",
          religion: ext.religion || p.religion || "",
          height: ext.height !== null && ext.height !== undefined ? String(ext.height) : p.height !== null && p.height !== undefined ? String(p.height) : "",
          weight: ext.weight !== null && ext.weight !== undefined ? String(ext.weight) : p.weight !== null && p.weight !== undefined ? String(p.weight) : "",
          address: ext.address || p.address || "",
          province: ext.province || p.province || "",
          city: ext.city || p.city || "",
          preferredWorkLocations: ext.preferredWorkLocations || p.preferredWorkLocations || "",
          professionalSummary: ext.professionalSummary || p.professionalSummary || "",
          sss: p.sss || "",
          philhealth: p.philhealth || "",
          pagibig: p.pagibig || "",
          tin: p.tin || "",
          emergencyContactName: p.emergencyContactName || "",
          emergencyContactPhone: p.emergencyContactPhone || "",
          emergencyContactRelationship: p.emergencyContactRelationship || "",
          emergencyContactAddress: p.emergencyContactAddress || "",
          additionalNotes: p.additionalNotes || "",
        });

        setAutoFilledFields((prev) => {
          const next = new Set(prev);
          Object.keys(diff.autoFilledFields).forEach((k) => next.add(k));
          return next;
        });

        if (p.skills && p.skills.length > 0) {
          const parsed = p.skills.map((s: any) => typeof s === "string" ? s : s.name || s.skillName || "").filter(Boolean);
          setSkillsList(parsed);
        } else if (ext.skills && ext.skills.length > 0) {
          setSkillsList(ext.skills);
        }

        setFeedback({
          type: "success",
          message: "Resume parsed — your profile has been filled automatically. Review the details below.",
        });
      } else if (data?.extractionStatus === "UNAVAILABLE") {
        setResumeReview(null);
        setFeedback({
          type: "success",
          message: "Resume uploaded, but we couldn't fill profile details from this file. You can enter them manually or try another PDF.",
        });
      } else {
        setResumeReview(null);
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
    mutationFn: async (payload: { roleTitle: string; company: string; startDate: string; endDate?: string; isCurrent: boolean; summary?: string; previousId?: number | string }) => {
      if (payload.previousId) {
        await applicantApi.deleteWorkExperience(payload.previousId);
      }
      return applicantApi.addWorkExperience(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setExpModalOpen(false);
      setEditingExp(null);
      setFeedback({ type: "success", message: "Work experience saved successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to save work experience." });
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
    mutationFn: async (payload: { school: string; degree: string; fieldOfStudy: string; startDate: string; endDate?: string; notes?: string; previousId?: number | string }) => {
      if (payload.previousId) {
        await applicantApi.deleteEducation(payload.previousId);
      }
      return applicantApi.addEducation(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setEduModalOpen(false);
      setEditingEdu(null);
      setFeedback({ type: "success", message: "Education record saved successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to save education record." });
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
    mutationFn: async (payload: { title: string; provider: string; completionDate?: string; previousId?: number | string }) => {
      if (payload.previousId) {
        await applicantApi.deleteTraining(payload.previousId);
      }
      return applicantApi.addTraining(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setTrainingModalOpen(false);
      setEditingTraining(null);
      setFeedback({ type: "success", message: "Training certification saved successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to save training certification." });
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
    mutationFn: async (payload: { name: string; relationship: string; phone: string; email?: string; previousId?: number | string }) => {
      if (payload.previousId) {
        await applicantApi.deleteReference(payload.previousId);
      }
      return applicantApi.addReference(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setRefModalOpen(false);
      setEditingRef(null);
      setFeedback({ type: "success", message: "Character reference saved successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to save character reference." });
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


  const isNotFoundError =
    profileQuery.isError &&
    (profileQuery.error?.message?.includes("not found") ||
      profileQuery.error?.message?.includes("404") ||
      Boolean((profileQuery.error as any)?.status === 404));

  const profileFormSnapshot = profile
    ? {
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        middleName: profile.middleName || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.substring(0, 10) : "",
        mobileNumber: profile.mobileNumber || "",
        gender: profile.gender || "",
        civilStatus: profile.civilStatus || "",
        nationality: profile.nationality || "",
        birthPlace: profile.birthPlace || "",
        religion: profile.religion || "",
        height: profile.height === null || profile.height === undefined ? "" : String(profile.height),
        weight: profile.weight === null || profile.weight === undefined ? "" : String(profile.weight),
        address: profile.address || "",
        province: profile.province || "",
        city: profile.city || "",
        preferredWorkLocations: profile.preferredWorkLocations || "",
        professionalSummary: profile.professionalSummary || "",
        sss: profile.sss || "",
        philhealth: profile.philhealth || "",
        pagibig: profile.pagibig || "",
        tin: profile.tin || "",
        emergencyContactName: profile.emergencyContactName || "",
        emergencyContactPhone: profile.emergencyContactPhone || "",
        emergencyContactRelationship: profile.emergencyContactRelationship || "",
        emergencyContactAddress: profile.emergencyContactAddress || "",
        additionalNotes: profile.additionalNotes || "",
      }
    : null;
  const personalFormDirty = Boolean(profileFormSnapshot && JSON.stringify(personalForm) !== JSON.stringify(profileFormSnapshot));
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => personalFormDirty && current.pathname !== next.pathname,
    enableBeforeUnload: personalFormDirty,
    withResolver: true,
  });

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
  const handleSaveExp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addExpMutation.mutate({
      roleTitle: formData.get("jobTitle") as string,
      company: formData.get("companyName") as string,
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || undefined,
      isCurrent: formData.get("isCurrent") === "on",
      summary: (formData.get("responsibilities") as string) || undefined,
      previousId: editingExp?.id,
    });
  };

  // Education form submit
  const handleSaveEdu = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addEduMutation.mutate({
      school: formData.get("schoolName") as string,
      degree: formData.get("degree") as string,
      fieldOfStudy: (formData.get("fieldOfStudy") as string) || "General",
      startDate: (formData.get("startDate") as string) || new Date().toISOString(),
      endDate: (formData.get("endDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      previousId: editingEdu?.id,
    });
  };

  // Training form submit
  const handleSaveTraining = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addTrainingMutation.mutate({
      title: formData.get("title") as string,
      provider: formData.get("issuer") as string,
      completionDate: (formData.get("issueDate") as string) || undefined,
      previousId: editingTraining?.id,
    });
  };

  // Reference form submit
  const handleSaveRef = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addRefMutation.mutate({
      name: formData.get("name") as string,
      relationship: formData.get("relationship") as string,
      phone: refPhone,
      email: (formData.get("email") as string) || undefined,
      previousId: editingRef?.id,
    });
  };

  // Skills add / remove
  const handleAddSkill = (newSkill: string) => {
    if (!newSkill.trim()) return;
    if (skillsList.some((s) => s.toLowerCase() === newSkill.trim().toLowerCase())) return;
    const updated = [...skillsList, newSkill.trim()];
    setSkillsList(updated);
    updateSkillsMutation.mutate(updated);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = skillsList.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase());
    setSkillsList(updated);
    updateSkillsMutation.mutate(updated);
  };

  const handleCompleteNextSection = (target: string) => {
    if (target.includes("resume")) handleSectionChange("overview");
    else if (target.includes("experience") || target.includes("education") || target.includes("skill") || target.includes("reference")) {
      handleSectionChange("qualifications");
    } else handleSectionChange("personal");
  };

  const handleReviewResume = () => {
    if (!resumeReview) return;
    if (resumeReview.firstSection === "personal") {
      setOpenPersonalSection("identity");
      handleSectionChange("personal");
    } else if (resumeReview.firstSection === "qualifications") {
      setOpenQualificationSection(resumeReview.firstQualificationSection || "experience");
      handleSectionChange("qualifications");
    } else {
      handleSectionChange("overview");
      window.setTimeout(() => document.getElementById("overview-resume-panel")?.focus(), 0);
    }
  };

  const handlePhotoFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Maximum photo upload size is 5 MB." });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if ((file.type && !["image/jpeg", "image/png", "image/jpg"].includes(file.type)) || !["jpg", "jpeg", "png"].includes(ext || "")) {
      setFeedback({ type: "error", message: "Invalid photo format. Only JPG and PNG files up to 5 MB are accepted." });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    uploadPhotoMutation.mutate(formData);
  };

  const handleResumeFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Maximum resume upload size is 5 MB." });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if ((file.type && file.type !== "application/pdf") || ext !== "pdf") {
      setFeedback({ type: "error", message: "Invalid file format. Only PDF files up to 5 MB are accepted." });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    uploadResumeMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Profile"
        description="Keep your profile ready for the next opportunity"
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Profile" },
        ]}
      />

      {feedback && !(activeSection === "overview" && resumeReview && feedback.type === "success" && feedback.message.startsWith("Resume parsed")) && (
        <div
          className={`p-3.5 rounded-md border text-sm font-sans flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#E8EEF6] border-[#0F294A]/30 text-[#0F294A]"
              : "bg-rose-50 border-rose-300 text-rose-950"
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4 cursor-pointer text-base"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <ProfileSectionNav activeSection={activeSection} onChange={handleSectionChange} />

      <div
        id={`profile-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeSection}`}
        tabIndex={0}
        className="bg-white border border-slate-200 p-4 sm:p-6 shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-2"
      >
          {activeSection === "overview" && (
            <ProfileOverview
              profile={profile}
              user={user}
              candidateInitials={candidateInitials}
              imgError={imgError}
              onImageError={() => setImgError(true)}
              onPhotoFile={handlePhotoFile}
              photoUploadPending={uploadPhotoMutation.isPending}
              onResumeFile={handleResumeFile}
              resumeUploadPending={uploadResumeMutation.isPending}
              resumeReview={resumeReview}
              onViewPdf={() => {
                if (profile?.resumeUrl) {
                  setPreviewDocState({
                    open: true,
                    documentId: extractDocumentId(profile.resumeUrl),
                    fileUrl: profile.resumeUrl,
                    title: "Resume",
                  });
                }
              }}
              onReviewResume={handleReviewResume}
              onNavigate={handleSectionChange}
              onJumpToSection={handleCompleteNextSection}
              skills={skillsList}
            />
          )}

          {/* TAB 1: PERSONAL INFO */}
          {activeSection === "personal" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
                <p className="text-xs text-slate-500">
                  Ensure contact details and full legal name match your government-issued identification.
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
                <ProfileDisclosure
                  id="profile-personal-identity"
                  title="Identity & contact"
                  summary="Your legal name and primary contact details"
                  open={openPersonalSection === "identity"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "identity" ? "" : "identity")}
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
                    <PhoneInput
                      label="Contact Number"
                      value={personalForm.mobileNumber}
                      helperText={autoFilledFields.has("mobileNumber") ? "✓ Extracted from resume" : undefined}
                      onChange={(val) => {
                        setPersonalForm((prev) => ({ ...prev, mobileNumber: val }));
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
                      placeholder="e.g. Quezon City, Rizal"
                      value={personalForm.birthPlace}
                      helperText={autoFilledFields.has("birthPlace") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, birthPlace: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("birthPlace"); return n; });
                      }}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                {/* 2. Demographics & Background */}
                <ProfileDisclosure
                  id="profile-personal-background"
                  title="Background"
                  summary="Optional demographic and placement preferences"
                  open={openPersonalSection === "background"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "background" ? "" : "background")}
                >
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    2. Demographics & Placement Background
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
                      placeholder="e.g. Roman Catholic, Christian"
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
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, height: e.target.value }))}
                    />
                    <Input
                      label="Weight (kg)"
                      type="number"
                      placeholder="e.g. 65"
                      value={personalForm.weight}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, weight: e.target.value }))}
                    />
                    <Input
                      label="Preferred Work Locations"
                      placeholder="e.g. Makati, Taguig, Ortigas, Remote"
                      value={personalForm.preferredWorkLocations}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({
                          ...prev,
                          preferredWorkLocations: e.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                {/* 3. Residential Address */}
                <ProfileDisclosure
                  id="profile-personal-address"
                  title="Address & work preferences"
                  summary="Where you live and where you can work"
                  open={openPersonalSection === "address"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "address" ? "" : "address")}
                >
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
                      placeholder="e.g. Rizal, Metro Manila"
                      value={personalForm.province}
                      helperText={autoFilledFields.has("province") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, province: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("province"); return n; });
                      }}
                    />
                    <Input
                      label="City / Municipality"
                      placeholder="e.g. Antipolo City, Quezon City"
                      value={personalForm.city}
                      helperText={autoFilledFields.has("city") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, city: e.target.value }));
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("city"); return n; });
                      }}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                {/* 4. Professional Summary */}
                <ProfileDisclosure
                  id="profile-personal-summary"
                  title="Professional summary"
                  summary="A short introduction for recruiters"
                  open={openPersonalSection === "summary"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "summary" ? "" : "summary")}
                >
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
                </ProfileDisclosure>

                {/* 5. Government Identification */}
                <ProfileDisclosure
                  id="profile-personal-government"
                  title="Government identification"
                  summary="Optional statutory numbers"
                  open={openPersonalSection === "government"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "government" ? "" : "government")}
                >
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    5. Government Identification (Optional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Input
                      label="SSS Number"
                      placeholder="e.g. 00-0000000-0"
                      value={personalForm.sss}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, sss: e.target.value }))}
                    />
                    <Input
                      label="PhilHealth Number"
                      placeholder="e.g. 00-000000000-0"
                      value={personalForm.philhealth}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, philhealth: e.target.value }))}
                    />
                    <Input
                      label="Pag-IBIG / HDMF Number"
                      placeholder="e.g. 0000-0000-0000"
                      value={personalForm.pagibig}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, pagibig: e.target.value }))}
                    />
                    <Input
                      label="TIN Number"
                      placeholder="e.g. 000-000-000-000"
                      value={personalForm.tin}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, tin: e.target.value }))}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                {/* 6. Emergency Contact */}
                <ProfileDisclosure
                  id="profile-personal-emergency"
                  title="Emergency contact"
                  summary="A contact we can reach if needed"
                  open={openPersonalSection === "emergency"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "emergency" ? "" : "emergency")}
                >
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    6. Emergency Contact Person
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="Contact Full Name"
                      placeholder="Full Name"
                      value={personalForm.emergencyContactName}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                    />
                    <PhoneInput
                      label="Contact Number"
                      value={personalForm.emergencyContactPhone}
                      onChange={(val) => setPersonalForm((prev) => ({ ...prev, emergencyContactPhone: val }))}
                    />
                    <Input
                      label="Relationship"
                      placeholder="e.g. Spouse / Parent / Sibling"
                      value={personalForm.emergencyContactRelationship}
                      onChange={(e) => setPersonalForm((prev) => ({ ...prev, emergencyContactRelationship: e.target.value }))}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                {/* 7. Additional Notes */}
                <ProfileDisclosure
                  id="profile-personal-notes"
                  title="Additional notes"
                  summary="Optional accommodations or schedule notes"
                  open={openPersonalSection === "notes"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "notes" ? "" : "notes")}
                >
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    7. Additional Notes (Optional)
                  </h4>
                  <Textarea
                    label="Additional Notes / Remarks"
                    rows={2}
                    placeholder="Any special accommodations, schedule constraints, or additional remarks..."
                    value={personalForm.additionalNotes}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                  />
                </div>
                </ProfileDisclosure>

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

          {/* TAB 3: WORK EXPERIENCE */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-experience"
              title="Work experience"
              summary={`${profile?.workExperiences?.length || 0} ${profile?.workExperiences?.length === 1 ? "role" : "roles"}`}
              open={openQualificationSection === "experience"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "experience" ? "" : "experience")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-slate-100 pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingExp(null);
                    setExpModalOpen(true);
                  }}
                >
                  Add Experience
                </Button>
                </div>

              {!profile?.workExperiences || profile.workExperiences.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                  No work experience entries recorded. Click "Add Experience" to begin.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.workExperiences.map((exp: any) => (
                    <div key={exp.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{exp.roleTitle}</span>
                          {exp.isCurrent && (
                            <span className="px-1.5 py-0.5 bg-[#E8EEF6] border border-[#0F294A]/20 text-[#0F294A] text-[10px] font-mono font-bold uppercase rounded">
                              Present
                            </span>
                          )}
                        </div>
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

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${exp.roleTitle}`}
                          onClick={() => {
                            setEditingExp(exp);
                            setExpModalOpen(true);
                          }}
                          className="text-slate-600 hover:text-[#0F294A] hover:bg-slate-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${exp.roleTitle}`}
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
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {/* TAB 4: EDUCATION */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-education"
              title="Education"
              summary={`${profile?.educations?.length || 0} ${profile?.educations?.length === 1 ? "record" : "records"}`}
              open={openQualificationSection === "education"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "education" ? "" : "education")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-slate-100 pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingEdu(null);
                    setEduModalOpen(true);
                  }}
                >
                  Add Education
                </Button>
                </div>

              {!profile?.educations || profile.educations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                  No education entries recorded. Click "Add Education" to begin.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.educations.map((edu: any) => (
                    <div key={edu.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
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

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${edu.degree}`}
                          onClick={() => {
                            setEditingEdu(edu);
                            setEduModalOpen(true);
                          }}
                          className="text-slate-600 hover:text-[#0F294A] hover:bg-slate-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${edu.degree}`}
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
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {/* TAB 5: SKILLS */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-skills"
              title="Skills"
              summary={`${skillsList.length} ${skillsList.length === 1 ? "skill" : "skills"}`}
              open={openQualificationSection === "skills"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "skills" ? "" : "skills")}
            >
              <SkillsSection
                skills={skillsList}
                onAddSkill={handleAddSkill}
                onRemoveSkill={handleRemoveSkill}
                isUpdating={updateSkillsMutation.isPending}
                showHeader={false}
              />
            </ProfileDisclosure>
          )}

          {/* TAB 6: TRAININGS & CERTIFICATIONS */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-trainings"
              title="Training & certifications"
              summary={`${profile?.trainings?.length || 0} ${profile?.trainings?.length === 1 ? "record" : "records"}`}
              open={openQualificationSection === "trainings"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "trainings" ? "" : "trainings")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-slate-100 pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingTraining(null);
                    setTrainingModalOpen(true);
                  }}
                >
                  Add Training
                </Button>
                </div>

              {!profile?.trainings || profile.trainings.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                  No training records added. Click "Add Training" to record credentials.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.trainings.map((t: any) => (
                    <div key={t.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-slate-900">{t.title}</div>
                        <div className="text-xs text-slate-700 font-medium">{t.provider}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {t.completionDate && <span>Completed: {formatDate(t.completionDate)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => {
                            setEditingTraining(t);
                            setTrainingModalOpen(true);
                          }}
                          className="text-slate-600 hover:text-[#0F294A] hover:bg-slate-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${t.title}`}
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
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {/* TAB 7: CHARACTER REFERENCES */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-references"
              title="References"
              summary={`${profile?.characterReferences?.length || 0} ${profile?.characterReferences?.length === 1 ? "contact" : "contacts"}`}
              open={openQualificationSection === "references"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "references" ? "" : "references")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-slate-100 pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingRef(null);
                    setRefPhone("");
                    setRefModalOpen(true);
                  }}
                >
                  Add Reference
                </Button>
                </div>

              {!profile?.characterReferences || profile.characterReferences.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                  No references listed. Click "Add Reference" to record contacts.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {profile.characterReferences.map((r: any) => (
                    <div key={r.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-700 font-medium">
                          {r.relationship}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          <span>Phone: {r.phone}</span>
                          {r.email && <span> • Email: {r.email}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${r.name}`}
                          onClick={() => {
                            setEditingRef(r);
                            setRefPhone(r.phone || "");
                            setRefModalOpen(true);
                          }}
                          className="text-slate-600 hover:text-[#0F294A] hover:bg-slate-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${r.name}`}
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
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {activeSection === "applications" && <ProfileApplications />}

        </div>

      {/* Add / Edit Experience Modal */}
      <Dialog
        open={expModalOpen}
        onClose={() => {
          setExpModalOpen(false);
          setEditingExp(null);
        }}
        title={editingExp ? "Edit Work Experience" : "Add Work Experience"}
        description={editingExp ? "Update your employment details" : "Record a previous employment role"}
      >
        <form onSubmit={handleSaveExp} className="space-y-4">
          <Input
            label="Job Title / Position"
            name="jobTitle"
            defaultValue={editingExp?.roleTitle || ""}
            required
          />
          <Input
            label="Company / Employer Name"
            name="companyName"
            defaultValue={editingExp?.company || ""}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              name="startDate"
              defaultValue={editingExp?.startDate ? editingExp.startDate.substring(0, 10) : ""}
              required
            />
            <Input
              label="End Date"
              type="date"
              name="endDate"
              defaultValue={editingExp?.endDate ? editingExp.endDate.substring(0, 10) : ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCurrent"
              name="isCurrent"
              defaultChecked={Boolean(editingExp?.isCurrent)}
              className="rounded text-[#0F294A] focus:ring-[#0F294A]"
            />
            <label htmlFor="isCurrent" className="text-xs text-slate-700">
              I currently work in this position
            </label>
          </div>
          <Textarea
            label="Responsibilities & Duties"
            name="responsibilities"
            defaultValue={editingExp?.summary || ""}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExpModalOpen(false);
                setEditingExp(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addExpMutation.isPending}>
              {editingExp ? "Save Changes" : "Save Experience"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add / Edit Education Modal */}
      <Dialog
        open={eduModalOpen}
        onClose={() => {
          setEduModalOpen(false);
          setEditingEdu(null);
        }}
        title={editingEdu ? "Edit Educational Background" : "Add Educational Background"}
        description={editingEdu ? "Update your degree or course details" : "Record a degree, diploma, or certificate"}
      >
        <form onSubmit={handleSaveEdu} className="space-y-4">
          <Input
            label="School / Institution Name"
            name="schoolName"
            defaultValue={editingEdu?.school || ""}
            required
          />
          <Input
            label="Degree / Course Level"
            name="degree"
            placeholder="e.g. High School Diploma, BS Nursing"
            defaultValue={editingEdu?.degree || ""}
            required
          />
          <Input
            label="Field of Study"
            name="fieldOfStudy"
            placeholder="e.g. General Sciences, Electrical"
            defaultValue={editingEdu?.fieldOfStudy || ""}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              name="startDate"
              defaultValue={editingEdu?.startDate ? editingEdu.startDate.substring(0, 10) : ""}
            />
            <Input
              label="End Date"
              type="date"
              name="endDate"
              defaultValue={editingEdu?.endDate ? editingEdu.endDate.substring(0, 10) : ""}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEduModalOpen(false);
                setEditingEdu(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addEduMutation.isPending}>
              {editingEdu ? "Save Changes" : "Save Education"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add / Edit Training Modal */}
      <Dialog
        open={trainingModalOpen}
        onClose={() => {
          setTrainingModalOpen(false);
          setEditingTraining(null);
        }}
        title={editingTraining ? "Edit Training or Certification" : "Add Training or Certification"}
        description={editingTraining ? "Update credential records" : "Record industry credentials"}
      >
        <form onSubmit={handleSaveTraining} className="space-y-4">
          <Input
            label="Certificate / Course Title"
            name="title"
            defaultValue={editingTraining?.title || ""}
            required
          />
          <Input
            label="Issuing Organization"
            name="issuer"
            placeholder="e.g. TESDA, Red Cross, DOLE"
            defaultValue={editingTraining?.provider || ""}
            required
          />
          <Input
            label="Completion Date"
            type="date"
            name="issueDate"
            defaultValue={editingTraining?.completionDate ? editingTraining.completionDate.substring(0, 10) : ""}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTrainingModalOpen(false);
                setEditingTraining(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addTrainingMutation.isPending}>
              {editingTraining ? "Save Changes" : "Save Training"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add / Edit Reference Modal */}
      <Dialog
        open={refModalOpen}
        onClose={() => {
          setRefModalOpen(false);
          setEditingRef(null);
        }}
        title={editingRef ? "Edit Character Reference" : "Add Character Reference"}
        description={editingRef ? "Update contact information" : "Record a professional or personal contact"}
      >
        <form onSubmit={handleSaveRef} className="space-y-4">
          <Input
            label="Contact Full Name"
            name="name"
            defaultValue={editingRef?.name || ""}
            required
          />
          <Input
            label="Relationship / Title"
            name="relationship"
            placeholder="e.g. Former Supervisor"
            defaultValue={editingRef?.relationship || ""}
            required
          />
          <PhoneInput
            label="Contact Phone Number"
            value={refPhone}
            onChange={setRefPhone}
            required
          />
          <Input
            label="Email Address"
            type="email"
            name="email"
            defaultValue={editingRef?.email || ""}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefModalOpen(false);
                setEditingRef(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addRefMutation.isPending}>
              {editingRef ? "Save Changes" : "Save Reference"}
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
        fileUrl={previewDocState?.fileUrl}
        title={previewDocState?.title}
      />

      {blocker.status === "blocked" && (
        <ConfirmDialog
          open
          onClose={() => blocker.reset?.()}
          onConfirm={() => blocker.proceed?.()}
          title="Leave without saving?"
          description="Your personal information changes will be lost if you leave this page."
          confirmLabel="Leave without saving"
        />
      )}
    </div>
  );
};
