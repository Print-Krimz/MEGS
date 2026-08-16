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
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { EmploymentStatus } from "../../lib/types/enums";
import {
  Users,
  FileCheck2,
} from "lucide-react";

export const EmployeesPage: React.FC = () => {
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
      <PageHeader
        title="Personnel & Digital 201 Records"
        description="Comprehensive employee roster, redeployment pool management, and historical personnel archives"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Personnel & 201" },
        ]}
      />

      {/* Filter Bar */}
      <SearchFilters
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
              { value: EmploymentStatus.ACTIVE, label: "ACTIVE" },
              {
                value: EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT,
                label: "AVAILABLE FOR REDEPLOYMENT",
              },
              { value: EmploymentStatus.INACTIVE, label: "INACTIVE" },
              { value: EmploymentStatus.SEPARATED, label: "SEPARATED" },
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
            title="No Employee Records Found"
            description="When candidates are hired through the recruitment pipeline, their Digital 201 personnel records will appear here."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee ID / Number</th>
                  <th className="px-4 py-3 font-semibold">Personnel Full Name</th>
                  <th className="px-4 py-3 font-semibold">Designation & Department</th>
                  <th className="px-4 py-3 font-semibold">Hire Date</th>
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
                        <div className="font-bold text-slate-900">{empName}</div>
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
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                            emp.status === EmploymentStatus.ACTIVE
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : emp.status === EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT
                              ? "bg-teal-50 text-teal-800 border border-teal-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {emp.status.replace(/_/g, " ")}
                        </span>
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
                            Digital 201 File
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
            />
          </div>
        </div>
      )}
    </div>
  );
};
