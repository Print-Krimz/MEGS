import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bumpSessionGeneration, getSessionGeneration } from "../../../lib/auth/session-generation";
import type { AccountSettings } from "../../../lib/types/settings.types";
import { SettingsPage } from "../SettingsPage";

const mocks = vi.hoisted(() => ({
  user: {} as { id: string; role: string; email: string; displayName?: string | null },
  refreshUser: vi.fn(),
  getSettings: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, refreshUser: mocks.refreshUser }),
}));

vi.mock("../../../lib/api/settings.api", () => ({
  settingsApi: { getSettings: mocks.getSettings, updateProfile: mocks.updateProfile },
}));

const settings = (id: string, role: string, name: string | null): AccountSettings => ({
  account: {
    id,
    role: role as AccountSettings["account"]["role"],
    name,
    email: `${id}@megs.ph`,
    phoneNumber: "+639171234567",
  },
  mfa: role === "APPLICANT" ? null : { required: true, enrolled: false },
});

function createTestRouter() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Outlet />
        <Link to="/profile">Navigate away</Link>
      </>
    ),
  });
  const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
  const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profile",
    component: () => <h1>Profile destination</h1>,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([settingsRoute, profileRoute]),
    history: createMemoryHistory({ initialEntries: ["/settings"] }),
  });
}

