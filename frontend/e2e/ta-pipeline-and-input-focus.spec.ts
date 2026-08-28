import { test, expect } from "@playwright/test";

test.describe("TA Pipeline 6-Stage Workflow, Client Acceptance, and Input Focus E2E", () => {
  const mockTAUser = {
    id: "ta-user-101",
    email: "recruiter@megs-recruitment.com",
    role: "TALENT_ACQUISITION",
    accountStatus: "ACTIVE",
    isActive: true,
    applicantProfile: { firstName: "Sarah", lastName: "Recruiter" },
  };

  const initialApplication = {
    id: 101,
    jobPostingId: 201,
    userId: "cand-101",
    status: "CLIENT_ENDORSEMENT",
    isArchived: false,
    candidateFitScore: 89,
    createdAt: "2026-08-20T08:00:00Z",
    updatedAt: "2026-08-28T10:00:00Z",
    user: {
      id: "cand-101",
      email: "juan.delacruz@example.com",
      applicantProfile: {
        firstName: "Juan",
        lastName: "Dela Cruz",
        mobileNumber: "09171234567",
      },
    },
    jobPosting: {
      id: 201,
      title: "CNC Machine Operator",
      location: "Laguna Technopark",
      mrf: {
        id: 301,
        title: "2026 Q3 Manufacturing Expansion",
        clientId: 401,
        client: { id: 401, name: "Precision Machining Corp." },
      },
    },
    interviews: [
      {
        id: 501,
        applicationId: 101,
        type: "INITIAL_SCREENING",
        scheduledAt: "2026-08-22T09:00:00Z",
        conductedAt: "2026-08-22T09:30:00Z",
        result: "PASS",
        notes: "Passed technical screening with good machining fundamentals.",
        isActive: true,
      },
    ],
    clientEndorsements: [
      {
        id: 601,
        applicationId: 101,
        clientId: 401,
        outcome: "PENDING",
        notes: "Endorsed for client review",
        client: { id: 401, name: "Precision Machining Corp." },
        createdAt: "2026-08-23T10:00:00Z",
      },
    ],
    complianceRequirements: [],
  };

  test("verifies 6-stage stepper (no Hired stage), continuous typing in dialog without focus loss, and instant auto-transition on Client Acceptance", async ({
    page,
  }) => {
    let currentApp = { ...initialApplication };

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("response", (res) => {
      if (res.status() >= 400) console.log("HTTP ERR:", res.status(), res.url());
    });
    page.on("requestfailed", (req) => {
      console.log("FAILED REQ:", req.url(), req.failure()?.errorText);
    });

    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-ta-jwt-token");
      localStorage.setItem("user_role", "TALENT_ACQUISITION");
    });

    await page.route("**/api/auth/mfa/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      });
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { user: mockTAUser } }),
      });
    });

    await page.route("**/api/notifications/unread-count*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { unreadCount: 0 } }),
      });
    });

    await page.route("**/api/notifications/stream*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": keepalive\n\n",
      });
    });

    await page.route("**/api/notifications*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: [], unreadCount: 0 } }),
      });
    });

    await page.route("**/api/ta/clients*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route("**/api/ta/applications/101/decisions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route("**/api/ta/compliance/interviews*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { summary: { breached: 0, warning: 0, healthy: 1 } } }),
      });
    });

    await page.route("**/api/ta/applications/101", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: currentApp }),
        });
      }
    });

    await page.route("**/api/ta/applications/101/endorsements/601", async (route) => {
      if (route.request().method() === "PATCH") {
        const body = JSON.parse(route.request().postData() || "{}");
        currentApp = {
          ...currentApp,
          status: body.outcome === "APPROVED" ? "FINAL_INTERVIEW" : currentApp.status,
          clientEndorsements: [
            {
              ...currentApp.clientEndorsements[0],
              outcome: body.outcome,
              notes: body.notes || currentApp.clientEndorsements[0].notes,
            },
          ],
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: currentApp.clientEndorsements[0],
          }),
        });
      }
    });

    // 1. Navigate to application detail page
    await page.goto("/ta/applications/101");
    await expect(page.locator("h1")).toContainText("Juan Dela Cruz");

    // 2. Verify Canonical 6-Stage Stepper in Main Content
    const main = page.getByRole("main");
    await expect(main.getByText("Submitted", { exact: true })).toBeVisible();
    await expect(main.getByText("Initial review", { exact: true })).toBeVisible();
    await expect(main.getByText("Client review", { exact: true })).toBeVisible();
    await expect(main.getByText("Final interview", { exact: true })).toBeVisible();
    await expect(main.getByText("Employment documents (201)", { exact: true })).toBeVisible();
    await expect(main.getByText("Work placement", { exact: true })).toBeVisible();

    // Verify "Hired" and "Onboarding" do NOT appear in the pipeline
    await expect(main.getByText("Hired", { exact: true })).not.toBeVisible();
    await expect(main.getByText("Onboarding", { exact: true })).not.toBeVisible();

    // Verify NO duplicate "Advance to Client Evaluation" button is present
    await expect(main.getByRole("button", { name: /Advance to Client Evaluation/i })).not.toBeVisible();

    // 3. Open "Record Client Acceptance" dialog
    const recordAcceptanceBtn = page.getByRole("button", { name: /Record Client Acceptance/i });
    await expect(recordAcceptanceBtn).toBeVisible();
    await recordAcceptanceBtn.click();

    // Verify modal is open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Record Client Acceptance" })).toBeVisible();

    // Select APPROVED outcome
    const outcomeSelect = dialog.locator("select");
    await outcomeSelect.selectOption("APPROVED");

    // 4. Test Continuous Typing in Textarea without focus loss or cursor jump
    const notesInput = dialog.locator("textarea");
    await expect(notesInput).toBeVisible();
    await notesInput.fill("");
    await notesInput.focus();

    const textToType = "Candidate demonstrated exceptional CNC lathe operating skills and client accepted immediately.";
    // Type character by character with slight delay to trigger re-renders
    await notesInput.pressSequentially(textToType, { delay: 10 });

    // Verify the input retained full focus and exact typed string
    await expect(notesInput).toBeFocused();
    await expect(notesInput).toHaveValue(textToType);

    // 5. Submit Client Acceptance
    const submitBtn = dialog.getByRole("button", { name: "Save Client Acceptance" });
    await submitBtn.click();

    // 6. Verify instant UI update without page reload
    // Success feedback message appears
    await expect(page.getByText(/Client acceptance recorded as Approved by Client/i).first()).toBeVisible();

    // Stage updates to Final Interview
    await expect(main.getByText("Final interview", { exact: true })).toBeVisible();

    // Final interview stage actions now appear immediately
    await expect(main.getByRole("button", { name: /Record Client Result/i })).toBeVisible();
    await expect(main.getByRole("button", { name: /Schedule Client Interview/i })).toBeVisible();
  });
});
