import React, { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  StatusBadge,
  DataTable,
  DataTableColumn,
} from "../../components/common";
import { Link } from "@tanstack/react-router";
import { Button } from "../../components/ui";
import { PersonCell, StatusWithAge, WorkforceCard } from "../../components/ta/workforce/WorkforceRow";
import { formatDate } from "../../lib/utils";
import { EmploymentStatus } from "../../lib/types/enums";
import { TA_COPY } from "../../lib/ta-copy";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";
import type { Employee } from "../../lib/types/employee.types";

const employeeName = (emp: Employee) => {
  const p = emp.user?.applicantProfile;
  return p ? `${p.firstName} ${p.lastName}` : emp.employeeNumber;
};

/** Current client and site, from the open deployment the list payload carries. */
const assignmentParts = (emp: Employee): string[] | null => {
  const dep = emp.deployments?.[0];
  if (!dep) return null;
  const parts = [dep.client?.name, dep.site].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts : null;
};

const statusCell = (emp: Employee) => (
  <StatusWithAge
    chip={<StatusBadge status={emp.status} type="employment" size="sm" />}
    age={`Hired ${formatDate(emp.hireDate)}`}
  />
);

const recordAction = (emp: Employee, fullWidth = false) => (
  <Button asChild variant="outline" size="sm" className={fullWidth ? "w-full" : undefined}>
    <Link to="/ta/employees/$employeeId" params={{ employeeId: String(emp.id) }}>
      View record
      <span className="sr-only"> for {employeeName(emp)}</span>
    </Link>
  </Button>
);

export const EmployeesPage: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  const employeesQuery = useQuery({
    queryKey: ["ta", "employees", {
      search: debouncedSearch,
      status: filterValues.status || "",
      department: filterValues.department || "",
    }],
    queryFn: ({ signal }) => employeesApi.listEmployees({
        search: debouncedSearch || undefined,
        status: (filterValues.status as EmploymentStatus) || undefined,
        department: filterValues.department || undefined,
      }, { signal }),
    placeholderData: keepPreviousData,
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

  const columns: DataTableColumn<Employee>[] = [
    {
      key: "employee",
      header: "Employee",
      primary: true,
      cell: (emp) => (
        <PersonCell
          name={employeeName(emp)}
          context={assignmentParts(emp) ?? ["Not on assignment"]}
        />
      ),
    },
    { key: "status", header: "Status", cell: statusCell },
    {
      key: "position",
      header: "Position and department",
      hideBelow: "lg",
      cell: (emp) => (
        <div>
          <div className="text-slate-800">{emp.position || "General staff"}</div>
          <div className="text-xs text-slate-600">{emp.department || "Operations"}</div>
        </div>
      ),
    },
    {
      key: "employeeNumber",
      header: "Employee number",
      hideBelow: "lg",
      cell: (emp) => <span className="font-mono text-xs tabular-nums text-slate-700">{emp.employeeNumber}</span>,
    },
    { key: "action", header: "Action", align: "right", className: "whitespace-nowrap", cell: (emp) => recordAction(emp) },
  ];

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <PageHeader
          title={TA_COPY.pageTitles.employeeRecords}
          description="View active employees, redeployment availability, and personnel history."
          breadcrumbs={[
            { label: TA_COPY.navigation.overview, href: "/ta" },
            { label: TA_COPY.navigation.workforce },
          ]}
          flush
        />
      )}

      <SearchFilters
        searchLabel="Search employee records"
        searchPlaceholder="Search name, number, or department"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Status",
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

      {employeesQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : employeesQuery.isError ? (
        <ErrorState error={employeesQuery.error} onRetry={() => employeesQuery.refetch()} />
      ) : (
        <DataTable
          caption="Employee records"
          columns={columns}
          rows={paginatedEmployees}
          getRowId={(emp) => String(emp.id)}
          rowHref={(emp) => `/ta/employees/${emp.id}`}
          density="compact"
          isFetching={employeesQuery.isFetching}
          empty={
            <EmptyState
              bare
              title="No employee records found"
              description="Employee records will appear here after candidates are hired through the recruitment process."
              action={
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          }
          renderCard={(emp) => (
            <WorkforceCard
              href={`/ta/employees/${emp.id}`}
              name={employeeName(emp)}
              context={assignmentParts(emp) ?? ["Not on assignment"]}
              status={statusCell(emp)}
              details={[emp.position || "General staff", emp.department].filter(Boolean).join(" · ")}
              action={recordAction(emp, true)}
            />
          )}
          footer={
            <Pagination
              variant="inset"
              currentPage={page}
              totalPages={totalPages}
              totalItems={allEmployees.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="employees"
            />
          }
        />
      )}
    </div>
  );
};
