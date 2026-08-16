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
} from "../types/applicant.types";

export const applicantApi = {
  // Profile
  getProfile: () => api.get<ApplicantProfile>("/api/applicants/profile"),

  upsertProfile: (data: UpsertProfileDto) =>
    api.post<ApplicantProfile>("/api/applicants/profile", data),

  // Work Experience (sends both title/roleTitle and description/summary for maximum compatibility)
  addWorkExperience: (data: AddWorkExperienceDto) =>
    api.post<WorkExperience>("/api/applicants/profile/work-experience", {
      company: data.company,
      title: data.roleTitle,
      roleTitle: data.roleTitle,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: data.isCurrent,
      description: data.summary,
      summary: data.summary,
    }),

  deleteWorkExperience: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/work-experience/${id}`),

  // Education (sends both field/fieldOfStudy and school/institution for maximum compatibility)
  addEducation: (data: AddEducationDto) =>
    api.post<Education>("/api/applicants/profile/education", {
      school: data.school,
      institution: data.school,
      degree: data.degree,
      field: data.fieldOfStudy || "General",
      fieldOfStudy: data.fieldOfStudy || "General",
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
  addTraining: (data: AddTrainingDto) =>
    api.post<TrainingCertification>("/api/applicants/profile/trainings", data),

  deleteTraining: (id: number | string) =>
    api.delete<null>(`/api/applicants/profile/trainings/${id}`),

  // References
  addReference: (data: AddReferenceDto) =>
    api.post<CharacterReference>("/api/applicants/profile/references", data),

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
    api.upload<{ resumeUrl: string }>("/api/applicants/profile/resume", formData),
};
