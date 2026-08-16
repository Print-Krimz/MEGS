import type {
  DeploymentStatus,
  EmploymentEventType,
  EmploymentStatus,
} from "./enums";
import type { ApplicantProfile } from "./applicant.types";
import type { Application } from "./application.types";
import type { Client } from "./client.types";
import type { ManpowerRequest } from "./ta.types";
import type { User } from "./auth.types";

export interface DeploymentStatusHistory {
  id: number;
  deploymentId: number;
  fromStatus?: DeploymentStatus | null;
  toStatus: DeploymentStatus;
  changedById: string;
  reason?: string | null;
  createdAt: string;
}

export interface Deployment {
  id: number;
  employeeId: number;
  applicationId?: number | null;
  clientId: number;
  mrfId?: number | null;
  status: DeploymentStatus;
  site?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  employee?: Employee;
  client?: Client;
  mrf?: ManpowerRequest;
  statusHistory?: DeploymentStatusHistory[];
}

export interface EmploymentEvent {
  id: number;
  employeeId: number;
  eventType: EmploymentEventType;
  description: string;
  effectiveDate: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface Employee {
  id: number;
  userId: string;
  employeeNumber: string;
  status: EmploymentStatus;
  hireDate: string;
  department?: string | null;
  position?: string | null;
  notes?: string | null;
  originatingApplicationId?: number | null;
  createdAt: string;
  updatedAt: string;
  user?: User & { applicantProfile?: ApplicantProfile };
  originatingApplication?: Application;
  deployments?: Deployment[];
  employmentEvents?: EmploymentEvent[];
}

export interface Digital201Aggregate {
  employee: Employee;
  candidate: ApplicantProfile;
  workExperiences: unknown[];
  educations: unknown[];
  skills: string[];
  trainings: unknown[];
  assets: unknown[];
  characterReferences: unknown[];
  originatingApplication?: Application | null;
  compliance: unknown[];
  deployments: Deployment[];
  employmentHistory: EmploymentEvent[];
}

export interface EmployeeListQuery {
  status?: EmploymentStatus;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
