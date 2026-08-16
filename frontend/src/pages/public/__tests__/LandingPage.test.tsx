import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "../LandingPage";

describe("MEGS LandingPage", () => {
  it("renders the main corporate company name and tagline", () => {
    render(<LandingPage />);
    expect(
      screen.getAllByText(/MAR EMPLOYMENT FOR GOOD SERVICES INC\./i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Better People\./i)).toBeDefined();
    expect(screen.getByText(/Better Results\./i)).toBeDefined();
  });

  it("renders the navigation items and primary CTA", () => {
    render(<LandingPage />);
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getAllByText(/View Job Openings/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Partner With/i).length).toBeGreaterThan(0);
  });

  it("renders the 4 core workforce services", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Recruitment & Staffing/i)).toBeDefined();
    expect(screen.getByText(/Manpower Deployment/i)).toBeDefined();
    expect(screen.getByText(/Workforce Administration/i)).toBeDefined();
    expect(screen.getByText(/Workforce Coordination/i)).toBeDefined();
  });

  it("renders the job specializations list", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Production Workers/i)).toBeDefined();
    expect(screen.getByText(/Warehouse Crew/i)).toBeDefined();
    expect(screen.getByText(/Forklift Operators/i)).toBeDefined();
    expect(screen.getByText(/QA\/QC Personnel/i)).toBeDefined();
  });

  it("renders the industries served", () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/Manufacturing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Logistics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Warehousing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hotel & Restaurant/i).length).toBeGreaterThan(0);
  });

  it("renders the nationwide branch network", () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/Valenzuela/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Quezon City Branch/i)).toBeDefined();
    expect(screen.getByText(/Biñan, Laguna Branch/i)).toBeDefined();
    expect(screen.getByText(/Tanauan, Batangas Branch/i)).toBeDefined();
    expect(screen.getByText(/Cebu Branch/i)).toBeDefined();
    expect(screen.getByText(/Davao Branch/i)).toBeDefined();
  });

  it("renders corporate values and verified contact info", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Integrity/i)).toBeDefined();
    expect(screen.getByText(/Loyalty/i)).toBeDefined();
    expect(screen.getByText(/Respect/i)).toBeDefined();
    expect(screen.getByText(/patrickramos@pjar-group\.com/i)).toBeDefined();
    expect(screen.getAllByText(/09176291864/i).length).toBeGreaterThan(0);
  });
});
