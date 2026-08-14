import { apiClient } from './client';
import type {
  Employee,
  Digital201File,
  EmploymentEvent,
  Deployment,
  ApiResponse,
  EmploymentStatus,
} from '../types/api';

export const employeeApi = {
  getMyDigital201: async (): Promise<ApiResponse<Digital201File>> => {
    return apiClient.get<Digital201File>('/api/employees/me/digital-201');
  },

  listEmployees: async (params?: {
    status?: EmploymentStatus;
    department?: string;
    search?: string;
  }): Promise<ApiResponse<Employee[]>> => {
    return apiClient.get<Employee[]>('/api/employees', params);
  },

  getEmployee: async (id: number): Promise<ApiResponse<Employee>> => {
    return apiClient.get<Employee>(`/api/employees/${id}`);
  },

  getDigital201: async (id: number): Promise<ApiResponse<Digital201File>> => {
    return apiClient.get<Digital201File>(`/api/employees/${id}/digital-201`);
  },

  getEmploymentHistory: async (id: number): Promise<ApiResponse<EmploymentEvent[]>> => {
    return apiClient.get<EmploymentEvent[]>(`/api/employees/${id}/employment-history`);
  },

  updateStatus: async (
    id: number,
    data: { status: EmploymentStatus; reason?: string }
  ): Promise<ApiResponse<Employee>> => {
    return apiClient.patch<Employee>(`/api/employees/${id}/status`, data);
  },

  createDeployment: async (
    id: number,
    data: { clientId: number; mrfId?: number; site?: string; contractStart?: string; notes?: string }
  ): Promise<ApiResponse<Deployment>> => {
    return apiClient.post<Deployment>(`/api/employees/${id}/deployments`, data);
  },

  endDeployment: async (
    deploymentId: number,
    data: { reason?: string; returnToRedeploymentPool?: boolean }
  ): Promise<ApiResponse<{ deployment: Deployment; employee: Employee }>> => {
    return apiClient.post(`/api/employees/deployments/${deploymentId}/end`, data);
  },

  getDigital201File: async (id: number): Promise<ApiResponse<Digital201File>> => {
    return apiClient.get<Digital201File>(`/api/employees/${id}/digital-201`);
  },

  addEmploymentEvent: async (
    id: number,
    data: { eventType: string; description: string; effectiveDate?: string; metadata?: Record<string, unknown> }
  ): Promise<ApiResponse<EmploymentEvent>> => {
    return apiClient.post<EmploymentEvent>(`/api/employees/${id}/events`, data);
  },
};

export const employeesApi = employeeApi;
