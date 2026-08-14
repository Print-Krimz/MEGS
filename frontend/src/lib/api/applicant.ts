import { apiClient } from './client';
import type {
  ApplicantProfile,
  WorkExperience,
  Education,
  TrainingCertification,
  CharacterReference,
  Asset,
  JobPosting,
  Application,
  UpsertApplicantProfileInput,
  AddWorkExperienceInput,
  AddEducationInput,
  AddTrainingInput,
  AddReferenceInput,
  ApiResponse,
} from '../types/api';

export const applicantApi = {
  // Profile CRUD
  getProfile: async (): Promise<ApiResponse<ApplicantProfile>> => {
    return apiClient.get<ApplicantProfile>('/api/applicants/profile');
  },

  upsertProfile: async (data: UpsertApplicantProfileInput): Promise<ApiResponse<ApplicantProfile>> => {
    return apiClient.post<ApplicantProfile>('/api/applicants/profile', data);
  },

  // Work Experience
  addWorkExperience: async (data: AddWorkExperienceInput): Promise<ApiResponse<WorkExperience>> => {
    return apiClient.post<WorkExperience>('/api/applicants/profile/work-experience', data);
  },

  deleteWorkExperience: async (id: number): Promise<ApiResponse<null>> => {
    return apiClient.delete<null>(`/api/applicants/profile/work-experience/${id}`);
  },

  // Education
  addEducation: async (data: AddEducationInput): Promise<ApiResponse<Education>> => {
    return apiClient.post<Education>('/api/applicants/profile/education', data);
  },

  deleteEducation: async (id: number): Promise<ApiResponse<null>> => {
    return apiClient.delete<null>(`/api/applicants/profile/education/${id}`);
  },

  // Skills
  updateSkills: async (skills: string[]): Promise<ApiResponse<string[]>> => {
    return apiClient.post<string[]>('/api/applicants/profile/skills', { skills });
  },

  // Trainings
  addTraining: async (data: AddTrainingInput): Promise<ApiResponse<TrainingCertification>> => {
    return apiClient.post<TrainingCertification>('/api/applicants/profile/trainings', data);
  },

  deleteTraining: async (id: number): Promise<ApiResponse<null>> => {
    return apiClient.delete<null>(`/api/applicants/profile/trainings/${id}`);
  },

  // Character References
  addReference: async (data: AddReferenceInput): Promise<ApiResponse<CharacterReference>> => {
    return apiClient.post<CharacterReference>('/api/applicants/profile/references', data);
  },

  deleteReference: async (id: number): Promise<ApiResponse<null>> => {
    return apiClient.delete<null>(`/api/applicants/profile/references/${id}`);
  },

  // Assets & Uploads
  addAsset: async (formData: FormData): Promise<ApiResponse<Asset>> => {
    return apiClient.upload<Asset>('/api/applicants/profile/assets', formData);
  },

  deleteAsset: async (id: number): Promise<ApiResponse<null>> => {
    return apiClient.delete<null>(`/api/applicants/profile/assets/${id}`);
  },

  uploadPhoto: async (file: File): Promise<ApiResponse<ApplicantProfile>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<ApplicantProfile>('/api/applicants/profile/photo', formData);
  },

  uploadResume: async (file: File): Promise<ApiResponse<ApplicantProfile>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<ApplicantProfile>('/api/applicants/profile/resume', formData);
  },

  setAiConsent: async (consent: boolean): Promise<ApiResponse<{ hasConsentedToAi: boolean }>> => {
    return apiClient.post<{ hasConsentedToAi: boolean }>('/api/applicants/profile/consent', { consent });
  },

  // Job Search & Applications
  getOpenJobs: async (): Promise<ApiResponse<JobPosting[]>> => {
    return apiClient.get<JobPosting[]>('/api/applicant-jobs/jobs');
  },

  getJobDetails: async (id: number): Promise<ApiResponse<JobPosting & { hasApplied?: boolean }>> => {
    return apiClient.get<JobPosting & { hasApplied?: boolean }>(`/api/applicant-jobs/jobs/${id}`);
  },

  applyToJob: async (jobId: number, resumeFile?: File): Promise<ApiResponse<Application>> => {
    const formData = new FormData();
    if (resumeFile) {
      formData.append('file', resumeFile);
    }
    return apiClient.upload<Application>(`/api/applicant-jobs/jobs/${jobId}/apply`, formData);
  },

  getMyApplications: async (): Promise<ApiResponse<Application[]>> => {
    return apiClient.get<Application[]>('/api/applicant-jobs/my-applications');
  },
};
