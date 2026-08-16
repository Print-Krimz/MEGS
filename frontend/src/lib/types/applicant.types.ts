import type { AssetVerificationState } from "./enums";

export interface WorkExperience {
  id: number;
  applicantProfileId: number;
  company: string;
  roleTitle: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Education {
  id: number;
  applicantProfileId: number;
  school: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: number;
  name: string;
}

export interface TrainingCertification {
  id: number;
  applicantProfileId: number;
  title: string;
  provider?: string | null;
  completionDate?: string | null;
  certificateNo?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: number;
  applicantProfileId: number;
  label: string;
  fileUrl: string;
  notes?: string | null;
  documentType?: string | null;
  verificationState: AssetVerificationState;
  expiresAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterReference {
  id: number;
  applicantProfileId: number;
  name: string;
  relationship?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantProfile {
  id: number;
  userId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  mobileNumber?: string | null;
  gender?: string | null;
  province?: string | null;
  city?: string | null;
  dateOfBirth?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
  civilStatus?: string | null;
  height?: number | null;
  weight?: number | null;
  religion?: string | null;
  address?: string | null;
  preferredWorkLocations?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pagibig?: string | null;
  philhealth?: string | null;
  sss?: string | null;
  tin?: string | null;
  photoUrl?: string | null;
  resumeUrl?: string | null;
  professionalSummary?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactAddress?: string | null;
  additionalNotes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  workExperiences?: WorkExperience[];
  educations?: Education[];
  skills?: (Skill | string)[];
  trainings?: TrainingCertification[];
  assets?: Asset[];
  characterReferences?: CharacterReference[];
}

export interface UpsertProfileDto {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNumber?: string;
  gender?: string;
  province?: string;
  city?: string;
  dateOfBirth?: string;
  birthPlace?: string;
  nationality?: string;
  civilStatus?: string;
  height?: number | string;
  weight?: number | string;
  religion?: string;
  address?: string;
  preferredWorkLocations?: string;
  pagibig?: string;
  philhealth?: string;
  sss?: string;
  tin?: string;
  professionalSummary?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactAddress?: string;
  additionalNotes?: string;
}

export interface AddWorkExperienceDto {
  company: string;
  roleTitle: string;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  summary?: string;
}

export interface AddEducationDto {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string | null;
  notes?: string;
}

export interface AddTrainingDto {
  title: string;
  provider: string;
  completionDate?: string | null;
  certificateNo?: string;
  notes?: string;
}

export interface AddReferenceDto {
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface AddAssetDto {
  label: string;
  notes?: string;
}
