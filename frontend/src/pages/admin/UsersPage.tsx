import React, { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import type { AdminUserListItem, AdminUserLastLogin, AdminUserStatus } from "../../lib/api/admin.api";
import type { BulkSummary } from "../../lib/types/application.types";
import { authApi } from "../../lib/api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  ActionMenu,
  BulkActionBar,
  BulkResultDialog,
  SelectBox,
} from "../../components/common";
import { Button, Dialog, Input, Select } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { Role } from "../../lib/types/enums";
import {
  Users,
  UserPlus,
  Mail,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { notify, fieldErrorsFrom, formatErrorMessage } from "../../lib/feedback";
import { formatAdminRole } from "../../lib/admin-copy";
import { FeedbackBanner, ToneBadge } from "./admin-ui";
import { validatePersonName } from "../../lib/statutory-validation";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useRowSelection } from "../../hooks/useRowSelection";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";
import { z } from "zod";

const EMPTY_USERS: AdminUserListItem[] = [];
const inviteEmailSchema = z.string().trim().email("Enter a valid email address.");

// Same buckets as the backend status filter: inactive wins, then invited, otherwise active.
const accountState = (user: AdminUserListItem): AdminUserStatus =>
  !user.isActive || user.accountStatus === "DEACTIVATED" ? "inactive"
  : user.accountStatus === "PENDING" || user.accountStatus === "INVITED" ? "invited"
  : "active";

const AccountStatus: React.FC<{ user: AdminUserListItem }> = ({ user }) => {
  const state = accountState(user);
  if (state === "inactive") return <ToneBadge tone="danger">Inactive</ToneBadge>;
  if (state === "invited") return user.invitationStatus === "EXPIRED" ? <ToneBadge tone="warning">Invitation expired</ToneBadge> : <ToneBadge tone="info">Invitation pending</ToneBadge>;
  return <ToneBadge tone="success">Active</ToneBadge>;
};

type BulkUserAction = "deactivate" | "reactivate" | "resend";

const BULK_USER_ACTIONS: Record<BulkUserAction, { label: string; title: string; fits: (u: AdminUserListItem) => boolean }> = {
  deactivate: { label: "Deactivate", title: "Deactivate accounts", fits: (u) => accountState(u) === "active" },
  reactivate: { label: "Reactivate", title: "Reactivate accounts", fits: (u) => accountState(u) === "inactive" },
  resend: { label: "Resend invitation", title: "Resend invitations", fits: (u) => accountState(u) === "invited" },
};