function renderSettingsPage(user: typeof mocks.user) {
  mocks.user = user;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createTestRouter();
  const ui = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  const result = render(ui);
  return { ...result, queryClient, router, ui };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.user = {
      id: "user-ta-1",
      role: "TALENT_ACQUISITION",
      email: "ta@megs.ph",
      displayName: "Alex Recruiter",
    };
    mocks.refreshUser.mockReset().mockResolvedValue(undefined);
    mocks.getSettings.mockReset().mockImplementation(async () =>
      settings(mocks.user.id, mocks.user.role, mocks.user.displayName ?? null),
    );
    mocks.updateProfile.mockReset().mockImplementation(async ({ displayName }: { displayName: string }) => ({ displayName }));
  });

  it("shows applicant account details and links without a second name editor", async () => {
    mocks.getSettings.mockResolvedValueOnce(settings("user-applicant-1", "APPLICANT", "Juan Dela Cruz"));
    renderSettingsPage({ id: "user-applicant-1", role: "APPLICANT", email: "applicant@megs.ph" });

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeVisible();
    expect(await screen.findByText("Juan Dela Cruz")).toBeVisible();
    expect(screen.getByText("Applicant")).toBeVisible();
    expect(screen.getByRole("link", { name: "My Profile" })).toHaveAttribute("href", "/app/profile");
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/app/notifications");
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.getByRole("button", { name: "Change password" })).toBeVisible();
  });

  it("shows staff name editing and admin account links by role", async () => {
    mocks.getSettings.mockResolvedValueOnce(settings("user-admin-1", "ADMINISTRATOR", "Alex Admin"));
    renderSettingsPage({ id: "user-admin-1", role: "ADMINISTRATOR", email: "admin@megs.ph", displayName: "Alex Admin" });

    const input = await screen.findByLabelText("Full name");
    expect(input).toHaveValue("Alex Admin");
    expect(input).toHaveAttribute("autocomplete", "name");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("maxlength", "201");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: "Matching settings" })).toHaveAttribute("href", "/admin/scoring");
    expect(screen.getByRole("link", { name: "Activity history" })).toHaveAttribute("href", "/admin/audit");
    expect(screen.getByRole("link", { name: "Backups and recovery" })).toHaveAttribute("href", "/admin/maintenance");
    expect(screen.queryByRole("link", { name: "My Profile" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("validates and saves a trimmed staff name, then refreshes identity", async () => {
    renderSettingsPage(mocks.user);
    const input = await screen.findByLabelText("Full name");
    const save = screen.getByRole("button", { name: "Save changes" });

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(save);
    expect(await screen.findByText("Enter your full name.")).toBeVisible();
    expect(mocks.updateProfile).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  Taylor Wu  " } });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: "Taylor Wu" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Name saved.");
    expect(mocks.refreshUser).toHaveBeenCalledTimes(1);
  });

  it("keeps the submitted name visible when saving fails", async () => {
    mocks.updateProfile.mockRejectedValueOnce(new Error("Request failed"));
    renderSettingsPage(mocks.user);
    const input = await screen.findByLabelText("Full name");
    fireEvent.change(input, { target: { value: "Taylor Wu" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save your name. Please try again.");
    expect(input).toHaveValue("Taylor Wu");
    expect(mocks.refreshUser).not.toHaveBeenCalled();
  });

  it("asks before discarding a dirty name and restores the latest saved value", async () => {
    const { queryClient } = renderSettingsPage(mocks.user);
    const input = await screen.findByLabelText("Full name");
    fireEvent.change(input, { target: { value: "Unsaved Name" } });
    act(() => queryClient.setQueryData(["settings", mocks.user.id, getSessionGeneration()], settings(mocks.user.id, mocks.user.role, "Server Name")));
    expect(input).toHaveValue("Unsaved Name");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    await waitFor(() => expect(input).toHaveValue("Server Name"));
  });

  it("updates an untouched name when fresh settings arrive", async () => {
    const { queryClient } = renderSettingsPage(mocks.user);
    const input = await screen.findByLabelText("Full name");
    expect(input).toHaveValue("Alex Recruiter");
    act(() => queryClient.setQueryData(["settings", mocks.user.id, getSessionGeneration()], settings(mocks.user.id, mocks.user.role, "Latest Saved Name")));
    await waitFor(() => expect(input).toHaveValue("Latest Saved Name"));
  });

  it("blocks navigation while a staff name is dirty", async () => {
    renderSettingsPage(mocks.user);
    const input = await screen.findByLabelText("Full name");
    fireEvent.change(input, { target: { value: "Unsaved Name" } });
    fireEvent.click(screen.getByRole("link", { name: "Navigate away" }));

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Profile destination" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Keep editing/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(input).toHaveValue("Unsaved Name");
  });

  it("keeps account details available when MFA status is unavailable", async () => {
    mocks.getSettings.mockResolvedValueOnce({
      ...settings("user-ta-1", "TALENT_ACQUISITION", "Alex Recruiter"),
      mfa: { required: true, enrolled: null },
    });
    renderSettingsPage(mocks.user);

    expect(await screen.findByLabelText("Full name")).toHaveValue("Alex Recruiter");
    expect(screen.getByText("Two-step verification status is unavailable.")).toBeVisible();
    expect(screen.getByText("user-ta-1@megs.ph")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows a retry state when account settings cannot load", async () => {
    mocks.getSettings.mockRejectedValueOnce(new Error("Network unavailable"));
    renderSettingsPage(mocks.user);

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Full name")).toHaveValue("Alex Recruiter");
  });

  it("drops an old account GET result after the session changes", async () => {
    const oldRequest = deferred<AccountSettings>();
    mocks.getSettings.mockReset()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementation(async () => settings(mocks.user.id, mocks.user.role, mocks.user.displayName ?? null));
    const result = renderSettingsPage({ id: "user-old", role: "TALENT_ACQUISITION", email: "old@megs.ph" });
    await waitFor(() => expect(mocks.getSettings).toHaveBeenCalledTimes(1));

    mocks.user = { id: "user-new", role: "TALENT_ACQUISITION", email: "new@megs.ph", displayName: "New User" };
    act(() => bumpSessionGeneration());
    result.rerender(result.ui);
    expect(await screen.findByLabelText("Full name")).toHaveValue("New User");

    await act(async () => oldRequest.resolve(settings("user-old", "TALENT_ACQUISITION", "Old User")));
    await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveValue("New User"));
  });

  it("clears the password dialog and credentials when the account changes", async () => {
    const result = renderSettingsPage({ id: "user-old", role: "TALENT_ACQUISITION", email: "old@megs.ph", displayName: "Old User" });
    await screen.findByLabelText("Full name");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    const password = await screen.findByLabelText(/current password/i);
    fireEvent.change(password, { target: { value: "private credential" } });

    mocks.user = { id: "user-new", role: "TALENT_ACQUISITION", email: "new@megs.ph", displayName: "New User" };
    act(() => bumpSessionGeneration());
    result.rerender(result.ui);
    await screen.findByDisplayValue("New User");
    expect(screen.queryByLabelText(/current password/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByLabelText(/current password/i)).toHaveValue("");
  });

  it("ignores an old account PATCH result after the session changes", async () => {
    const oldSave = deferred<{ displayName: string }>();
    mocks.updateProfile.mockImplementationOnce(() => oldSave.promise);
    const result = renderSettingsPage({ id: "user-old", role: "TALENT_ACQUISITION", email: "old@megs.ph", displayName: "Old User" });
    const input = await screen.findByLabelText("Full name");
    fireEvent.change(input, { target: { value: "Changed Old User" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledTimes(1));

    expect(input).toBeDisabled();
    mocks.user = { id: "user-new", role: "TALENT_ACQUISITION", email: "new@megs.ph", displayName: "New User" };
    act(() => bumpSessionGeneration());
    result.rerender(result.ui);
    expect(await screen.findByLabelText("Full name")).toHaveValue("New User");
    expect(screen.getByLabelText("Full name")).toBeEnabled();
    await act(async () => oldSave.resolve({ displayName: "Changed Old User" }));

    expect(mocks.refreshUser).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Full name")).toHaveValue("New User");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
