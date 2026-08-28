import { test, expect } from "@playwright/test";

test.describe("Applicant Resume Auto-Fill End-to-End Browser Flow", () => {
  test("uploading a resume from the Resume & Photo tab automatically populates all profile tabs without page refresh", async ({
    page,
  }) => {
    let mockProfile: any = {
      id: 1,
      userId: "u-e2e-applicant",
      firstName: "",
      lastName: "",
      middleName: "",
      mobileNumber: "",
      address: "",
      city: "",
      province: "",
      preferredWorkLocations: "",
      professionalSummary: "",
      isActive: true,
      skills: [],
      workExperiences: [],
      educations: [],
      trainings: [],
      assets: [],
      characterReferences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock auth and user profile APIs
    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: "u-e2e-applicant",
              email: "juan.delacruz@example.com",
              role: "APPLICANT",
              isActive: true,
            },
          },
        }),
      });
    });

    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route("**/api/auth/mfa/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { enabled: false },
        }),
      });
    });

    await page.route("**/api/applicants/profile", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: mockProfile,
          }),
        });
      } else if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        mockProfile = { ...mockProfile, ...body };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: mockProfile,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/applicants/profile/resume", async (route) => {
      const updatedProfile = {
        ...mockProfile,
        firstName: "Juan",
        lastName: "Dela Cruz",
        mobileNumber: "09171234567",
        dateOfBirth: "1995-06-15T00:00:00.000Z",
        birthPlace: "Calamba City",
        gender: "Male",
        nationality: "Filipino",
        civilStatus: "Single",
        religion: "Roman Catholic",
        height: 173,
        weight: 68,
        address: "Barangay Real, Calamba City",
        city: "Calamba",
        province: "Laguna",
        preferredWorkLocations: "Calamba, Santa Rosa, Makati",
        professionalSummary: "Certified Logistics Specialist with 5 years experience",
        resumeUrl: "/api/documents/999/download",
        characterReferences: [
          {
            id: 501,
            applicantProfileId: 1,
            name: "Engr. Roberto Gomez",
            relationship: "Operations Manager",
            phone: "09181234567",
            email: "roberto@example.com",
          },
        ],
        skills: [
          { id: 101, name: "Forklift Operation" },
          { id: 102, name: "Inventory Management" },
        ],
        workExperiences: [
          {
            id: 201,
            applicantProfileId: 1,
            company: "Apex Warehouse Logistics",
            roleTitle: "Inventory Supervisor",
            startDate: "2020-01-01",
            isCurrent: true,
          },
        ],
        educations: [
          {
            id: 301,
            applicantProfileId: 1,
            school: "Laguna University",
            degree: "BS Industrial Technology",
          },
        ],
        trainings: [
          {
            id: 401,
            applicantProfileId: 1,
            title: "TESDA NC II Forklift",
          },
        ],
      };
      mockProfile = updatedProfile;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Resume uploaded and profile auto-filled successfully",
          data: {
            profile: updatedProfile,
            resumeUrl: "/api/documents/999/download",
            extractionStatus: "SUCCESS",
            extractedData: {
              firstName: "Juan",
              lastName: "Dela Cruz",
              mobileNumber: "09171234567",
              dateOfBirth: "1995-06-15",
              birthPlace: "Calamba City",
              gender: "Male",
              nationality: "Filipino",
              civilStatus: "Single",
              religion: "Roman Catholic",
              height: 173,
              weight: 68,
              address: "Barangay Real, Calamba City",
              city: "Calamba",
              province: "Laguna",
              preferredWorkLocations: "Calamba, Santa Rosa, Makati",
              professionalSummary: "Certified Logistics Specialist with 5 years experience",
              skills: ["Forklift Operation", "Inventory Management"],
              workExperiences: [
                {
                  company: "Apex Warehouse Logistics",
                  roleTitle: "Inventory Supervisor",
                  startDate: "2020-01-01",
                },
              ],
              educations: [
                {
                  school: "Laguna University",
                  degree: "BS Industrial Technology",
                },
              ],
              trainings: [
                {
                  title: "TESDA NC II Forklift",
                },
              ],
              characterReferences: [
                {
                  name: "Engr. Roberto Gomez",
                  relationship: "Operations Manager",
                  phone: "09181234567",
                  email: "roberto@example.com",
                },
              ],
            },
          },
        }),
      });
    });

    // Seed mock token in browser
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-jwt-token-applicant");
      localStorage.setItem("user_role", "APPLICANT");
    });

    // Navigate to profile page
    await page.goto("/app/profile");

    // Click "Resume & Photo" tab
    await page.getByRole("button", { name: "Resume & Photo" }).click();

    // Verify existing resume upload box is present and single
    const uploadInput = page.locator('input[data-testid="resume-autofill-upload-input"]');
    await expect(uploadInput).toBeAttached();

    // Upload PDF resume file
    await uploadInput.setInputFiles({
      name: "juan-delacruz-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Mock PDF Content with Juan Dela Cruz resume data"),
    });

    // Verify feedback notification banner
    await expect(
      page.getByText("Resume uploaded and profile details auto-filled successfully")
    ).toBeVisible();

    // Switch to "Personal Info" tab without refreshing
    await page.getByRole("button", { name: "Personal Info" }).click();

    // Verify auto-filled input values
    const firstNameInput = page.locator('input[value="Juan"]');
    await expect(firstNameInput).toBeVisible();

    const lastNameInput = page.locator('input[value="Dela Cruz"]');
    await expect(lastNameInput).toBeVisible();

    const mobileInput = page.locator('input[value="09171234567"]');
    await expect(mobileInput).toBeVisible();

    await expect(page.locator('input[value="1995-06-15"]')).toBeVisible();
    await expect(page.locator('input[value="Calamba City"]')).toBeVisible();
    await expect(page.locator('input[value="Filipino"]')).toBeVisible();
    await expect(page.locator('input[value="Roman Catholic"]')).toBeVisible();
    await expect(page.locator('input[value="173"]')).toBeVisible();
    await expect(page.locator('input[value="68"]')).toBeVisible();

    const addressInput = page.locator('input[value="Barangay Real, Calamba City"]');
    await expect(addressInput).toBeVisible();

    // Verify visual extraction indicator
    await expect(page.getByText("✓ Extracted from resume").first()).toBeVisible();

    // Verify editable: type additional characters into first name
    await firstNameInput.fill("Juan Carlos");
    await expect(page.locator('input[value="Juan Carlos"]')).toBeVisible();

    // Switch to "Work History" tab and verify populated experiences
    await page.getByRole("button", { name: "Work History" }).click();
    await expect(page.getByText("Apex Warehouse Logistics")).toBeVisible();
    await expect(page.getByText("Inventory Supervisor")).toBeVisible();

    // Switch to "Education" tab and verify populated educations
    await page.getByRole("button", { name: "Education" }).click();
    await expect(page.getByText("Laguna University")).toBeVisible();
    await expect(page.getByText("BS Industrial Technology")).toBeVisible();

    // Switch to "Skills" tab and verify populated skills
    await page.getByRole("button", { name: "Skills" }).click();
    await expect(page.getByText("Forklift Operation")).toBeVisible();
    await expect(page.getByText("Inventory Management")).toBeVisible();

    // Switch to "References" tab and verify populated character references
    await page.getByRole("button", { name: "References" }).click();
    await expect(page.getByText("Engr. Roberto Gomez")).toBeVisible();
    await expect(page.getByText("09181234567")).toBeVisible();
  });

  test("does not overwrite manually entered applicant information when uploading a resume", async ({
    page,
  }) => {
    let mockProfile: any = {
      id: 2,
      userId: "u-e2e-manual",
      firstName: "ExistingFirst",
      lastName: "ExistingLast",
      middleName: "",
      mobileNumber: "09998887777", // already entered
      address: "Custom Manual Address", // already entered
      city: "Makati",
      province: "Metro Manila",
      preferredWorkLocations: "",
      professionalSummary: "",
      isActive: true,
      skills: [],
      workExperiences: [],
      educations: [],
      trainings: [],
      assets: [],
      characterReferences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: "u-e2e-manual",
              email: "manual.user@example.com",
              role: "APPLICANT",
              isActive: true,
            },
          },
        }),
      });
    });

    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route("**/api/auth/mfa/status", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { enabled: false } }) });
    });

    await page.route("**/api/applicants/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockProfile }),
      });
    });

    await page.route("**/api/applicants/profile/resume", async (route) => {
      // Backend preserve logic: only fills empty fields (e.g. professionalSummary, preferredWorkLocations)
      const updatedProfile = {
        ...mockProfile,
        preferredWorkLocations: "Taguig, Pasig",
        professionalSummary: "Summary from uploaded CV",
        resumeUrl: "/api/documents/1000/download",
      };
      mockProfile = updatedProfile;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Resume uploaded and profile auto-filled successfully",
          data: {
            profile: updatedProfile,
            resumeUrl: "/api/documents/1000/download",
            extractionStatus: "SUCCESS",
            extractedData: {
              firstName: "ResumeFirst", // should not overwrite ExistingFirst
              lastName: "ResumeLast", // should not overwrite ExistingLast
              mobileNumber: "09112223333", // should not overwrite 09998887777
              address: "Resume Address", // should not overwrite Custom Manual Address
              preferredWorkLocations: "Taguig, Pasig",
              professionalSummary: "Summary from uploaded CV",
            },
          },
        }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-jwt-token-manual");
      localStorage.setItem("user_role", "APPLICANT");
    });

    await page.goto("/app/profile");

    // Verify existing manual entries on Personal Info
    await expect(page.locator('input[value="ExistingFirst"]')).toBeVisible();
    await expect(page.locator('input[value="09998887777"]')).toBeVisible();

    // Upload resume in Resume & Photo tab
    await page.getByRole("button", { name: "Resume & Photo" }).click();
    const uploadInput = page.locator('input[data-testid="resume-autofill-upload-input"]');
    await uploadInput.setInputFiles({
      name: "cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Mock CV"),
    });

    // Return to Personal Info
    await page.getByRole("button", { name: "Personal Info" }).click();

    // Manual fields are retained
    await expect(page.locator('input[value="ExistingFirst"]')).toBeVisible();
    await expect(page.locator('input[value="ExistingLast"]')).toBeVisible();
    await expect(page.locator('input[value="09998887777"]')).toBeVisible();
    await expect(page.locator('input[value="Custom Manual Address"]')).toBeVisible();

    // Empty fields are auto-filled
    await expect(page.locator('textarea[name="professionalSummary"], textarea').filter({ hasText: "Summary from uploaded CV" })).toBeVisible();
  });
});
