import type { Page } from "@playwright/test";

export type SettingsRole = "APPLICANT" | "TALENT_ACQUISITION" | "ADMINISTRATOR";

export interface SettingsUser {
  id: string;
  role: SettingsRole;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  mustChangePassword?: boolean;
  applicantProfile?: { firstName: string; lastName: string } | null;
}

export interface SettingsApiCall {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
}

export interface SettingsBrowserFixture {
  initialUser: SettingsUser;
  users: Map<string, SettingsUser>;
  calls: SettingsApiCall[];
  unexpected: string[];
  settingsRequests: SettingsApiCall[];
  pageErrors: string[];
  consoleErrors: string[];
  consoleErrorLocations: string[];
  failedRequests: string[];
  settingsGetStatus: number;
  profilePatchStatus: number;
  mfa: { required: boolean; enrolled: boolean | null } | null;
  holdSettingsGet: { userId: string; promise: Promise<void> } | null;
  holdProfilePatch: { userId: string; promise: Promise<void> } | null;
}

export function createSettingsUser(role: SettingsRole, id = `settings-${role.toLowerCase()}`): SettingsUser {
  if (role === "APPLICANT") {
    return {
      id,
      role,
      email: "juan.delacruz@example.test",
      displayName: null,
      phoneNumber: "09171234567",
      isActive: true,
      applicantProfile: { firstName: "Juan", lastName: "Dela Cruz" },
    };
  }

  return {
    id,
    role,
    email: role === "ADMINISTRATOR" ? "ana.admin@example.test" : "maria.santos@example.test",
    displayName: role === "ADMINISTRATOR" ? "Ana Admin" : "Maria Santos",
    phoneNumber: null,
    isActive: true,
  };
}

export function mockAccessToken(user: Pick<SettingsUser, "id" | "role">): string {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `header.${payload}.signature`;
}

function accountName(user: SettingsUser): string | null {
  if (user.role === "APPLICANT") {
    const first = user.applicantProfile?.firstName.trim();
    const last = user.applicantProfile?.lastName.trim();
    return [first, last].filter(Boolean).join(" ") || null;
  }
  return user.displayName;
}

function response(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(status >= 400 ? { success: false, message: "Fixture request failed." } : { success: true, data }),
  };
}

function userIdFromToken(authorization: string | undefined): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const encodedPayload = token?.split(".")[1];
  if (!encodedPayload) return null;
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")).sub ?? null;
  } catch {
    return null;
  }
}

export async function installSettingsFixture(
  page: Page,
  role: SettingsRole,
  options: { authenticated?: boolean; settingsGetStatus?: number; mfa?: SettingsBrowserFixture["mfa"] } = {},
) {
  const initialUser = createSettingsUser(role);
  const fixture: SettingsBrowserFixture = {
    initialUser,
    users: new Map([[initialUser.id, initialUser]]),
    calls: [],
    unexpected: [],
    settingsRequests: [],
    pageErrors: [],
    consoleErrors: [],
    consoleErrorLocations: [],
    failedRequests: [],
    settingsGetStatus: options.settingsGetStatus ?? 200,
    profilePatchStatus: 200,
    mfa: options.mfa ?? (role === "APPLICANT" ? null : { required: true, enrolled: true }),
    holdSettingsGet: null,
    holdProfilePatch: null,
  };

  await page.addInitScript(({ token, userRole, authenticated }) => {
    if (authenticated) localStorage.setItem("access_token", token);
    localStorage.setItem("user_role", userRole);
  }, { token: mockAccessToken(initialUser), userRole: initialUser.role, authenticated: options.authenticated !== false });

  page.on("pageerror", (error) => fixture.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") { fixture.consoleErrors.push(message.text()); fixture.consoleErrorLocations.push(message.location().url); }
  });
  page.on("requestfailed", (request) => {
    fixture.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown"}`);
  });

  await page.route((url) => new URL(url).pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const authorization = request.headers()["authorization"];
    const user = fixture.users.get(userIdFromToken(authorization) ?? "") ?? initialUser;
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    const call = { method: request.method(), path, authorization, body };
    fixture.calls.push(call);

    const fulfill = (data: unknown, status = 200) => route.fulfill(response(data, status));
    if (path === "/api/me" && request.method() === "GET") {
      return fulfill({ user: { ...user } });
    }
    if (path === "/api/auth/mfa/status" && request.method() === "GET") {
      return fulfill({ enabled: user.role !== "APPLICANT" && fixture.mfa?.enrolled === true });
    }
    if (path === "/api/config" && request.method() === "GET") {
      return fulfill({ MATCH_THRESHOLD: 60 });
    }
    if (path === "/api/notifications/stream" && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": keepalive\n\n" });
    }
    if (path === "/api/notifications/unread-count" && request.method() === "GET") {
      return fulfill({ count: 0 });
    }
    if (path.startsWith("/api/notifications") && request.method() === "GET") {
      return fulfill({ items: [], unreadCount: 0, total: 0, page: 1, limit: 10, totalPages: 1 });
    }
    if (path === "/api/ta/compliance/interviews" && request.method() === "GET") {
      return fulfill({ summary: { breached: 0, warning: 0, healthy: 1 } });
    }
    if (path === "/api/ta/analytics/compliance" && request.method() === "GET") {
      return fulfill({ statusBreakdown: { SUBMITTED: 0 } });
    }
    if (path === "/api/employees/redeployment-queue/summary" && request.method() === "GET") {
      return fulfill({ stages: { NEEDS_PLACEMENT: 0 } });
    }
    if (path === "/api/applicants/profile" && request.method() === "GET") {
      return fulfill({
        id: 1,
        userId: user.id,
        firstName: user.applicantProfile?.firstName ?? "",
        lastName: user.applicantProfile?.lastName ?? "",
        mobileNumber: user.phoneNumber,
        isActive: true,
        skills: [],
        workExperiences: [],
        educations: [],
        trainings: [],
        assets: [],
        characterReferences: [],
      });
    }
    if (path === "/api/settings" && request.method() === "GET") {
      fixture.settingsRequests.push(call);
      if (fixture.holdSettingsGet?.userId === user.id) await fixture.holdSettingsGet.promise;
      if (fixture.settingsGetStatus >= 400) return fulfill(null, fixture.settingsGetStatus);
      return fulfill({
        account: {
          id: user.id,
          role: user.role,
          name: accountName(user),
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        mfa: fixture.mfa,
      });
    }
    if (path === "/api/settings/profile" && request.method() === "PATCH") {
      fixture.settingsRequests.push(call);
      if (fixture.holdProfilePatch?.userId === user.id) await fixture.holdProfilePatch.promise;
      if (fixture.profilePatchStatus >= 400) return fulfill(null, fixture.profilePatchStatus);
      const displayName = (body as { displayName?: string } | null)?.displayName;
      if (typeof displayName === "string") user.displayName = displayName;
      return fulfill({ displayName: user.displayName });
    }
    if (path === "/api/auth/change-password/code" && request.method() === "POST") {
      const now = Date.now();
      return fulfill({
        message: "Verification code sent.",
        sentTo: user.email,
        expiresAt: new Date(now + 10 * 60_000).toISOString(),
        resendAvailableAt: new Date(now + 60_000).toISOString(),
      });
    }
    if (path === "/api/auth/change-password" && request.method() === "POST") {
      return fulfill({ message: "Your password has been changed." });
    }

    fixture.unexpected.push(`${request.method()} ${path}`);
    return fulfill(null, 501);
  });

  return fixture;
}
