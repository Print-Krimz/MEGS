import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WalkInSlip } from "../../components/ta/walk-in/WalkInSlip";
import { formatDate } from "../../lib/utils";
import type { WalkInSlip as WalkInSlipData } from "../../lib/types/application.types";

const slip: WalkInSlipData = {
  applicationId: 41,
  trackingCode: "WLK-2026-0041",
  trackingToken: "raw-token",
  trackPath: "/t/WLK-2026-0041?token=raw-token",
  applicantName: "Juan Dela Cruz",
  jobTitle: "Warehouse Associate",
  clientName: "Star Meg",
  location: "Valenzuela",
  // Application created weeks before this reissued slip is printed.
  createdAt: "2026-09-01T02:00:00.000Z",
};

describe("WalkInSlip (80 mm receipt)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the applicant, job, client and large tracking code", () => {
    render(<WalkInSlip slip={slip} />);

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Warehouse Associate")).toBeInTheDocument();
    expect(screen.getByText("Star Meg")).toBeInTheDocument();
    expect(screen.getByText("WLK-2026-0041")).toBeInTheDocument();
    expect(screen.getByText("Tracking code")).toBeInTheDocument();
  });

  it("renders a QR code, not an image of text", () => {
    const { container } = render(<WalkInSlip slip={slip} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("prints the next visit date only when one is given", () => {
    const { rerender } = render(<WalkInSlip slip={slip} />);
    expect(screen.queryByText(/Next visit:/)).not.toBeInTheDocument();

    rerender(<WalkInSlip slip={slip} nextVisitDate="2026-10-30" />);
    expect(screen.getByText(/Next visit:/)).toHaveTextContent(`Next visit: ${formatDate("2026-10-30")}`);
  });

  // Known gap: WalkInSlip.tsx:30 prints slip.createdAt, which is the application's creation date
  // (walk-in.service.ts toSlip). A reissued slip therefore says "Printed" with an old date.
  // Remove .fails once the slip prints the actual print date.
  it("BUG: 'Printed' shows today's date on a reissued slip, not the application's creation date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T04:00:00.000Z"));

    render(<WalkInSlip slip={slip} />);

    expect(screen.getByText(/^Printed /)).toHaveTextContent(formatDate("2026-10-22T04:00:00.000Z"));
  });
});
