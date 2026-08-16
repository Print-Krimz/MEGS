import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { useAuth } from "../../hooks/useAuth";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
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
} from "lucide-react";

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");

  // Role Modal
  const [roleModalUser, setRoleModalUser] = useState<{ id: string; email: string; currentRole: Role } | null>(null);
  const [targetRole, setTargetRole] = useState<Role>(Role.TALENT_ACQUISITION);

  // Status Modal
  const [statusModalUser, setStatusModalUser] = useState<{ id: string; email: string; isActive: boolean } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: adminApi.listUsers,
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: adminApi.inviteTA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setFeedback({
        type: "success",
        message: "Invitation sent! The TA specialist has been provisioned with temporary setup credentials.",
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to send invitation: " + err.message,
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      adminApi.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      setRoleModalUser(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateUserStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      setStatusModalUser(null);
    },
  });

  const users = usersQuery.data || [];

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.applicantProfile &&
        `${u.applicantProfile.firstName} ${u.applicantProfile.lastName}`
          .toLowerCase()
          .includes(search.toLowerCase()));

    const matchesRole = !roleFilter || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

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
        title="User Access & Role Administration"
        description="Manage system accounts, provision Talent Acquisition credentials, and configure role assignments"
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
          { label: "Users" },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setInviteModalOpen(true)}
          >
            Invite TA Specialist
          </Button>
        }
      />

      {feedback && (
        <div
          className={`p-3 border-l-4 border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-700 text-teal-950"
              : "bg-rose-50 border-rose-700 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <SearchFilters
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{ role: roleFilter }}
        onFilterChange={(_, v) => handleRoleFilterChange(v)}
        onReset={handleReset}
        filters={[
          {
            key: "role",
            label: "Account Role",
            options: [
              { value: Role.ADMINISTRATOR, label: "ADMINISTRATOR" },
              { value: Role.TALENT_ACQUISITION, label: "TALENT ACQUISITION" },
              { value: Role.APPLICANT, label: "APPLICANT" },
            ],
          },
        ]}
      />

      {/* Users Table */}
      {usersQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title="No Users Found"
            description="No user accounts matched your search or role filters."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">User Account</th>
                  <th className="px-3.5 py-2.5 font-bold">System Role</th>
                  <th className="px-3.5 py-2.5 font-bold">Status</th>
                  <th className="px-3.5 py-2.5 font-bold">Created Date</th>
                  <th className="px-3.5 py-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {paginatedUsers.map((u) => {
                  const isSelf = currentAdmin?.id === u.id;
                  const profile = u.applicantProfile;
                  const fullName = profile
                    ? `${profile.firstName} ${profile.lastName}`
                    : null;

                  return (
                    <tr key={u.id} className="hover:bg-slate-100/70 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-950 flex items-center gap-1.5 font-sans">
                          <span>{u.email}</span>
                          {isSelf && (
                            <span className="text-[9px] font-mono font-bold px-1 py-0.2 bg-teal-100 border border-teal-300 text-teal-800">
                              YOU
                            </span>
                          )}
                        </div>
                        {fullName && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {fullName}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
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
                          <span>{u.role.replace(/_/g, " ")}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                              : "bg-rose-50 text-rose-950 border-rose-300"
                          }`}
                        >
                          {u.isActive ? "ACTIVE" : "DEACTIVATED"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 text-[11px]">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => {
                              setRoleModalUser({ id: u.id, email: u.email, currentRole: u.role });
                              setTargetRole(u.role);
                            }}
                            title={isSelf ? "Cannot change your own role" : "Change Role"}
                          >
                            Role
                          </Button>
                          <Button
                            variant={u.isActive ? "ghost" : "primary"}
                            size="sm"
                            disabled={isSelf}
                            onClick={() =>
                              setStatusModalUser({ id: u.id, email: u.email, isActive: u.isActive })
                            }
                            title={isSelf ? "Cannot deactivate yourself" : "Toggle Status"}
                            className={u.isActive ? "text-rose-600 hover:text-rose-800" : ""}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
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
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Invite TA Modal */}
      <Dialog
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Talent Acquisition Specialist"
        description="Provision an internal TA recruiter account with temporary setup credentials"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate({
              email: inviteEmail,
              firstName: inviteFirstName || undefined,
              lastName: inviteLastName || undefined,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Corporate / Official Email"
            type="email"
            placeholder="e.g. recruiter@megs.ph"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              placeholder="e.g. Maria"
              value={inviteFirstName}
              onChange={(e) => setInviteFirstName(e.target.value)}
            />
            <Input
              label="Last Name"
              placeholder="e.g. Santos"
              value={inviteLastName}
              onChange={(e) => setInviteLastName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={inviteMutation.isPending}
              leftIcon={<Mail className="w-3.5 h-3.5" />}
            >
              Send Invite
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog
        open={Boolean(roleModalUser)}
        onClose={() => setRoleModalUser(null)}
        title="Update User Security Role"
        description={`Modify access permissions for ${roleModalUser?.email}`}
      >
        <div className="space-y-4">
          <Select
            label="Target Security Role"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value as Role)}
            options={[
              { value: Role.TALENT_ACQUISITION, label: "TALENT ACQUISITION (Recruitment Portal)" },
              { value: Role.ADMINISTRATOR, label: "ADMINISTRATOR (Full System Access)" },
              { value: Role.APPLICANT, label: "APPLICANT (Standard Candidate)" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setRoleModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateRoleMutation.isPending}
              onClick={() => {
                if (roleModalUser) {
                  updateRoleMutation.mutate({ id: roleModalUser.id, role: targetRole });
                }
              }}
            >
              Confirm Role Change
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Status Toggle Modal */}
      <Dialog
        open={Boolean(statusModalUser)}
        onClose={() => setStatusModalUser(null)}
        title={statusModalUser?.isActive ? "Deactivate Account" : "Reactivate Account"}
        description={`Are you sure you want to ${statusModalUser?.isActive ? "deactivate" : "reactivate"} access for ${statusModalUser?.email}?`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {statusModalUser?.isActive
              ? "Deactivating this account will prevent the user from logging in or performing system actions."
              : "Reactivating will restore login access with previous security roles."}
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setStatusModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant={statusModalUser?.isActive ? "danger" : "primary"}
              size="sm"
              loading={updateStatusMutation.isPending}
              onClick={() => {
                if (statusModalUser) {
                  updateStatusMutation.mutate({
                    id: statusModalUser.id,
                    isActive: !statusModalUser.isActive,
                  });
                }
              }}
            >
              {statusModalUser?.isActive ? "Deactivate User" : "Reactivate User"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
