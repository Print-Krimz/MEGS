import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingDeploymentStepper } from "../OnboardingDeploymentStepper";
import { ApplicationStatus } from "../../../lib/types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

describe("OnboardingDeploymentStepper", () => {
  const mockHandlers = {
    onOpenComplianceTab: vi.fn(),
    onAdvanceToContractAndOrientation: vi.fn(),
    onRecordContract: vi.fn(),
    onRecordOrientation: vi.fn(),
    onDeployCandidate: vi.fn(),
  };

  const baseApp = {
    id: 101,
    status: ApplicationStatus.COMPLIANCE,
    jobPosting: { title: "Field Electrician", location: "Laguna Plant" },
    complianceRequirements: [],
    contractSigned: false,
    orientationCompleted: false,
  } as any;

  it("renders 0/0 clearances state clearly without contradiction", () => {
    render(
      <OnboardingDeploymentStepper
        app={baseApp}
        totalCompReqs={0}
        approvedCompReqs={0}
        hasUnapprovedMandatoryCompliance={false}
        isComplianceStage={true}
        canAdvanceToContractAndOrientation={true}
        isContractAndOrientationStage={false}
        isContractSigned={false}
        isOrientationCompleted={false}
        isReadyForDeployment={false}
        canDeployCandidate={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText("Personnel, Onboarding & Deployment Readiness")).toBeDefined();
    expect(screen.getByText(/0 \/ 0/)).toBeDefined();
    expect(screen.getByRole("button", { name: /View Requirements Checklist/i })).toBeDefined();
  });

  it("handles opening the 201 compliance tab when clicked", () => {
    render(
      <OnboardingDeploymentStepper
        app={baseApp}
        totalCompReqs={2}
        approvedCompReqs={1}
        hasUnapprovedMandatoryCompliance={true}
        isComplianceStage={true}
        canAdvanceToContractAndOrientation={false}
        isContractAndOrientationStage={false}
        isContractSigned={false}
        isOrientationCompleted={false}
        isReadyForDeployment={false}
        canDeployCandidate={false}
        {...mockHandlers}
      />
    );

    const complianceBtn = screen.getByRole("button", { name: /View Requirements Checklist/i });
    fireEvent.click(complianceBtn);
    expect(mockHandlers.onOpenComplianceTab).toHaveBeenCalled();
  });

  it("renders advance button when all mandatory clearances are approved in COMPLIANCE stage", () => {
    render(
      <OnboardingDeploymentStepper
        app={baseApp}
        totalCompReqs={3}
        approvedCompReqs={3}
        hasUnapprovedMandatoryCompliance={false}
        isComplianceStage={true}
        canAdvanceToContractAndOrientation={true}
        isContractAndOrientationStage={false}
        isContractSigned={false}
        isOrientationCompleted={false}
        isReadyForDeployment={false}
        canDeployCandidate={false}
        {...mockHandlers}
      />
    );

    const advanceBtn = screen.getByRole("button", { name: /Advance to Contract & Orientation/i });
    expect(advanceBtn).toBeDefined();
    fireEvent.click(advanceBtn);
    expect(mockHandlers.onAdvanceToContractAndOrientation).toHaveBeenCalled();
  });

  it("renders contract and orientation actions in CONTRACT_AND_ORIENTATION stage", () => {
    const contractApp = {
      ...baseApp,
      status: ApplicationStatus.CONTRACT_AND_ORIENTATION,
    };

    render(
      <OnboardingDeploymentStepper
        app={contractApp}
        totalCompReqs={3}
        approvedCompReqs={3}
        hasUnapprovedMandatoryCompliance={false}
        isComplianceStage={false}
        canAdvanceToContractAndOrientation={false}
        isContractAndOrientationStage={true}
        isContractSigned={false}
        isOrientationCompleted={false}
        isReadyForDeployment={false}
        canDeployCandidate={false}
        {...mockHandlers}
      />
    );

    const contractBtn = screen.getByRole("button", { name: /Record Contract Signed/i });
    const orientationBtn = screen.getByRole("button", { name: /Record Orientation Complete/i });

    expect(contractBtn).toBeDefined();
    expect(orientationBtn).toBeDefined();

    fireEvent.click(contractBtn);
    expect(mockHandlers.onRecordContract).toHaveBeenCalled();

    fireEvent.click(orientationBtn);
    expect(mockHandlers.onRecordOrientation).toHaveBeenCalled();
  });

  it("unlocks site deployment CTA when all 3 prerequisites are satisfied", () => {
    const readyApp = {
      ...baseApp,
      status: ApplicationStatus.CONTRACT_AND_ORIENTATION,
      contractSigned: true,
      contractSignedAt: "2026-08-30T10:00:00Z",
      orientationCompleted: true,
      orientationDate: "2026-08-31T09:00:00Z",
    };

    render(
      <OnboardingDeploymentStepper
        app={readyApp}
        totalCompReqs={3}
        approvedCompReqs={3}
        hasUnapprovedMandatoryCompliance={false}
        isComplianceStage={false}
        canAdvanceToContractAndOrientation={false}
        isContractAndOrientationStage={true}
        isContractSigned={true}
        isOrientationCompleted={true}
        isReadyForDeployment={true}
        canDeployCandidate={true}
        linkedClientName="Acme Industrial Logistics"
        {...mockHandlers}
      />
    );

    const deployBtn = screen.getByRole("button", { name: /Deploy Candidate to Site/i });
    expect(deployBtn).toBeDefined();
    fireEvent.click(deployBtn);
    expect(mockHandlers.onDeployCandidate).toHaveBeenCalled();
  });

  it("renders deployed state with employee designation and deployment site", () => {
    const deployedApp = {
      ...baseApp,
      status: ApplicationStatus.DEPLOYED,
      contractSigned: true,
      contractSignedAt: "2026-08-25T10:00:00Z",
      orientationCompleted: true,
      orientationDate: "2026-08-26T09:00:00Z",
      hiredEmployee: {
        employeeNumber: "EMP-2026-0889",
        position: "Senior Electrician",
      },
      deployments: [
        {
          id: 501,
          site: "Laguna Industrial Park - Block 4",
          status: "ACTIVE",
          contractStart: "2026-09-01T08:00:00Z",
          client: { name: "Megawide Heavy Industries" },
        },
      ],
    };

    render(
      <OnboardingDeploymentStepper
        app={deployedApp}
        totalCompReqs={3}
        approvedCompReqs={3}
        hasUnapprovedMandatoryCompliance={false}
        isComplianceStage={false}
        canAdvanceToContractAndOrientation={false}
        isContractAndOrientationStage={false}
        isContractSigned={true}
        isOrientationCompleted={true}
        isReadyForDeployment={false}
        canDeployCandidate={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText("EMP-2026-0889")).toBeDefined();
    expect(screen.getByText(/Laguna Industrial Park - Block 4/)).toBeDefined();
    expect(screen.getByText(/Senior Electrician/)).toBeDefined();
  });
});

