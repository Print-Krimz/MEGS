import React, { useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import type { AdminUserListItem } from "../../lib/api/admin.api";
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
} from "../../components/common";
import { Button, Dialog, Input, Select } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { Role } from "../../lib/types/enums";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Mail,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { notify, fieldErrorsFrom } from "../../lib/feedback";
import { formatAdminRole } from "../../lib/admin-copy";
import { validatePersonName } from "../../lib/statutory-validation";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";
import { z } from "zod";

const EMPTY_USERS: AdminUserListItem[] = [];
const inviteEmailSchema = z.string().trim().email("Enter a valid email address.");

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
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
    queryKey: ["admin", "users", { page, pageSize, search: debouncedSearch, role: roleFilter }],
    queryFn: ({ signal }) => adminApi.listUsersPage({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      role: (roleFilter as Role) || undefined,
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

  const handleRoleFilterChange = (val: string) => {
    setRoleFilter(val);
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setRoleFilter("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users and access"
        description="Invite recruiters, review accounts, and manage who can use each part of MEGS."
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

      {feedback && (
        <div
           role={feedback.type === "error" ? "alert" : "status"}
           aria-live="polite"
           className={`p-3 border text-sm flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-700 text-teal-950"
              : "bg-rose-50 border-rose-700 text-rose-950"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
             aria-label="Dismiss message"
             className="min-h-11 min-w-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <SearchFilters
        searchPlaceholder="Search users by name or email..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{ role: roleFilter }}
        onFilterChange={(_, v) => handleRoleFilterChange(v)}
        onReset={handleReset}
        filters={[
          {
            key: "role",
             label: "Access level",
            options: [
               { value: Role.ADMINISTRATOR, label: "Administrator" },
               { value: Role.TALENT_ACQUISITION, label: "Recruiter" },
               { value: Role.APPLICANT, label: "Applicant" },
            ],
          },
        ]}
      />

      {/* Users Table */}
      {usersQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
      ) : users.length === 0 ? (
        <div className="admin-panel p-6">
          <EmptyState
            icon={<Users className="w-5 h-5" />}
             title="No users found"
             description="No accounts match your search or access-level filter."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="admin-panel overflow-hidden">
          {selectedUser && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-950" role="status" aria-live="polite">
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
                  className={`p-4 space-y-3 transition-colors ${selectedUserId === u.id ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-950 break-words">
                        {fullName || u.email}
                        {isSelf && <span className="ml-2 text-sm text-teal-800">(you)</span>}
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
                                label: "Change access",
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
                      <dt className="text-sm text-slate-500">Access level</dt>
                      <dd className="font-medium text-slate-800">{formatAdminRole(u.role)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-500">Status</dt>
                      <dd className="font-medium text-slate-800">
                        {!u.isActive || u.accountStatus === "DEACTIVATED"
                          ? "Inactive"
                          : u.accountStatus === "PENDING" || u.accountStatus === "INVITED"
                          ? u.invitationStatus === "EXPIRED" ? "Invitation expired" : "Invitation pending"
                          : "Active"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-500">Created</dt>
                      <dd className="text-slate-700">{formatDate(u.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-sans  text-xs border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Account</th>
                  <th className="px-3.5 py-2.5 font-bold">Access level</th>
                  <th className="px-3.5 py-2.5 font-bold">Status</th>
                  <th className="px-3.5 py-2.5 font-bold">Created</th>
                  <th className="px-3.5 py-2.5 font-bold text-right">Actions</th>
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
                      className={`transition-colors ${selectedUserId === u.id ? "bg-amber-50" : "hover:bg-slate-100/70"}`}
                    >
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-950 flex items-center gap-1.5 font-sans">
                          <span>{u.email}</span>
                          {isSelf && (
                            <span className="text-xs font-sans font-bold px-1 py-0.2 bg-teal-100 border border-teal-300 text-teal-800">
                               (you)
                            </span>
                          )}
                        </div>
                        {fullName && (
                           <div className="text-sm text-slate-600">
                            {fullName}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                           className={`inline-flex items-center gap-1 text-sm font-sans font-semibold px-2 py-1 border ${
                            u.role === Role.ADMINISTRATOR
                              ? "bg-purple-50 text-purple-950 border-purple-300"
                              : u.role === Role.TALENT_ACQUISITION
                              ? "bg-teal-50 text-teal-950 border-teal-300"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}
                        >
                           {u.role === Role.ADMINISTRATOR ? (
                            <Shield className="w-3 h-3 text-purple-700" />
                          ) : (
                            <ShieldCheck className="w-3 h-3 text-teal-700" />
                          )}
                           <span>{formatAdminRole(u.role)}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {!u.isActive || u.accountStatus === "DEACTIVATED" ? (
                           <span className="text-sm font-sans font-semibold px-2 py-1 border bg-rose-50 text-rose-950 border-rose-300">
                             Inactive
                          </span>
                        ) : u.accountStatus === "PENDING" || u.accountStatus === "INVITED" ? (
                          <span
                             className={`text-sm font-sans font-semibold px-2 py-1 border ${
                              u.invitationStatus === "EXPIRED"
                                ? "bg-amber-50 text-amber-950 border-amber-300"
                                : "bg-blue-50 text-blue-950 border-blue-300"
                            }`}
                          >
                             {u.invitationStatus === "EXPIRED" ? "Invitation expired" : "Invitation pending"}
                          </span>
                        ) : (
                           <span className="text-sm font-sans font-semibold px-2 py-1 border bg-emerald-50 text-emerald-950 border-emerald-300">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 text-xs">
                        {formatDate(u.createdAt)}
                      </td>
                       <td className="px-3.5 py-2.5 text-right font-sans">
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
                                     label: "Change access",
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
          <div className="p-3 border-t border-slate-300 bg-slate-50">
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
        title="Change access"
        description={`Choose what ${roleModalUser?.email} can access.`}
      >
        <div className="space-y-4">
          <Select
             label="Access level"
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
              Save access level
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
               : "They will be able to sign in again with their current access level."}
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
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-sm text-amber-900">
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

