import React, { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "../../components/ui";
import { ErrorState, LoadingState, PageHeader } from "../../components/common";
import { useDirtyGuard } from "../../hooks/useDirtyGuard";
import { useAuth } from "../../hooks/useAuth";
import { settingsApi } from "../../lib/api/settings.api";
import { getSessionGeneration, onSessionGenerationChange } from "../../lib/auth/session-generation";
import { DISPLAY_NAME_MAX_LENGTH, staffDisplayNameSchema } from "../../lib/user-name";
import { Role } from "../../lib/types/enums";
import type { AccountSettings } from "../../lib/types/settings.types";

const ChangePasswordModal = lazy(() =>
  import("../../components/common/ChangePasswordModal").then((module) => ({ default: module.ChangePasswordModal })),
);

const roleLabels: Record<Role, string> = {
  [Role.ADMINISTRATOR]: "Administrator",
  [Role.TALENT_ACQUISITION]: "Talent Acquisition",
  [Role.APPLICANT]: "Applicant",
};

const staffLabelQueryKeys = [
  ["admin", "users"],
  ["admin", "audit"],
  ["admin", "analytics"],
  ["ta", "applications"],
  ["ta", "application"],
  ["ta", "mrfs"],
  ["ta", "mrf"],
  ["ta", "analytics"],
  ["ta", "global-search"],
  ["ta", "job"],
  ["ta", "jobs"],
] as const;

const rowClass = "grid gap-1 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5";

function SettingsRow({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={rowClass}>
      <dt className="text-sm font-medium text-slate-700">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm text-slate-900">
        <span className="min-w-0 break-words">{children}</span>
        {action}
      </dd>
    </div>
  );
}

function AccountRow({ label, value }: { label: string; value: string | null }) {
  return (
    <SettingsRow label={label}>{value || <span className="text-slate-500">Not provided</span>}</SettingsRow>
  );
}

function SettingsLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-4 hover:text-navy-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
    >
      {children}
    </Link>
  );
}

const panelClass = "overflow-hidden rounded-md border border-slate-300 bg-white";

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const sessionGeneration = useSyncExternalStore(onSessionGenerationChange, getSessionGeneration, getSessionGeneration);
  const identityRef = useRef({ userId: user?.id, sessionGeneration });
  identityRef.current = { userId: user?.id, sessionGeneration };
  return <SettingsContent key={`${user?.id ?? ""}:${sessionGeneration}`} userId={user?.id} sessionGeneration={sessionGeneration} identityRef={identityRef} refreshUser={refreshUser} />;
};