const ROLE_OPTIONS = [
  { value: Role.ADMINISTRATOR, label: "Administrator" },
  { value: Role.TALENT_ACQUISITION, label: "Recruiter" },
  { value: Role.APPLICANT, label: "Applicant" },
];

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentAdmin } = useAuth();

  const [search, setSearch] = useState("");
  // Role and status live in the URL so overview tiles can link to a filtered list.
  const navigate = useNavigate();
  const urlSearch = useSearch({ strict: false }) as { role?: Role; status?: AdminUserStatus; lastLogin?: AdminUserLastLogin };
  const roleFilter = urlSearch.role ?? "";
  const statusFilter = urlSearch.status ?? "";
  const lastLoginFilter = urlSearch.lastLogin ?? "";
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");

  const [roleModalUser, setRoleModalUser] = useState<{ id: string; email: string; currentRole: Role } | null>(null);
  const [targetRole, setTargetRole] = useState<Role>(Role.TALENT_ACQUISITION);

  const [statusModalUser, setStatusModalUser] = useState<{ id: string; email: string; isActive: boolean; role: string } | null>(null);
  // A departing TA's requests, clients and openings can be handed to another TA as the account is deactivated.
  const [handoverTo, setHandoverTo] = useState("");
  const [handingOver, setHandingOver] = useState(false);
  const [mfaModalUser, setMfaModalUser] = useState<{ id: string; email: string } | null>(null);
  const [resendModalUser, setResendModalUser] = useState<{ id: string; email: string } | null>(null);
  const [cancelModalUser, setCancelModalUser] = useState<{ id: string; email: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserSnapshot, setSelectedUserSnapshot] = useState<AdminUserListItem | null>(null);

  const clearSelectedUser = () => {
    setSelectedUserId(null);
    setSelectedUserSnapshot(null);
  };

  const updateSelectedUserSnapshot = (user: AdminUserListItem) => {
    if (selectedUserId === user.id) setSelectedUserSnapshot(user);
  };

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { page, pageSize, search: debouncedSearch, role: roleFilter, status: statusFilter, lastLogin: lastLoginFilter }],
    queryFn: ({ signal }) => adminApi.listUsersPage({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      role: (roleFilter as Role) || undefined,
      status: statusFilter || undefined,
      lastLogin: lastLoginFilter || undefined,
    }, { signal }),
    placeholderData: keepPreviousData,
  });

  // Mutations
  const [inviteFieldErrors, setInviteFieldErrors] = useState<Record<string, string>>({});
  const clearInviteFieldError = (field: string) =>
    setInviteFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const inviteMutation = useMutation({
    mutationFn: adminApi.inviteTA,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      updateSelectedUserSnapshot(user);
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteFieldErrors({});
       const msg = "A secure account setup link was emailed to the recruiter.";
      setFeedback({
        type: "success",
        message: msg,
      });
      notify.success("Invitation Sent", msg);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
         message: "We couldn't send the invitation. Please check the email address and try again.",
      });
      const fieldErrors = fieldErrorsFrom(err);
      if (Object.keys(fieldErrors).length > 0) {
        setInviteFieldErrors(fieldErrors);
        notify.error("Check the highlighted fields", Object.values(fieldErrors)[0]);
        return;
      }
      notify.error("Invitation Failed", err);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (userId: string) => adminApi.resendTAInvitation(userId),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
       updateSelectedUserSnapshot(user);
       setResendModalUser(null);
       clearSelectedUser();
       notify.success("Invitation sent", "A new account setup link was emailed.");
    },
    onError: (err: any) => {
      notify.error("Resend Failed", err);
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (userId: string) => adminApi.cancelTAInvitation(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
       if (selectedUserId === userId) clearSelectedUser();
       setCancelModalUser(null);
       notify.success("Invitation cancelled", "The pending invitation can no longer be used.");
    },
    onError: (err: any) => {
      notify.error("Cancellation Failed", err);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      adminApi.updateUserRole(id, role),
    onSuccess: (user, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
       updateSelectedUserSnapshot(user);
       setRoleModalUser(null);
       clearSelectedUser();
       notify.success("Access updated", `This user's access is now ${formatAdminRole(vars.role)}.`);
    },
    onError: (err: any) => {
      notify.error("Role Update Failed", err);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateUserStatus(id, isActive),
    onSuccess: (user, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
       updateSelectedUserSnapshot(user);
       setStatusModalUser(null);
       clearSelectedUser();
      notify.success(
        "Account status updated",
        `The user can ${vars.isActive ? "now" : "no longer"} sign in.`
      );
    },
    onError: (err: any) => {
      notify.error("Status Update Failed", err);
    },
  });

  const handoverOptionsQuery = useQuery({
    queryKey: ["admin", "analytics", "filters"],
    queryFn: () => adminApi.getFilterOptions(),
    enabled: Boolean(statusModalUser?.isActive && statusModalUser.role === "TALENT_ACQUISITION"),
    staleTime: 5 * 60 * 1000,
  });
  const handoverCandidates = (handoverOptionsQuery.data?.recruiters ?? []).filter((r) => r.id !== statusModalUser?.id);

  const closeStatusModal = () => {
    setStatusModalUser(null);
    setHandoverTo("");
    clearSelectedUser();
  };

  const confirmStatusChange = async () => {
    if (!statusModalUser) return;
    if (statusModalUser.isActive && handoverTo) {
      setHandingOver(true);
      try {
        const moved = await adminApi.reassignTaRecords(statusModalUser.id, handoverTo);
        notify.success(
          "Records handed over",
          `${moved.manpowerRequests} requests, ${moved.clients} clients and ${moved.standaloneJobs} standalone openings moved.`,
        );
        queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
      } catch (err) {
        notify.error("Could not hand over their records", err);
        setHandingOver(false);
        return;
      }
      setHandingOver(false);
    }
    updateStatusMutation.mutate({ id: statusModalUser.id, isActive: !statusModalUser.isActive });
    setHandoverTo("");
  };

  const resetMfaMutation = useMutation({
    mutationFn: (userId: string) => authApi.resetUserMfa(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
       setMfaModalUser(null);
       clearSelectedUser();
      notify.success(
        "Two-step verification reset",
        "The user will set up two-step verification again at their next sign-in."
      );
    },
    onError: (err: any) => {
       notify.error("Couldn't reset two-step verification", err);
    },
  });

  const userData = usersQuery.data;
  const users = userData?.items ?? EMPTY_USERS;
  const selectedUserInCurrentPage = selectedUserId ? users.find((user) => user.id === selectedUserId) : null;
  const selectedUser = selectedUserInCurrentPage ??
    (selectedUserSnapshot?.id === selectedUserId ? selectedUserSnapshot : null);

  React.useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserSnapshot(null);
      return;
    }
    const currentUser = users.find((user) => user.id === selectedUserId);
    if (currentUser) setSelectedUserSnapshot(currentUser);
  }, [users, selectedUserId]);

  const totalItems = userData?.total ?? users.length;
  const totalPages = userData?.totalPages ?? 1;
  const paginatedUsers = users;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const setUrlFilters = (next: { role?: string; status?: string; lastLogin?: string }) => {
    setPage(1);
    void navigate({
      to: "/admin/users",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
      replace: true,
    } as never);
  };

  const handleFilterChange = (key: string, val: string) => setUrlFilters({ [key]: val || undefined });

  const handleReset = () => {
    setSearch("");
    setUrlFilters({ role: undefined, status: undefined, lastLogin: undefined });
  };

  // Bulk actions. Selection is dropped whenever the visible list changes (filters, search, page).
  const selection = useRowSelection(JSON.stringify([page, debouncedSearch, roleFilter, statusFilter, lastLoginFilter]));
  const selectedRows = users.filter((u) => selection.selectedIds.has(u.id));
  const selectableRows = users.filter((u) => u.id !== currentAdmin?.id);
  const allOnPageSelected = selectableRows.length > 0 && selectableRows.every((u) => selection.selectedIds.has(u.id));
  const toggleAllOnPage = () =>
    selection.setSelectedIds(allOnPageSelected ? new Set() : new Set(selectableRows.map((u) => u.id)));
  const toggleRow = (id: string) =>
    selection.setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const bulkActionsFit = (Object.keys(BULK_USER_ACTIONS) as BulkUserAction[]).filter((action) =>
    selectedRows.every(BULK_USER_ACTIONS[action].fits),
  );

  const [bulkAction, setBulkAction] = useState<BulkUserAction | null>(null);
  const [bulkResult, setBulkResult] = useState<{ title: string; summary: BulkSummary; rows: AdminUserListItem[] } | null>(null);

  // No bulk endpoint: run the single-user calls side by side. Row ids in the summary are positions in `rows`.
  const bulkMutation = useMutation({
    mutationFn: async ({ action, rows }: { action: BulkUserAction; rows: AdminUserListItem[] }): Promise<BulkSummary> => {
      const settled = await Promise.allSettled(
        rows.map((u) =>
          action === "resend" ? adminApi.resendTAInvitation(u.id) : adminApi.updateUserStatus(u.id, action === "reactivate"),
        ),
      );
      const results = settled.map((outcome, index) =>
        outcome.status === "fulfilled"
          ? { id: index, ok: true }
          : { id: index, ok: false, reason: formatErrorMessage(outcome.reason) },
      );
      const failed = results.filter((row) => !row.ok).length;
      return { succeeded: results.length - failed, failed, results };
    },
    onSuccess: (summary, { action, rows }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      // Only the rows that went through leave the selection, so the failed ones can be retried.
      selection.remove(summary.results.filter((row) => row.ok).map((row) => rows[row.id].id));
      setBulkAction(null);
      const title = BULK_USER_ACTIONS[action].title;
      if (summary.failed > 0) setBulkResult({ title, summary, rows });
      else notify.success(title, `${summary.succeeded} ${summary.succeeded === 1 ? "account" : "accounts"} done.`);
    },
    onError: (err: any) => notify.error("Unable to complete the bulk action", err),
  });

  const renderLastSignIn = (u: AdminUserListItem) =>
    u.lastLoginAt ? <time dateTime={u.lastLoginAt}>{formatDateTime(u.lastLoginAt)}</time> : "Never";

  const userLabel = (u: AdminUserListItem) =>
    u.applicantProfile ? `${u.applicantProfile.firstName} ${u.applicantProfile.lastName}` : u.email;

  // Inline role edit. Picking a role only opens the confirm dialog; the select keeps showing the saved role.
  const renderRole = (u: AdminUserListItem) => {
    const editable = currentAdmin?.id !== u.id && u.role !== Role.APPLICANT && accountState(u) !== "invited";
    if (!editable) return formatAdminRole(u.role);
    return (
      <select
        aria-label={`Role for ${u.email}`}
        value={u.role}
        onChange={(e) => {
          setRoleModalUser({ id: u.id, email: u.email, currentRole: u.role });
          setTargetRole(e.target.value as Role);
        }}
        className="min-h-9 w-full max-w-44 cursor-pointer rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:min-h-11"
      >
        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        flush
        description="Invite recruiters and manage who can sign in."
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Users" },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setInviteModalOpen(true)}
          >
            Invite recruiter
          </Button>
        }
      />

      {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />}

      {/* Filters */}
      <SearchFilters
        className="mb-5! rounded-md"
        searchPlaceholder="Search users by name or email..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{ role: roleFilter, status: statusFilter, lastLogin: lastLoginFilter }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "role",
             label: "Role",
            options: [
               { value: Role.ADMINISTRATOR, label: "Administrator" },
               { value: Role.TALENT_ACQUISITION, label: "Recruiter" },
               { value: Role.APPLICANT, label: "Applicant" },
            ],
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "invited", label: "Invited" },
            ],
          },
          {
            key: "lastLogin",
            label: "Last sign-in",
            options: [
              { value: "7d", label: "Past 7 days" },
              { value: "30d", label: "Past 30 days" },
              { value: "never", label: "Never" },
            ],
          },
        ]}
      />

      <BulkActionBar
        count={selectedRows.length}
        onClear={selection.clear}
        note={totalItems > users.length ? `on this page (${totalItems} in the list)` : undefined}
        emptyHint="No action fits this mix. Select only active, inactive or invited accounts."
      >
        {bulkActionsFit.length > 0 && bulkActionsFit.map((action) => (
          <Button key={action} size="sm" variant={action === "deactivate" ? "danger" : "outline"} onClick={() => setBulkAction(action)}>
            {BULK_USER_ACTIONS[action].label}
          </Button>
        ))}
      </BulkActionBar>

      {/* Users Table */}
      {usersQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
      ) : users.length === 0 ? (
        <div className="rounded-md border border-slate-300 bg-white p-6">
          <EmptyState
            icon={<Users className="w-5 h-5" />}
             title="No users found"
             description="No accounts match your search or filters."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-300 bg-white">
          {selectedUser && (
            <div className="px-3.5 py-2.5 bg-navy-soft border-b border-navy-line text-sm text-slate-900" role="status" aria-live="polite">
              Selected account: <strong>{selectedUser.applicantProfile ? `${selectedUser.applicantProfile.firstName} ${selectedUser.applicantProfile.lastName}` : selectedUser.email}</strong>
            </div>
          )}
          <div className="md:hidden divide-y divide-slate-200">
            {paginatedUsers.map((u) => {
              const isSelf = currentAdmin?.id === u.id;
              const profile = u.applicantProfile;
              const fullName = profile ? `${profile.firstName} ${profile.lastName}` : null;
              return (
                <div
                  key={u.id}
                  aria-selected={selectedUserId === u.id}
                  className={`p-4 space-y-3 transition-colors ${selectedUserId === u.id ? "bg-navy-soft" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <SelectBox
                      checked={selection.selectedIds.has(u.id)}
                      disabled={isSelf}
                      label={`Select ${userLabel(u)}`}
                      onChange={() => toggleRow(u.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-950 break-words">
                        {fullName || u.email}
                        {isSelf && <span className="ml-1.5 font-normal text-slate-600">(you)</span>}
                      </div>
                      {fullName && <div className="text-sm text-slate-600 break-all">{u.email}</div>}
                    </div>
                    <ActionMenu
                      label={`Actions for ${u.email}`}
                      onOpenChange={(open) => {
                        setSelectedUserId(open ? u.id : null);
                        setSelectedUserSnapshot(open ? u : null);
                      }}
                      items={
                        u.accountStatus === "PENDING" || u.accountStatus === "INVITED"
                          ? [
                              { label: "Resend invitation", onSelect: () => setResendModalUser({ id: u.id, email: u.email }) },
                              { label: "Cancel invitation", tone: "danger", onSelect: () => setCancelModalUser({ id: u.id, email: u.email }) },
                            ]
                          : [
                              {
                                label: "Change role",
                                disabled: isSelf || u.role === Role.APPLICANT,
                                onSelect: () => {
                                  setRoleModalUser({ id: u.id, email: u.email, currentRole: u.role });
                                  setTargetRole(u.role);
                                },
                              },
                              ...(u.role !== Role.APPLICANT
                                ? [{ label: "Reset two-step verification", disabled: isSelf, onSelect: () => setMfaModalUser({ id: u.id, email: u.email }) }]
                                : []),
                              {
                                label: u.isActive ? "Deactivate account" : "Reactivate account",
                                tone: u.isActive ? "danger" : "default",
                                disabled: isSelf,
                                onSelect: () => setStatusModalUser({ id: u.id, email: u.email, isActive: u.isActive, role: u.role }),
                              },
                            ]
                      }
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-sm text-slate-600">Role</dt>
                      <dd className="font-medium text-slate-800">{renderRole(u)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-600">Status</dt>
                      <dd className="mt-0.5"><AccountStatus user={u} /></dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-600">Last sign-in</dt>
                      <dd className="text-slate-700">{renderLastSignIn(u)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-600">Created</dt>
                      <dd className="text-slate-700">{formatDate(u.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-300">
                <tr>
                  <th scope="col" className="w-10 px-3 py-1">
                    <SelectBox
                      checked={allOnPageSelected}
                      indeterminate={selectedRows.length > 0 && !allOnPageSelected}
                      disabled={selectableRows.length === 0}
                      label="Select all accounts on this page"
                      onChange={toggleAllOnPage}
                    />
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Account</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Last sign-in</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Created</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedUsers.map((u) => {
                  const isSelf = currentAdmin?.id === u.id;
                  const profile = u.applicantProfile;
                  const fullName = profile
                    ? `${profile.firstName} ${profile.lastName}`
                    : null;

                  return (
                    <tr
                      key={u.id}
                      aria-selected={selectedUserId === u.id}
                      className={`transition-colors ${selectedUserId === u.id || selection.selectedIds.has(u.id) ? "bg-navy-soft" : "hover:bg-slate-50"}`}
                    >
                      <td className="w-10 px-3 align-middle">
                        <SelectBox
                          checked={selection.selectedIds.has(u.id)}
                          disabled={isSelf}
                          label={`Select ${userLabel(u)}`}
                          onChange={() => toggleRow(u.id)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-950 break-all">
                          {u.email}
                          {isSelf && <span className="ml-1.5 font-normal text-slate-600">(you)</span>}
                        </div>
                        {fullName && <div className="text-sm text-slate-600">{fullName}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {renderRole(u)}
                      </td>
                      <td className="px-3 py-3">
                        <AccountStatus user={u} />
                      </td>
                      <td className="px-3 py-3 text-slate-600 tabular-nums">
                        {renderLastSignIn(u)}
                      </td>
                      <td className="px-3 py-3 text-slate-600 tabular-nums">
                        {formatDate(u.createdAt)}
                      </td>
                       <td className="px-3 py-1.5 text-right">
                         <ActionMenu
                           label={`Actions for ${u.email}`}
                           onOpenChange={(open) => {
                             setSelectedUserId(open ? u.id : null);
                             setSelectedUserSnapshot(open ? u : null);
                           }}
                           items={
                             u.accountStatus === "PENDING" || u.accountStatus === "INVITED"
                               ? [
                                   {
                                     label: "Resend invitation",
                                     onSelect: () => setResendModalUser({ id: u.id, email: u.email }),
                                   },
                                   {
                                     label: "Cancel invitation",
                                     tone: "danger",
                                     onSelect: () => setCancelModalUser({ id: u.id, email: u.email }),
                                   },
                                 ]
                               : [
                                   {
                                     label: "Change role",
                                     disabled: isSelf || u.role === Role.APPLICANT,
                                     onSelect: () => {
                                       setRoleModalUser({ id: u.id, email: u.email, currentRole: u.role });
                                       setTargetRole(u.role);
                                     },
                                   },
                                   ...(u.role !== Role.APPLICANT
                                     ? [
                                         {
                                           label: "Reset two-step verification",
                                           disabled: isSelf,
                                           onSelect: () => setMfaModalUser({ id: u.id, email: u.email }),
                                         } as const,
                                       ]
                                     : []),
                                   {
                                     label: u.isActive ? "Deactivate account" : "Reactivate account",
                                     tone: u.isActive ? "danger" : "default",
                                     disabled: isSelf,
                                     onSelect: () =>
                                       setStatusModalUser({ id: u.id, email: u.email, isActive: u.isActive, role: u.role }),
                                   },
                                 ]
                           }
                         />
                       </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-3 py-2 border-t border-slate-300">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="users"
            />
          </div>
        </div>
      )}

      {/* Bulk action confirm */}
      <Dialog
        open={Boolean(bulkAction)}
        onClose={() => setBulkAction(null)}
        title={bulkAction ? BULK_USER_ACTIONS[bulkAction].title : ""}
        description={`${selectedRows.length} ${selectedRows.length === 1 ? "account" : "accounts"} selected.`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {bulkAction === "deactivate" && "They will no longer be able to sign in or use MEGS."}
            {bulkAction === "reactivate" && "They will be able to sign in again with their current role."}
            {bulkAction === "resend" && "Each previous link will stop working and a new link will be valid for 48 hours."}
          </p>
          {bulkAction === "deactivate" && selectedRows.some((u) => u.role === Role.TALENT_ACQUISITION) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2.5 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Requests, clients and openings owned by selected recruiters are not handed over. Their records stay Admin-only until you reassign them.
              </p>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setBulkAction(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant={bulkAction === "deactivate" ? "danger" : "primary"}
              size="sm"
              loading={bulkMutation.isPending}
              className="w-full sm:w-auto"
              onClick={() => bulkAction && bulkMutation.mutate({ action: bulkAction, rows: selectedRows })}
            >
              {bulkAction ? BULK_USER_ACTIONS[bulkAction].label : ""}
            </Button>
          </div>
        </div>
      </Dialog>

      <BulkResultDialog
        open={Boolean(bulkResult)}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ""}
        summary={bulkResult?.summary ?? null}
        labelFor={(index) => bulkResult?.rows[index]?.email ?? "Account"}
      />

      {/* Invite TA Modal */}
      <Dialog
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setInviteFieldErrors({});
        }}
        title="Invite a recruiter"
        description="We'll email a secure account setup link to this person."
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteEmail.trim()) {
              setInviteFieldErrors((prev) => ({ ...prev, email: "Email is required." }));
              return;
            }
            if (!inviteEmailSchema.safeParse(inviteEmail).success) {
              setInviteFieldErrors((prev) => ({ ...prev, email: "Enter a valid email address." }));
              return;
            }
            if (inviteFirstName.trim()) {
              const fnErr = validatePersonName(inviteFirstName, "First name");
              if (fnErr) {
                notify.error("Check the highlighted fields", fnErr);
                return;
              }
            }
            if (inviteLastName.trim()) {
              const lnErr = validatePersonName(inviteLastName, "Last name");
              if (lnErr) {
                notify.error("Check the highlighted fields", lnErr);
                return;
              }
            }
            inviteMutation.mutate({
              email: inviteEmail,
              firstName: inviteFirstName.trim() || undefined,
              lastName: inviteLastName.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Work email"
            type="email"
            placeholder="e.g. recruiter@megs.ph"
            value={inviteEmail}
            error={inviteFieldErrors.email}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              clearInviteFieldError("email");
            }}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="First name (optional)"
              placeholder="e.g. Maria"
              nameInput
              value={inviteFirstName}
              error={inviteFieldErrors.firstName}
              onChange={(e) => {
                setInviteFirstName(e.target.value);
                clearInviteFieldError("firstName");
              }}
            />
            <Input
              label="Last name (optional)"
              placeholder="e.g. Santos"
              nameInput
              value={inviteLastName}
              error={inviteFieldErrors.lastName}
              onChange={(e) => {
                setInviteLastName(e.target.value);
                clearInviteFieldError("lastName");
              }}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setInviteModalOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={inviteMutation.isPending}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
            >
              Send invitation
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog
        open={Boolean(roleModalUser)}
        onClose={() => { setRoleModalUser(null); clearSelectedUser(); }}
        title="Change role"
        description={`Choose what ${roleModalUser?.email} can access.`}
      >
        <div className="space-y-4">
          <Select
             label="Role"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value as Role)}
            options={[
               { value: Role.TALENT_ACQUISITION, label: "Recruiter — hiring workspace" },
               { value: Role.ADMINISTRATOR, label: "Administrator — full admin access" },
               { value: Role.APPLICANT, label: "Applicant — candidate portal" },
            ]}
          />
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setRoleModalUser(null); clearSelectedUser(); }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateRoleMutation.isPending}
              className="w-full sm:w-auto"
              onClick={() => {
                if (roleModalUser) {
                  updateRoleMutation.mutate({ id: roleModalUser.id, role: targetRole });
                }
              }}
            >
              Save role
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Status Toggle Modal */}
      <Dialog
        open={Boolean(statusModalUser)}
        onClose={closeStatusModal}
        title={statusModalUser?.isActive ? "Deactivate account" : "Reactivate account"}
        description={`Are you sure you want to ${statusModalUser?.isActive ? "deactivate" : "reactivate"} ${statusModalUser?.email}?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {statusModalUser?.isActive
               ? "They will no longer be able to sign in or use MEGS."
               : "They will be able to sign in again with their current role."}
          </p>
          {statusModalUser?.isActive && statusModalUser.role === "TALENT_ACQUISITION" && (
            <Select
              label="Hand over their records to"
              helperText="Their requests, clients and standalone openings, with the candidates and placements under them. If you skip this, only an Admin can see those records until you reassign them."
              value={handoverTo}
              onChange={(e) => setHandoverTo(e.target.value)}
              options={[{ value: "", label: "Do not hand over yet" }, ...handoverCandidates.map((r) => ({ value: r.id, label: r.name }))]}
              disabled={handoverOptionsQuery.isLoading}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={closeStatusModal} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant={statusModalUser?.isActive ? "danger" : "primary"}
              size="sm"
              loading={updateStatusMutation.isPending || handingOver}
              className="w-full sm:w-auto"
              onClick={() => void confirmStatusChange()}
            >
              {statusModalUser?.isActive ? (handoverTo ? "Hand over and deactivate" : "Deactivate account") : "Reactivate account"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Reset MFA Modal */}
      <Dialog
        open={Boolean(mfaModalUser)}
        onClose={() => { setMfaModalUser(null); clearSelectedUser(); }}
        title="Reset two-step verification"
        description={`Reset sign-in verification for ${mfaModalUser?.email}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2.5 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
               Their current verification app and recovery codes will stop working. They must set up two-step verification again at their next sign-in.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setMfaModalUser(null); clearSelectedUser(); }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={resetMfaMutation.isPending}
              leftIcon={<KeyRound className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
              onClick={() => {
                if (mfaModalUser) {
                  resetMfaMutation.mutate(mfaModalUser.id);
                }
              }}
            >
              Reset two-step verification
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Resend Invitation Modal */}
      <Dialog
        open={Boolean(resendModalUser)}
        onClose={() => { setResendModalUser(null); clearSelectedUser(); }}
        title="Resend invitation"
        description={`Send a new account setup link to ${resendModalUser?.email}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
             The previous link will stop working and a new link will be valid for 48 hours.
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setResendModalUser(null); clearSelectedUser(); }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={resendInviteMutation.isPending}
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
              onClick={() => {
                if (resendModalUser) {
                  resendInviteMutation.mutate(resendModalUser.id);
                }
              }}
            >
              Resend invitation
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Cancel Invitation Modal */}
      <Dialog
        open={Boolean(cancelModalUser)}
        onClose={() => { setCancelModalUser(null); clearSelectedUser(); }}
        title="Cancel invitation"
        description={`Stop the pending invitation for ${cancelModalUser?.email}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
             The setup link will stop working and the pending account will be removed.
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setCancelModalUser(null); clearSelectedUser(); }} className="w-full sm:w-auto">
              Keep Invitation
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={cancelInviteMutation.isPending}
              className="w-full sm:w-auto"
              onClick={() => {
                if (cancelModalUser) {
                  cancelInviteMutation.mutate(cancelModalUser.id);
                }
              }}
            >
              Cancel invitation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

