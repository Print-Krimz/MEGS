import { api } from "./client";
import type {
  Employee,
  Digital201Aggregate,
  Deployment,
  EmploymentEvent,
  EmployeeListQuery,
} from "../types/employee.types";
import type { EmploymentStatus } from "../types/enums";

export const employeesApi = {
  listEmployees: (query?: EmployeeListQuery) => {
    const params = new URLSearchParams();
    if (query?.status) params.append("status", query.status);
    if (query?.department) params.append("department", query.department);
    if (query?.search) params.append("search", query.search);
    if (query?.limit) params.append("limit", String(query.limit));
    if (query?.offset) params.append("offset", String(query.offset));

    const qs = params.toString();
    return api.get<Employee[]>(`/api/employees${qs ? `?${qs}` : ""}`);
  },

  getEmployee: (id: number | string) =>
    api.get<Employee>(`/api/employees/${id}`),

  getDigital201: (id: number | string) =>
    api.get<Digital201Aggregate>(`/api/employees/${id}/digital-201`),

  getMyDigital201: () =>
    api.get<Digital201Aggregate>("/api/employees/me/digital-201"),

  getEmploymentHistory: (id: number | string) =>
    api.get<EmploymentEvent[]>(`/api/employees/${id}/employment-history`),

  updateEmployeeStatus: (
    id: number | string,
    data: { status: EmploymentStatus; notes?: string; reason?: string }
  ) => api.patch<Employee>(`/api/employees/${id}/status`, data),

  createEmployeeDeployment: (
    id: number | string,
    data: { clientId: number; mrfId?: number; site?: string; contractStart?: string; contractEnd?: string; notes?: string }
  ) => api.post<Deployment>(`/api/employees/${id}/deployments`, data),

  endEmployeeDeployment: (
    deploymentId: number | string,
    data: { endDate?: string; reason: string; notes?: string }
  ) => api.post<Deployment>(`/api/employees/deployments/${deploymentId}/end`, data),
};
