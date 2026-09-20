import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  StatusBadge,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { EmploymentStatus } from "../../lib/types/enums";
import { TA_COPY } from "../../lib/ta-copy";
import {
  Users,
  FileCheck2,
} from "lucide-react";

export const EmployeesPage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const employeesQuery = useQuery({
    queryKey: ["ta", "employees", { search, filterValues }],
    queryFn: () =>
      employeesApi.listEmployees({
        search: search || undefined,
        status: (filterValues.status as EmploymentStatus) || undefined,
        department: filterValues.department || undefined,
      }),
  });

  const allEmployees = employeesQuery.data || [];
  const totalPages = Math.max(1, Math.ceil(allEmployees.length / pageSize));
  const paginatedEmployees = allEmployees.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (k: string, v: string) => {
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <PageHeader
          title="Employee records (201)"
          description="View active employees, redeployment availability, and personnel history."
          breadcrumbs={[
            { label: TA_COPY.navigation.overview, href: "/ta" },
            { label: TA_COPY.navigation.workforce },
          ]}
        />
      )}

      {/* Filter Bar */}
      <SearchFilters
        searchLabel="Search employee records"
        searchPlaceholder="Search employee name, number, or department..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Employment Status",
            options: [
              { value: EmploymentStatus.ACTIVE, label: "Active" },
              {
                value: EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT,
                label: "Available for redeployment",
              },
              { value: EmploymentStatus.INACTIVE, label: "Inactive" },
              { value: EmploymentStatus.SEPARATED, label: "Separated" },
            ],
          },
        ]}
      />

      {/* Employees Table */}
      {employeesQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : employeesQuery.isError ? (
        <ErrorState error={employeesQuery.error} onRetry={() => employeesQuery.refetch()} />
      ) : allEmployees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No employee records found"
            description="Employee records will appear here after candidates are hired through the recruitment process."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="md:hidden divide-y divide-slate-200">
            {paginatedEmployees.map((emp) => {
              const profile = emp.user?.applicantProfile;
              const employeeName = profile ? `${profile.firstName} ${profile.lastName}` : emp.employeeNumber;
              return (
                <article key={emp.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-950 break-words">{employeeName}</h4>
                      <p className="mt-0.5 text-sm text-slate-600 break-words">{emp.position || "General staff"}</p>
                    </div>
                    <StatusBadge status={emp.status} type="employment" size="sm" />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-slate-500">Employee number</dt><dd className="mt-0.5 text-slate-800">{emp.employeeNumber}</dd></div>
                    <div><dt className="text-slate-500">Hire date</dt><dd className="mt-0.5 text-slate-800">{formatDate(emp.hireDate)}</dd></div>
                  </dl>
                  <Link
                    to="/ta/employees/$employeeId"
                    params={{ employeeId: String(emp.id) }}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#0B315D] px-3 text-sm font-medium text-white hover:bg-[#082747] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2"
                  >
                    View employee record
                  </Link>
                </article>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee number</th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Position & department</th>
                  <th className="px-4 py-3 font-semibold">Hire date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedEmployees.map((emp) => {
                  const p = emp.user?.applicantProfile;
                  const empName = p
                    ? `${p.firstName} ${p.lastName}`
                    : emp.employeeNumber;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {emp.employeeNumber}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/ta/employees/$employeeId"
                          params={{ employeeId: String(emp.id) }}
                          className="font-bold text-slate-900 hover:text-teal-700 hover:underline block"
                        >
                          {empName}
                        </Link>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {emp.user?.email || "No email on record"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {emp.position || "General Staff"}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {emp.department || "Operations"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {formatDate(emp.hireDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={emp.status} type="employment" size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/ta/employees/$employeeId"
                          params={{ employeeId: String(emp.id) }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<FileCheck2 className="w-3.5 h-3.5 text-teal-600" />}
                          >
                            View employee record
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={allEmployees.length}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="employees"
            />
          </div>
        </div>
      )}
    </div>
  );
};
