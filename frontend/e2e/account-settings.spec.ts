import { expect, test, type Page } from "@playwright/test";
import { createSettingsUser, installSettingsFixture, mockAccessToken, type SettingsBrowserFixture, type SettingsRole } from "./settings-fixtures";

const roles: { role: SettingsRole; prefix: string; menu: string; name: string }[] = [
  { role: "APPLICANT", prefix: "app", menu: "applicant", name: "Juan Dela Cruz" },
  { role: "TALENT_ACQUISITION", prefix: "ta", menu: "ta", name: "Maria Santos" },
  { role: "ADMINISTRATOR", prefix: "admin", menu: "admin", name: "Ana Admin" },
];
const sizes = [{ name: "desktop", width: 1440, height: 900 }, { name: "tablet", width: 820, height: 1180 }, { name: "mobile", width: 390, height: 844 }];
function clean(f: SettingsBrowserFixture, expectedHttpError: "GET" | "PATCH" | "ABORT" | null = null) {
  expect(f.unexpected).toEqual([]); expect(f.pageErrors).toEqual([]);
  const expectedPath = expectedHttpError === "GET" ? "/api/settings" : "/api/settings/profile";
  const expectedStatus = expectedHttpError === "GET" ? "500" : "400";
  const expectedLog = expectedHttpError === "GET" ? "[Query Cache Error]: ApiError: Fixture request failed." : expectedHttpError === "ABORT" ? "[Mutation Cache Error]: AbortError: Session changed" : "[Mutation Cache Error]: ApiError: Fixture request failed.";
  const errors = f.consoleErrors.filter((x, i) => !(expectedHttpError && ((x === `Failed to load resource: the server responded with a status of ${expectedStatus} (Internal Server Error)` || x === `Failed to load resource: the server responded with a status of ${expectedStatus} (Bad Request)`) && new URL(f.consoleErrorLocations[i]).pathname === expectedPath || x.startsWith(expectedLog))));
  if (expectedHttpError) { expect(f.calls.some((c) => c.method === (expectedHttpError === "ABORT" ? "PATCH" : expectedHttpError) && c.path === expectedPath)).toBeTruthy(); expect(f.consoleErrors.some((x) => x.startsWith(expectedLog))).toBeTruthy(); }
  expect(errors).toEqual([]);
  expect(f.failedRequests.filter((x) => !x.includes("net::ERR_ABORTED"))).toEqual([]);
}
async function open(page: Page, prefix = "ta") { await page.goto(`/${prefix}/settings`); await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible(); }
for (const role of roles) for (const size of sizes) {
  test(`${role.role} ${size.name}: menu and identity`, async ({ page }) => {
    const f = await installSettingsFixture(page, role.role);
    await page.setViewportSize(size);
    await page.goto(`/${role.prefix}/notifications`);
    const button = page.locator(`#${role.menu}-account-button`);
    await expect(button).toBeVisible(); expect(f.settingsRequests).toHaveLength(0);
    await button.focus(); await expect(button).toBeFocused(); await button.press("Enter");
    await page.locator(`#${role.menu}-account-menu`).getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(new RegExp(`/${role.prefix}/settings$`));
    await expect(page.getByText(f.initialUser.email, { exact: true })).toBeVisible();
    if (role.role === "APPLICANT") {
      await expect(page.getByRole("region", { name: "Account information" }).getByText(role.name, { exact: true })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Full name" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Account links" }).getByRole("link", { name: "My Profile" })).toHaveAttribute("href", "/app/profile");
    } else await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(role.name);
    if (role.role === "ADMINISTRATOR") for (const [label, href] of [["Users", "/admin/users"], ["Matching settings", "/admin/scoring"], ["Activity history", "/admin/audit"], ["Backups and recovery", "/admin/maintenance"]]) await expect(page.getByRole("navigation", { name: "Account links" }).getByRole("link", { name: label })).toHaveAttribute("href", href);
    const link = page.getByRole("navigation", { name: "Account links" }).getByRole("link", { name: "Notifications" });
    const box = await link.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (size.name !== "tablet") await page.screenshot({ path: `../.superpowers/sdd/2026-11-01-account-settings/${role.prefix}-${size.name}.png`, fullPage: true });
    clean(f);
  });
}
for (const role of roles.slice(1)) test(`${role.role}: save updates identity and persists after reload`, async ({ page }) => {
  const f = await installSettingsFixture(page, role.role); await open(page, role.prefix);
  await page.getByRole("textbox", { name: "Full name" }).fill("New Staff Name");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Name saved.")).toBeVisible();
  await expect(page.locator(`#${role.menu}-account-button`)).toContainText("New Staff Name");
  await page.reload(); await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("New Staff Name"); clean(f);
});
test("failed save, validation, cancel and navigation guard", async ({ page }) => {
  const f = await installSettingsFixture(page, "TALENT_ACQUISITION"); await open(page);
  const name = page.getByRole("textbox", { name: "Full name" });
  await expect(name).toHaveAttribute("maxlength", "201"); await name.fill("x".repeat(202)); await expect(name).toHaveValue("x".repeat(201));
  await name.fill("   "); await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.getByText("Enter your full name.")).toBeVisible();
  await name.fill("<script>"); await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.getByText("Remove unsupported characters from your name.")).toBeVisible();
  f.profilePatchStatus = 400; await name.fill("Draft Name"); await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.getByText("Unable to save your name. Please try again.")).toBeVisible(); await expect(name).toHaveValue("Draft Name");
  await page.getByRole("button", { name: "Cancel", exact: true }).click(); await page.getByRole("button", { name: "Keep editing" }).click(); await expect(name).toHaveValue("Draft Name");
  await page.getByRole("link", { name: "Notifications", exact: true }).last().click(); await page.getByRole("button", { name: "Keep editing" }).click(); await expect(name).toHaveValue("Draft Name");
  await page.getByRole("link", { name: "Notifications", exact: true }).last().click(); await page.getByRole("button", { name: "Discard" }).click(); await expect(page).toHaveURL(/\/ta\/notifications$/); clean(f, "PATCH");
});
test("MFA retry preserves dirty draft", async ({ page }) => {
  const f = await installSettingsFixture(page, "TALENT_ACQUISITION", { mfa: { required: true, enrolled: null } }); await open(page);
  await expect(page.getByText("Two-step verification status is unavailable.")).toBeVisible(); await page.getByRole("textbox", { name: "Full name" }).fill("Draft Name");
  f.mfa = { required: true, enrolled: true }; await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Enrolled", { exact: true })).toBeVisible(); await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Draft Name"); clean(f);
});
test("settings GET failure can retry", async ({ page }) => {
  const f = await installSettingsFixture(page, "TALENT_ACQUISITION", { settingsGetStatus: 500 }); await open(page);
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible({ timeout: 15000 }); f.settingsGetStatus = 200;
  await page.getByRole("button", { name: /try again/i }).click(); await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Maria Santos"); clean(f, "GET");
});
test("password modal sends code and current password", async ({ page }) => {
  const f = await installSettingsFixture(page, "TALENT_ACQUISITION"); await open(page); await page.getByRole("button", { name: "Change password" }).click();
  const d = page.getByRole("dialog", { name: "Update your password" }); await d.getByLabel("Current password").fill("OldPassword1!"); await d.locator('input[autocomplete="new-password"]').first().fill("NewPassword2!"); await d.getByLabel("Confirm new password").fill("NewPassword2!");
  await d.getByRole("button", { name: "Send code" }).click(); await d.getByLabel("Verification code").fill("123456"); await d.getByRole("button", { name: "Update password" }).click(); await expect(d).toBeHidden();
  expect(f.calls.find((c) => c.path === "/api/auth/change-password")?.body).toMatchObject({ currentPassword: "OldPassword1!", newPassword: "NewPassword2!", otp: "123456" }); clean(f);
});

