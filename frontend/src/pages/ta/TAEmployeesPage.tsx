import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  Building2,
  Calendar,
  Eye,
  X,
  FileText,
  UserCheck,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { employeeApi } from '../../lib/api/employees';
import { EmploymentStatus } from '../../lib/types/enums';
import type { Employee } from '../../lib/types/api';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Employees' },
  { key: EmploymentStatus.ACTIVE, label: 'Active' },
  { key: EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT, label: 'Redeployment Pool' },
  { key: EmploymentStatus.INACTIVE, label: 'Inactive' },
  { key: EmploymentStatus.SEPARATED, label: 'Separated' },
];

export default function TAEmployeesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Query Employees
  const {
    data: employeesRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ta', 'employees', statusFilter],
    queryFn: () =>
      employeeApi.listEmployees({
        status: statusFilter !== 'ALL' ? (statusFilter as EmploymentStatus) : undefined,
      }),
  });

  const employees: Employee[] = employeesRes?.data || [];

  // Distinct Departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Department filter
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) {
        return false;
      }

      // Search matching
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const profile = emp.user?.applicantProfile;
      const fullName = profile
        ? `${profile.firstName} ${profile.lastName}`.toLowerCase()
        : '';
      const empNum = emp.employeeNumber.toLowerCase();
      const email = emp.user?.email.toLowerCase() || '';
      const dept = emp.department?.toLowerCase() || '';
      const pos = emp.position?.toLowerCase() || '';

      return (
        fullName.includes(query) ||
        empNum.includes(query) ||
        email.includes(query) ||
        dept.includes(query) ||
        pos.includes(query)
      );
    });
  }, [employees, departmentFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Employee Directory & Digital 201 Files"
        description="Search employee dossiers, manage government credentials, deployment history, and redeployment rosters."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Employees' }]}
        actions={
          <button
            type="button"
            onClick={() => {
              // Export Roster as CSV / XLSX
              const headers = ['Employee Number', 'Full Name', 'Email', 'Position', 'Department', 'Hire Date', 'Status'];
              const rows = filteredEmployees.map((e) => [
                e.employeeNumber,
                e.user?.applicantProfile ? `${e.user.applicantProfile.firstName} ${e.user.applicantProfile.lastName}` : e.user?.email || `EMP-${e.id}`,
                e.user?.email || '',
                e.position || '',
                e.department || '',
                new Date(e.hireDate).toLocaleDateString(),
                e.status,
              ]);
              const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `MEGS_Employee_Roster_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success('Employee roster exported successfully');
            }}
            data-testid="export-roster-btn"
            className="h-10 px-4 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 text-foreground transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-teal-600" />
            <span>Export Roster</span>
          </button>
        }
      />

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="employee-stats-strip">
        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Total Staff
          </span>
          <p className="text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <span>{employees.length}</span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Active Personnel
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <span>{employees.filter((e) => e.status === EmploymentStatus.ACTIVE).length}</span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Redeployment Pool
          </span>
          <p className="text-2xl font-bold text-teal-600 mt-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <span>
              {
                employees.filter(
                  (e) => e.status === EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT
                ).length
              }
            </span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Separated / Inactive
          </span>
          <p className="text-2xl font-bold text-slate-600 mt-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            <span>
              {
                employees.filter(
                  (e) =>
                    e.status === EmploymentStatus.SEPARATED ||
                    e.status === EmploymentStatus.INACTIVE
                ).length
              }
            </span>
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {STATUS_FILTERS.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                data-testid={`tab-employee-status-${tab.key.toLowerCase()}`}
                onClick={() => setStatusFilter(tab.key)}
                className={`h-9 px-4 text-xs font-semibold rounded-lg transition-all cursor-pointer inline-flex items-center justify-center ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Department & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-muted-foreground">Department:</span>
            <select
              data-testid="employee-dept-filter"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              data-testid="employee-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, employee #, email, role..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Employees Table */}
      {isLoading ? (
        <LoadingState variant="table" />
      ) : isError ? (
        <ErrorState
          title="Failed to load employees"
          message={error instanceof Error ? error.message : 'An error occurred.'}
          onRetry={refetch}
        />
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="There are currently no employee records matching your query."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
          <table className="w-full text-left text-sm" data-testid="employees-table">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="px-5 py-4">Employee #</th>
                <th className="px-5 py-4">Full Name</th>
                <th className="px-5 py-4">Position & Dept</th>
                <th className="px-5 py-4">Hire Date</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmployees.map((emp) => {
                const profile = emp.user?.applicantProfile;
                const fullName = profile
                  ? `${profile.firstName} ${profile.lastName}`
                  : emp.user?.email || `Employee #${emp.id}`;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-xs text-teal-700 dark:text-teal-400">
                      {emp.employeeNumber}
                    </td>

                    <td className="px-5 py-4">
                      <Link
                        to={`/ta/employees/${emp.id}`}
                        className="text-sm font-bold text-foreground hover:text-teal-600 transition-colors block"
                      >
                        {fullName}
                      </Link>
                      <span className="text-xs text-muted-foreground">{emp.user?.email}</span>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <span className="font-semibold text-foreground block">
                        {emp.position || 'Staff Member'}
                      </span>
                      <span className="text-muted-foreground">{emp.department || 'Operations'}</span>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(emp.hireDate).toLocaleDateString()}</span>
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold px-3 py-1">
                        <StatusBadge status={emp.status} size="sm" />
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/ta/employees/${emp.id}`}
                        data-testid={`view-201-${emp.id}`}
                        className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View 201 File</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
