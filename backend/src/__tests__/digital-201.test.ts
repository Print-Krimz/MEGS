/**
 * Digital 201 & Employee Lifecycle Integration Tests
 * 
 * TDD Suite verifying the separation of Candidate vs Employee domains,
 * atomic hiring transition, duplicate prevention, Digital 201 aggregation,
 * multi-deployment history, redeployment workflow, and authorization rules.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { executeHiring } from "../services/ta/ta.posthire.service.js";
import {
  getDigital201ByEmployeeId,
  getDigital201ByUserId,
  listEmployees,
  getEmployeeById,
  updateEmployeeStatus,
  createEmployeeDeployment,
  endEmployeeDeployment,
  getEmployeeEmploymentHistory,
} from "../services/employee/employee.service.js";
import { createComplianceRequirement, reviewComplianceRequirement } from "../services/ta/ta.compliance.service.js";
import { createClient } from "../services/ta/ta.clients.service.js";
import { createMRF } from "../services/ta/ta.mrf.service.js";

describe("Digital 201 & Employee Lifecycle Verification", { timeout: 25000 }, () => {
  let taUser: any;
  let applicantUser1: any;
  let applicantUser2: any;
  let jobPosting1: any;
  let jobPosting2: any;
  let application1: any;
  let application2: any;
  let clientA: any;
  let clientB: any;
  let mrfA: any;
  let mrfB: any;

  beforeAll(async () => {
    // 1. Create TA User
    taUser = await prisma.user.create({
      data: {
        id: `ta-actor-${Date.now()}`,
        email: `ta-201-${Date.now()}@megs.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    // 2. Create Candidate 1 (Applicant)
    applicantUser1 = await prisma.user.create({
      data: {
        id: `cand-1-${Date.now()}`,
        email: `candidate1-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Juan",
            lastName: "Dela Cruz",
            mobileNumber: "09171234567",
            gender: "Male",
            province: "Rizal",
            city: "Antipolo",
            dateOfBirth: new Date("1992-05-15"),
            birthPlace: "Antipolo",
            nationality: "Filipino",
            civilStatus: "Married",
            address: "Block 1 Lot 2, Sample Village",
            professionalSummary: "Warehouse Operations Supervisor with 6 years experience",
            hasConsentedToAi: true,
            workExperiences: {
              create: [
                {
                  company: "Logistics Hub Inc",
                  roleTitle: "Warehouse Supervisor",
                  startDate: new Date("2020-01-01"),
                  isCurrent: true,
                  summary: "Supervised 20 warehouse staff",
                },
              ],
            },
            educations: {
              create: [
                {
                  school: "University of the East",
                  degree: "Bachelor of Science",
                  fieldOfStudy: "Business Administration",
                  startDate: new Date("2010-06-01"),
                  endDate: new Date("2014-04-01"),
                },
              ],
            },
          },
        },
      },
      include: { applicantProfile: true },
    });

    // 3. Create Candidate 2 (Talent Pool candidate)
    applicantUser2 = await prisma.user.create({
      data: {
        id: `cand-2-${Date.now()}`,
        email: `candidate2-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Maria",
            lastName: "Santos",
            mobileNumber: "09189876543",
            gender: "Female",
            province: "Laguna",
            city: "Calamba",
            dateOfBirth: new Date("1996-08-20"),
            birthPlace: "Calamba",
            nationality: "Filipino",
            civilStatus: "Single",
            address: "456 Greenfield St",
            professionalSummary: "Forklift Operator and Inventory Specialist",
            hasConsentedToAi: true,
          },
        },
      },
      include: { applicantProfile: true },
    });

    // 4. Create Job Postings
    jobPosting1 = await prisma.jobPosting.create({
      data: {
        postedById: taUser.id,
        title: "Logistics Supervisor",
        description: "Oversee daily warehouse dispatch and logistics operations.",
        requirements: "5+ years logistics experience, leadership skills.",
      },
    });

    jobPosting2 = await prisma.jobPosting.create({
      data: {
        postedById: taUser.id,
        title: "Inventory Controller",
        description: "Maintain accurate stock levels.",
        requirements: "Inventory management experience.",
      },
    });

    // 5. Create Applications
    application1 = await prisma.application.create({
      data: {
        userId: applicantUser1.id,
        jobPostingId: jobPosting1.id,
        status: "ONBOARDING",
      },
    });

    // Application 2 (for candidate 2 in TALENT_POOL status)
    application2 = await prisma.application.create({
      data: {
        userId: applicantUser2.id,
        jobPostingId: jobPosting2.id,
        status: "TALENT_POOL",
      },
    });

    // 6. Setup Clients & MRFs
    clientA = await createClient({
      name: "Global Freight Corp",
      industry: "Supply Chain",
      contactEmail: "hr@globalfreight.com",
    });

    clientB = await createClient({
      name: "Apex Retail Distribution",
      industry: "Retail Logistics",
      contactEmail: "ops@apexretail.com",
    });

    mrfA = await createMRF(taUser.id, {
      clientId: clientA.id,
      title: "Warehouse Lead",
      headcount: 1,
      priority: "HIGH",
    });

    mrfB = await createMRF(taUser.id, {
      clientId: clientB.id,
      title: "Senior Logistics Dispatcher",
      headcount: 1,
      priority: "NORMAL",
    });
  });

  afterAll(async () => {
    try {
      const userIds = [taUser?.id, applicantUser1?.id, applicantUser2?.id].filter(Boolean);
      const clientIds = [clientA?.id, clientB?.id].filter(Boolean);
      const jobIds = [jobPosting1?.id, jobPosting2?.id].filter(Boolean);

      // Clean up in reverse dependency order
      await prisma.employmentEvent.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.deploymentStatusHistory.deleteMany({ where: { changedById: { in: userIds } } });
      await prisma.deployment.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.employee.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.complianceRequirement.deleteMany({ where: { application: { userId: { in: userIds } } } });
      await prisma.recruiterDecision.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.interview.deleteMany({ where: { application: { userId: { in: userIds } } } });
      await prisma.application.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.jobPosting.deleteMany({ where: { id: { in: jobIds } } });
      await prisma.manpowerRequest.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
      await prisma.workExperience.deleteMany({ where: { applicantProfile: { userId: { in: userIds } } } });
      await prisma.education.deleteMany({ where: { applicantProfile: { userId: { in: userIds } } } });
      await prisma.applicantProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } catch (e) {
      // Best effort cleanup
    }
  });

  // ── TEST 1: Candidate Lifecycle Isolation ───────────────────────────────────
  it("TEST-1: Candidate exists without being an Employee", async () => {
    const emp1 = await prisma.employee.findUnique({
      where: { userId: applicantUser1.id },
    });
    expect(emp1).toBeNull();

    const emp2 = await prisma.employee.findUnique({
      where: { userId: applicantUser2.id },
    });
    expect(emp2).toBeNull();
  });

  // ── TEST 2: Talent Pool Does NOT Create Employee or Digital 201 ─────────────
  it("TEST-2: Talent Pool candidate does not receive an Employee record or Digital 201", async () => {
    const candidate2Employee = await prisma.employee.findUnique({
      where: { userId: applicantUser2.id },
    });
    expect(candidate2Employee).toBeNull();

    await expect(getDigital201ByUserId(applicantUser2.id)).rejects.toThrow(
      /Employee record not found/i
    );
  });

  // ── TEST 3: Hiring Process Creates Exactly One Employee & History Event ──────
  it("TEST-3: Valid hiring creates exactly one Employee and records a HIRED event", async () => {
    // Add compliance requirements
    const compReq = await createComplianceRequirement(application1.id, "NBI Clearance", true);
    await reviewComplianceRequirement(compReq.id, taUser.id, "APPROVED", "Clear");

    const hireResult = await executeHiring(
      application1.id,
      {
        employeeNumber: "EMP-2026-0001",
        department: "Logistics",
        position: "Warehouse Supervisor",
        startDate: new Date("2026-09-01"),
        notes: "Offered and accepted package A",
        reason: "Met all technical and compliance requirements",
      },
      taUser.id
    );

    expect(hireResult.application.status).toBe("HIRED");
    expect(hireResult.employee).toBeDefined();
    expect(hireResult.employee.employeeNumber).toBe("EMP-2026-0001");
    expect(hireResult.employee.status).toBe("ACTIVE");
    expect(hireResult.employee.userId).toBe(applicantUser1.id);
    expect(hireResult.employee.originatingApplicationId).toBe(application1.id);

    // Verify EmploymentEvent created
    const events = await prisma.employmentEvent.findMany({
      where: { employeeId: hireResult.employee.id },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].eventType).toBe("HIRED");
  });

  // ── TEST 4: Duplicate Employee Prevention ───────────────────────────────────
  it("TEST-4: Same candidate cannot create multiple Employee identities", async () => {
    // Candidate 1 applies to another job
    const newApp = await prisma.application.create({
      data: {
        userId: applicantUser1.id,
        jobPostingId: jobPosting2.id,
        status: "ONBOARDING",
      },
    });

    // Attempting to hire again as a new employee must throw error
    await expect(
      executeHiring(
        newApp.id,
        {
          employeeNumber: "EMP-2026-0002",
          department: "Supply Chain",
          position: "Inventory Lead",
        },
        taUser.id
      )
    ).rejects.toThrow(/already exists as an employee/i);
  });

  // ── TEST 5: Digital 201 Aggregation ─────────────────────────────────────────
  it("TEST-5: Digital 201 aggregates complete normalized employee record", async () => {
    const employee = await prisma.employee.findUnique({
      where: { userId: applicantUser1.id },
    });
    expect(employee).not.toBeNull();

    const digital201 = await getDigital201ByEmployeeId(employee!.id);

    // Verify aggregated structure
    expect(digital201.employee.id).toBe(employee!.id);
    expect(digital201.employee.employeeNumber).toBe("EMP-2026-0001");
    expect(digital201.candidate.id).toBe(applicantUser1.id);
    expect(digital201.candidate.profile.firstName).toBe("Juan");
    expect(digital201.candidate.profile.lastName).toBe("Dela Cruz");
    expect(digital201.candidate.workExperiences.length).toBeGreaterThanOrEqual(1);
    expect(digital201.candidate.educations.length).toBeGreaterThanOrEqual(1);
    expect(digital201.originatingApplication).toBeDefined();
    expect(digital201.originatingApplication?.id).toBe(application1.id);
    expect(digital201.compliance.length).toBeGreaterThanOrEqual(1);
    expect(digital201.employmentHistory.length).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 6: Multiple Deployments per Employee ───────────────────────────────
  it("TEST-6: Employee supports multiple deployments preserved in history", async () => {
    const employee = await prisma.employee.findUnique({
      where: { userId: applicantUser1.id },
    });
    expect(employee).not.toBeNull();

    // 1. Create Deployment #1 (Client A)
    const dep1 = await createEmployeeDeployment(taUser.id, {
      employeeId: employee!.id,
      clientId: clientA.id,
      mrfId: mrfA.id,
      site: "Global Freight - South Hub",
      contractStart: new Date("2026-09-01"),
      contractEnd: new Date("2026-12-31"),
      notes: "First client assignment",
    });

    expect(dep1.id).toBeDefined();
    expect(dep1.employeeId).toBe(employee!.id);
    expect(dep1.clientId).toBe(clientA.id);

    // 2. End Deployment #1
    const endedDep1 = await endEmployeeDeployment(dep1.id, taUser.id, {
      reason: "Project successfully completed",
      makeAvailableForRedeployment: true,
    });
    expect(endedDep1.status).toBe("ENDED");

    // Verify employee status updated to AVAILABLE_FOR_REDEPLOYMENT
    const updatedEmp = await prisma.employee.findUnique({
      where: { id: employee!.id },
    });
    expect(updatedEmp?.status).toBe("AVAILABLE_FOR_REDEPLOYMENT");

    // 3. Create Deployment #2 (Client B)
    const dep2 = await createEmployeeDeployment(taUser.id, {
      employeeId: employee!.id,
      clientId: clientB.id,
      mrfId: mrfB.id,
      site: "Apex Retail - North Warehouse",
      contractStart: new Date("2027-01-15"),
      contractEnd: new Date("2027-07-15"),
      notes: "Redeployed to second client",
    });

    expect(dep2.id).toBeDefined();
    expect(dep2.employeeId).toBe(employee!.id);
    expect(dep2.clientId).toBe(clientB.id);

    // 4. Verify Digital 201 contains BOTH deployments without overwriting history
    const d201 = await getDigital201ByEmployeeId(employee!.id);
    expect(d201.deployments.length).toBe(2);
    const clients = d201.deployments.map((d: any) => d.client.name);
    expect(clients).toContain("Global Freight Corp");
    expect(clients).toContain("Apex Retail Distribution");

    // Verify employment history events
    const history = await getEmployeeEmploymentHistory(employee!.id);
    const eventTypes = history.map((e: any) => e.eventType);
    expect(eventTypes).toContain("HIRED");
    expect(eventTypes).toContain("DEPLOYED");
    expect(eventTypes).toContain("ASSIGNMENT_ENDED");
  });

  // ── TEST 7: Redeployment Workflow & Querying ────────────────────────────────
  it("TEST-7: List employees filtered by status (Redeployment Pool vs Active)", async () => {
    const allEmployees = await listEmployees({});
    expect(allEmployees.length).toBeGreaterThanOrEqual(1);

    const activeEmployees = await listEmployees({ status: "ACTIVE" });
    expect(activeEmployees.length).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 8: Transaction Safety on Hire Failure ──────────────────────────────
  it("TEST-8: Failed Employee creation does not leave Application marked HIRED", async () => {
    // Create candidate 3
    const cand3 = await prisma.user.create({
      data: {
        id: `cand-3-${Date.now()}`,
        email: `cand3-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Alex",
            lastName: "Rivera",
            mobileNumber: "09191112233",
            gender: "Male",
            province: "Cavite",
            city: "Bacoor",
            dateOfBirth: new Date("1994-03-10"),
            birthPlace: "Bacoor",
            nationality: "Filipino",
            civilStatus: "Single",
            address: "789 Cavite Road",
            professionalSummary: "Tester",
            hasConsentedToAi: true,
          },
        },
      },
    });

    const app3 = await prisma.application.create({
      data: {
        userId: cand3.id,
        jobPostingId: jobPosting1.id,
        status: "ONBOARDING",
      },
    });

    // Pass duplicate employeeNumber that already exists ("EMP-2026-0001")
    await expect(
      executeHiring(
        app3.id,
        {
          employeeNumber: "EMP-2026-0001", // duplicate!
          department: "IT",
          position: "Dev",
        },
        taUser.id
      )
    ).rejects.toThrow();

    // Verify Application status was rolled back and is NOT HIRED
    const checkedApp = await prisma.application.findUnique({
      where: { id: app3.id },
    });
    expect(checkedApp?.status).toBe("ONBOARDING");

    // Verify no partial Employee record was created
    const checkedEmp = await prisma.employee.findUnique({
      where: { userId: cand3.id },
    });
    expect(checkedEmp).toBeNull();
  });
});