function SettingsContent({ userId, sessionGeneration, identityRef, refreshUser }: {
  userId: string | undefined;
  sessionGeneration: number;
  identityRef: React.RefObject<{ userId: string | undefined; sessionGeneration: number }>;
  refreshUser: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const settingsKey = ["settings", userId, sessionGeneration] as const;
  const settingsQuery = useQuery({
    queryKey: settingsKey,
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const requestedUserId = userId;
      const requestedGeneration = sessionGeneration;
      if (!requestedUserId) throw new Error("Your account could not be identified.");

      const response = await settingsApi.getSettings({ signal });
      if (
        signal.aborted ||
        getSessionGeneration() !== requestedGeneration ||
        identityRef.current.userId !== requestedUserId ||
        response.account.id !== requestedUserId
      ) {
        throw new DOMException("The account changed while settings were loading.", "AbortError");
      }
      return response;
    },
  });

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const saveMutation = useMutation({
    mutationFn: (displayName: string) => settingsApi.updateProfile({ displayName }),
  });

  const account = settingsQuery.data?.account;
  const savedName = account?.name ?? "";
  const isStaff = account?.role === Role.TALENT_ACQUISITION || account?.role === Role.ADMINISTRATOR;
  useEffect(() => {
    if (nameDraft !== null && nameDraft.trim() === savedName.trim()) setNameDraft(null);
  }, [nameDraft, savedName]);

  const displayedName = nameDraft ?? savedName;
  const isDirty = Boolean(isStaff && nameDraft !== null && nameDraft.trim() !== savedName.trim());
  const dirtyGuard = useDirtyGuard({ isDirty, message: "Your name has not been saved." });

  const isCurrentSession = (capturedUserId: string, capturedGeneration: number) =>
    identityRef.current.userId === capturedUserId && getSessionGeneration() === capturedGeneration;

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account || !isStaff || !userId || saveMutation.isPending || !isDirty) return;

    const result = staffDisplayNameSchema.safeParse(displayedName);
    if (!result.success) {
      const trimmed = displayedName.trim();
      const message = !trimmed
        ? "Enter your full name."
        : trimmed.length > DISPLAY_NAME_MAX_LENGTH
          ? `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
          : "Remove unsupported characters from your name.";
      setNameError(message);
      setSaveError(null);
      setSaveMessage(null);
      return;
    }

    const capturedUserId = userId;
    const capturedGeneration = getSessionGeneration();
    setNameError(null);
    setSaveError(null);
    setSaveMessage(null);

    let response: { displayName: string };
    try {
      response = await saveMutation.mutateAsync(result.data);
    } catch {
      if (isCurrentSession(capturedUserId, capturedGeneration)) {
        setSaveError("Unable to save your name. Please try again.");
      }
      return;
    }

    if (!isCurrentSession(capturedUserId, capturedGeneration)) return;

    queryClient.setQueryData<AccountSettings>(settingsKey, (current) =>
      current?.account.id === capturedUserId
        ? { ...current, account: { ...current.account, name: response.displayName } }
        : current,
    );
    setNameDraft(null);
    for (const queryKey of staffLabelQueryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }

    try {
      await refreshUser();
    } catch {
      // The name save already succeeded; a failed identity refresh should not undo it.
    }
    if (!isCurrentSession(capturedUserId, capturedGeneration)) return;
    setSaveMessage("Name saved.");
  };

  const handleCancel = async () => {
    if (!(await dirtyGuard.confirmDiscard())) return;
    setNameDraft(null);
    setNameError(null);
    setSaveError(null);
    setSaveMessage(null);
  };

  const pageHeader = <PageHeader title="Settings" description="Your name, sign-in details and password." flush />;

  if (settingsQuery.isPending && !settingsQuery.data) {
    return <>{pageHeader}<LoadingState variant="detail" message="Loading account settings…" /></>;
  }

  if (settingsQuery.isError && !settingsQuery.data) {
    return <>{pageHeader}<ErrorState subject="account settings" error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} /></>;
  }

  if (!account || !settingsQuery.data) {
    return <>{pageHeader}<ErrorState subject="account settings" onRetry={() => void settingsQuery.refetch()} /></>;
  }

  const isApplicant = account.role === Role.APPLICANT;
  const mfaUnavailable = !isApplicant && (!settingsQuery.data.mfa || settingsQuery.data.mfa.enrolled === null);
  const mfaStatus = settingsQuery.data.mfa?.enrolled === true
    ? "Enrolled"
    : settingsQuery.data.mfa?.enrolled === false
      ? settingsQuery.data.mfa.required ? "Required, not enrolled" : "Not required"
      : "Two-step verification status is unavailable.";

  return (
    <div className="space-y-6">
      {pageHeader}
      {settingsQuery.isError && (
        <ErrorState compact subject="account settings" error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <section aria-labelledby="account-information-heading" className="space-y-2">
        <h2 id="account-information-heading" className="text-base font-semibold text-slate-900">Profile</h2>
        <div className={panelClass}>
          {isStaff && (
            <form onSubmit={handleSaveName} noValidate className="space-y-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <Input
                id="settings-full-name"
                label="Full name"
                autoComplete="name"
                spellCheck={false}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                disabled={saveMutation.isPending}
                value={displayedName}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNameDraft(nextValue.trim() === savedName.trim() ? null : nextValue);
                  setNameError(null);
                  setSaveError(null);
                  setSaveMessage(null);
                }}
                error={nameError ?? undefined}
              />
              {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
              {saveMessage && <p role="status" className="text-sm text-emerald-700">{saveMessage}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" loading={saveMutation.isPending} disabled={!isDirty || saveMutation.isPending}>
                  Save changes
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleCancel()} disabled={!isDirty || saveMutation.isPending}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          <dl className="divide-y divide-slate-200">
            {!isStaff && <AccountRow label="Name" value={account.name} />}
            <AccountRow label="Sign-in email" value={account.email} />
            <AccountRow label="Phone number" value={account.phoneNumber} />
            <AccountRow label="Role" value={roleLabels[account.role]} />
          </dl>
        </div>
      </section>

      <div className="space-y-6">
      <section aria-labelledby="security-heading" className="space-y-2">
        <h2 id="security-heading" className="text-base font-semibold text-slate-900">Security</h2>
        <dl className={`${panelClass} divide-y divide-slate-200`}>
          <SettingsRow
            label="Password"
            action={<Button type="button" variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>Change password</Button>}
          >
            <span className="text-slate-600">A code is sent to you to confirm a change.</span>
          </SettingsRow>

          {!isApplicant && (
            <SettingsRow
              label="Two-step verification"
              action={mfaUnavailable ? (
                <Button type="button" variant="outline" onClick={() => void settingsQuery.refetch()} loading={settingsQuery.isFetching}>
                  Try again
                </Button>
              ) : undefined}
            >
              {mfaStatus}
            </SettingsRow>
          )}
        </dl>
      </section>

      <section aria-labelledby="related-pages-heading" className="space-y-2">
        <h2 id="related-pages-heading" className="text-base font-semibold text-slate-900">Related pages</h2>
        <nav aria-label="Related pages" className={`${panelClass} flex flex-wrap gap-x-6 gap-y-1 px-4 py-2 sm:px-5`}>
          {isApplicant && <SettingsLink to="/app/profile">My Profile</SettingsLink>}
          <SettingsLink to={account.role === Role.ADMINISTRATOR ? "/admin/notifications" : account.role === Role.TALENT_ACQUISITION ? "/ta/notifications" : "/app/notifications"}>
            Notifications
          </SettingsLink>
          {account.role === Role.ADMINISTRATOR && (
            <>
              <SettingsLink to="/admin/users">Users</SettingsLink>
              <SettingsLink to="/admin/scoring">Matching settings</SettingsLink>
              <SettingsLink to="/admin/audit">Activity history</SettingsLink>
              <SettingsLink to="/admin/maintenance">Backups and recovery</SettingsLink>
            </>
          )}
        </nav>
      </section>
      </div>
      </div>

      {dirtyGuard.discardDialog}
      {passwordOpen && (
        <Suspense fallback={null}>
          <ChangePasswordModal open onClose={() => setPasswordOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
