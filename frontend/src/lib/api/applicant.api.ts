import { api } from "./client";
import type {
  ApplicantProfile,
  WorkExperience,
  Education,
  Skill,
  TrainingCertification,
  CharacterReference,
  Asset,
  UpsertProfileDto,
  AddWorkExperienceDto,
  AddEducationDto,
  AddTrainingDto,
  AddReferenceDto,
  ResumeUploadResult,
  ResumeAccept,
  PendingResumeProposal,
  ApplyResumeResult,
} from "../types/applicant.types";

export const applicantApi = {
  // Profile
  getProfile: () => api.get<ApplicantProfile>("/api/applicants/profile"),

  upsertProfile: (data: UpsertProfileDto) =>
    api.post<ApplicantProfile>("/api/applicants/profile", data),

  // Work Experience (sends only schema-accepted fields; the service maps title/description to roleTitle/summary)
  addWorkExperience: (data: AddWorkExperienceDto) =>
    api.post<WorkExperience>("/api/applicants/profile/work-experience", {
      company: data.company,
      title: data.roleTitle,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: data.isCurrent,
      description: data.summary,
    }),

  deleteWorkExperience: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/work-experience/${id}`),

  // Education (sends only schema-accepted fields; the service maps field to fieldOfStudy)
  addEducation: (data: AddEducationDto) =>
    api.post<Education>("/api/applicants/profile/education", {
      school: data.school,
      degree: data.degree,
      field: data.fieldOfStudy || "General",
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
    }),

  deleteEducation: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/education/${id}`),

  // Skills
  updateSkills: (skills: string[]) =>
    api.post<{ skills: (Skill | string)[] }>("/api/applicants/profile/skills", { skills }),

  // Trainings
  // Sends only schema-accepted fields (previousId is never sent; it only drives the edit flow)
  addTraining: (data: AddTrainingDto) =>
    api.post<TrainingCertification>("/api/applicants/profile/trainings", {
      title: data.title,
      provider: data.provider,
      completionDate: data.completionDate,
      certificateNo: data.certificateNo,
      notes: data.notes,
    }),

  deleteTraining: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/trainings/${id}`),

  // References
  // Sends only schema-accepted fields (previousId is never sent; it only drives the edit flow)
  addReference: (data: AddReferenceDto) =>
    api.post<CharacterReference>("/api/applicants/profile/references", {
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      email: data.email,
      notes: data.notes,
    }),

  deleteReference: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/references/${id}`),

  // Assets (Documents)
  addAsset: (formData: FormData) =>
    api.upload<Asset>("/api/applicants/profile/assets", formData),

  deleteAsset: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/assets/${id}`),

  // Photo & Resume Uploads
  uploadPhoto: (formData: FormData) =>
    api.upload<{ photoUrl: string }>("/api/applicants/profile/photo", formData),

  uploadResume: (formData: FormData) =>
    api.upload<ResumeUploadResult>("/api/applicants/profile/resume", formData),

  getResumeProposal: () =>
    api.get<PendingResumeProposal | null>("/api/applicants/profile/resume/proposal"),

  applyResumeProposal: (parseId: number, accept: ResumeAccept) =>
    api.post<ApplyResumeResult>(`/api/applicants/profile/resume/${parseId}/apply`, { accept }),
};