async function switchAccount(page: Page, token: string) {
  await page.evaluate((next) => { const old = localStorage.getItem("access_token"); localStorage.setItem("access_token", next); window.dispatchEvent(new StorageEvent("storage", { key: "access_token", oldValue: old, newValue: next, storageArea: localStorage })); }, token);
}
for (const kind of ["GET", "PATCH"] as const) test(`account swap while ${kind} is pending`, async ({ page }) => {
  const f = await installSettingsFixture(page, "TALENT_ACQUISITION");
  const second = createSettingsUser("TALENT_ACQUISITION", "settings-second"); second.displayName = "Second User"; second.email = "second@example.test"; f.users.set(second.id, second);
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let markSettled!: () => void; const settled = new Promise<void>((resolve) => { markSettled = resolve; });
  if (kind === "GET") f.holdSettingsGet = { userId: f.initialUser.id, promise: gate, settled: markSettled };
  await open(page);
  if (kind === "PATCH") {
    await page.getByRole("textbox", { name: "Full name" }).fill("Old Draft"); f.holdProfilePatch = { userId: f.initialUser.id, promise: gate, settled: markSettled };
    await page.getByRole("button", { name: "Save changes" }).click();
  }
  await expect.poll(() => f.settingsRequests.some((c) => c.method === kind)).toBeTruthy();
  await switchAccount(page, mockAccessToken(second));
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Second User");
  const name = page.getByRole("textbox", { name: "Full name" });
  await name.fill("Second Draft");
  const meCalls = f.calls.filter((c) => c.path === "/api/me").length;
  release(); await settled;
  if (kind === "PATCH") await expect.poll(() => f.consoleErrors).toContain("[Mutation Cache Error]: AbortError: Session changed");
  await expect(page.getByText("second@example.test")).toBeVisible();
  await expect(name).toHaveValue("Second Draft");
  await expect(page.getByText("Name saved.")).toHaveCount(0);
  expect(f.calls.filter((c) => c.path === "/api/me")).toHaveLength(meCalls);
  clean(f, kind === "PATCH" ? "ABORT" : null);
});
test("guards redirect wrong role and unauthenticated visitors", async ({ browser }) => {
  for (const authenticated of [true, false]) {
    const page = await browser.newPage(); const f = await installSettingsFixture(page, "APPLICANT", { authenticated });
    await page.goto("/admin/settings"); await expect(page).not.toHaveURL(/\/admin\/settings$/); expect(f.settingsRequests).toHaveLength(0); clean(f); await page.close();
  }
});
test("forced password change redirects settings", async ({ page }) => {
  const f = await installSettingsFixture(page, "TALENT_ACQUISITION"); f.initialUser.mustChangePassword = true;
  await page.goto("/ta/settings"); await expect(page).toHaveURL(/change-password/); expect(f.settingsRequests).toHaveLength(0); clean(f);
});
