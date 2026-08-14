import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Search,
  Mail,
  Shield,
  UserCheck,
  RotateCcw,
  PowerOff,
  CheckCircle,
  X,
  Send,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { adminApi } from '../../lib/api/admin';
import { Role } from '../../lib/types/enums';
import type { User, InviteTARequest } from '../../lib/types/api';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  // Filter & Search states
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Invite Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ email: string; firstName: string; lastName: string }>({
    email: '',
    firstName: '',
    lastName: '',
  });

  // Toggle User Status Dialog state
  const [statusDialogUser, setStatusDialogUser] = useState<User | null>(null);

  // Resend Invite State
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);

  // Fetch Users
  const {
    data: usersRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.listUsers(),
  });

  // Mutation: Invite TA Staff
  const inviteMutation = useMutation({
    mutationFn: (data: InviteTARequest) => adminApi.inviteUser(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Invitation sent successfully to TA staff.');
      setIsInviteModalOpen(false);
      setInviteForm({ email: '', firstName: '', lastName: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send invitation.');
    },
  });

  // Mutation: Toggle User Status
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.toggleUserStatus(userId, isActive),
    onSuccess: (_, variables) => {
      toast.success(`User account successfully ${variables.isActive ? 'activated' : 'deactivated'}.`);
      setStatusDialogUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update user status.');
    },
  });

  // Mutation: Resend Invite
  const resendInviteMutation = useMutation({
    mutationFn: (userId: string) => adminApi.resendInvite(userId),
    onSuccess: () => {
      toast.success('Invitation instructions resent to user email.');
      setResendingUserId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to resend invitation.');
      setResendingUserId(null);
    },
  });

  const allUsers: User[] = usersRes?.data || [];

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter((user) => {
      // Role filter
      if (selectedRole !== 'ALL') {
        const userRole = user.role;
        if (selectedRole === 'TALENT_ACQUISITION' && userRole !== Role.TALENT_ACQUISITION && (userRole as string) !== 'TA') {
          return false;
        }
        if (selectedRole === 'ADMINISTRATOR' && userRole !== Role.ADMINISTRATOR && (userRole as string) !== 'ADMIN') {
          return false;
        }
        if (selectedRole === 'APPLICANT' && userRole !== Role.APPLICANT) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        const accStatus = (user.accountStatus || (user.isActive ? 'ACTIVE' : 'DEACTIVATED')).toUpperCase();
        if (selectedStatus === 'ACTIVE' && accStatus !== 'ACTIVE' && user.isActive === false) return false;
        if (selectedStatus === 'PENDING_SETUP' && accStatus !== 'PENDING_SETUP' && accStatus !== 'INVITED') return false;
        if (selectedStatus === 'DEACTIVATED' && accStatus !== 'DEACTIVATED' && user.isActive !== false) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const emailMatch = user.email.toLowerCase().includes(q);
        const nameMatch =
          `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(q) ||
          `${user.applicantProfile?.firstName || ''} ${user.applicantProfile?.lastName || ''}`.toLowerCase().includes(q);
        if (!emailMatch && !nameMatch) return false;
      }

      return true;
    });
  }, [allUsers, selectedRole, selectedStatus, searchQuery]);

  // Pagination
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) {
      toast.error('Please enter a valid email address');
      return;
    }
    inviteMutation.mutate({
      email: inviteForm.email.trim(),
      role: Role.TALENT_ACQUISITION,
      firstName: inviteForm.firstName.trim() || undefined,
      lastName: inviteForm.lastName.trim() || undefined,
    });
  };

  const handleConfirmToggleStatus = () => {
    if (!statusDialogUser) return;
    const isCurrentlyActive = statusDialogUser.isActive ?? (statusDialogUser.accountStatus === 'ACTIVE');
    toggleStatusMutation.mutate({
      userId: statusDialogUser.id,
      isActive: !isCurrentlyActive,
    });
  };

  const handleResendInvite = (user: User) => {
    setResendingUserId(user.id);
    resendInviteMutation.mutate(user.id);
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r === 'ADMINISTRATOR' || r === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Shield className="w-3.5 h-3.5" />
          Administrator
        </span>
      );
    }
    if (r === 'TALENT_ACQUISITION' || r === 'TA') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
          <UserCheck className="w-3.5 h-3.5" />
          Talent Acquisition
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        Applicant
      </span>
    );
  };

  const getUserFullName = (user: User) => {
    if (user.applicantProfile?.firstName || user.applicantProfile?.lastName) {
      return `${user.applicantProfile.firstName || ''} ${user.applicantProfile.lastName || ''}`.trim();
    }
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User & Access Control Management"
          description="Invite talent acquisition recruiters, grant administrator privileges, and manage account statuses."
          breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Users' }]}
        />
        <ErrorState
          title="Failed to load users"
          message={error instanceof Error ? error.message : 'Unable to connect to user management service.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="admin-users-page">
      {/* Header with Invite Button */}
      <PageHeader
        title="User & Access Control Management"
        description="Invite talent acquisition recruiters, grant administrator privileges, and manage account statuses."
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Users' }]}
        actions={
          <button
            onClick={() => setIsInviteModalOpen(true)}
            data-testid="invite-ta-button"
            className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition duration-150 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-teal-400" />
            <span>Invite TA Staff</span>
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl shadow-subtle p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Role Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto" data-testid="role-filter-tabs">
            {[
              { id: 'ALL', label: 'All Users' },
              { id: 'TALENT_ACQUISITION', label: 'Talent Acquisition' },
              { id: 'ADMINISTRATOR', label: 'Administrators' },
              { id: 'APPLICANT', label: 'Applicants' },
            ].map((tab) => (
              <button
                key={tab.id}
                data-testid={`role-tab-${tab.id.toLowerCase()}`}
                onClick={() => {
                  setSelectedRole(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition duration-150 cursor-pointer ${
                  selectedRole === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                data-testid="status-filter-select"
                aria-label="Filter users by account status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-44 h-10 px-3.5 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Accounts</option>
                <option value="PENDING_SETUP">Pending / Invited</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-testid="user-search-input"
                placeholder="Search email, name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-3.5 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="users-table-container">
        {paginatedUsers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No users found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No registered user accounts match the current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="users-table">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-semibold uppercase tracking-wider font-mono text-xs">
                <tr>
                  <th className="py-3.5 px-5">User Details</th>
                  <th className="py-3.5 px-5">Role</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Created / Invited</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedUsers.map((user) => {
                  const fullName = getUserFullName(user);
                  const isPending =
                    user.accountStatus === 'INVITED' ||
                    user.accountStatus === 'PENDING_SETUP' ||
                    user.mustChangePassword;
                  const isActive = user.isActive ?? (user.accountStatus === 'ACTIVE');
                  const statusKey = isPending
                    ? 'PENDING_SETUP'
                    : isActive
                    ? 'ACTIVE'
                    : 'DEACTIVATED';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`user-row-${user.id}`}>
                      {/* User Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{fullName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <StatusBadge status={statusKey} size="sm" />
                      </td>

                      {/* Created / Invited Date */}
                      <td className="py-4 px-5 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {formatTimestamp(user.createdAt || user.invitedAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Resend Invite for pending setup users */}
                          {isPending && (
                            <button
                              onClick={() => handleResendInvite(user)}
                              disabled={resendingUserId === user.id || resendInviteMutation.isPending}
                              data-testid="resend-invite-btn"
                              title="Resend account setup invitation email"
                              className="h-[34px] px-3.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg inline-flex items-center gap-1.5 transition duration-150 disabled:opacity-50 cursor-pointer"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${resendingUserId === user.id ? 'animate-spin' : ''}`} />
                              <span>Resend Invite</span>
                            </button>
                          )}

                          {/* Toggle Active/Deactivate Status */}
                          <button
                            onClick={() => setStatusDialogUser(user)}
                            data-testid="toggle-status-btn"
                            title={isActive ? 'Deactivate user access' : 'Reactivate user account'}
                            className={`h-[34px] px-3.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition duration-150 cursor-pointer ${
                              isActive
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                            }`}
                          >
                            {isActive ? (
                              <>
                                <PowerOff className="w-3.5 h-3.5" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{totalItems}</span> users
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-xs px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite TA Staff Modal */}
      {isInviteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
          data-testid="invite-ta-modal"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
                    <UserPlus className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 id="invite-modal-title" className="text-lg font-bold text-foreground tracking-tight">
                      Invite Talent Acquisition Staff
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      An onboarding email with password setup instructions will be sent.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="invite-email"
                      type="email"
                      required
                      placeholder="recruiter@megs-recruitment.com"
                      data-testid="invite-email-input"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full h-10 pl-9 pr-3.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="invite-firstname" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                      First Name
                    </label>
                    <input
                      id="invite-firstname"
                      type="text"
                      placeholder="e.g. Maria"
                      data-testid="invite-firstname-input"
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                      className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="invite-lastname" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                      Last Name
                    </label>
                    <input
                      id="invite-lastname"
                      type="text"
                      placeholder="e.g. Santos"
                      data-testid="invite-lastname-input"
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                      className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-600 leading-relaxed">
                  <strong>Access Granted:</strong> Role will be configured as{' '}
                  <span className="font-semibold text-teal-700">Talent Acquisition Specialist</span> with pipeline management, MRF intake, and candidate scoring visibility.
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    disabled={inviteMutation.isPending}
                    className="h-10 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    data-testid="invite-submit-button"
                    className="h-10 px-4 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm inline-flex items-center gap-2 transition duration-150 disabled:opacity-50 cursor-pointer"
                  >
                    {inviteMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Send Invitation</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        isOpen={statusDialogUser !== null}
        title={
          statusDialogUser?.isActive ?? (statusDialogUser?.accountStatus === 'ACTIVE')
            ? 'Deactivate User Account'
            : 'Reactivate User Account'
        }
        description={
          <span>
            Are you sure you want to{' '}
            <strong>
              {statusDialogUser?.isActive ?? (statusDialogUser?.accountStatus === 'ACTIVE')
                ? 'deactivate'
                : 'reactivate'}
            </strong>{' '}
            the account for <strong>{statusDialogUser?.email}</strong>?
            {statusDialogUser?.isActive ?? (statusDialogUser?.accountStatus === 'ACTIVE')
              ? ' The user will be immediately logged out and blocked from signing in.'
              : ' The user will regain access according to their assigned role.'}
          </span>
        }
        variant={
          statusDialogUser?.isActive ?? (statusDialogUser?.accountStatus === 'ACTIVE')
            ? 'danger'
            : 'primary'
        }
        confirmText={
          statusDialogUser?.isActive ?? (statusDialogUser?.accountStatus === 'ACTIVE')
            ? 'Deactivate Account'
            : 'Reactivate Account'
        }
        isLoading={toggleStatusMutation.isPending}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setStatusDialogUser(null)}
      />
    </div>
  );
}
