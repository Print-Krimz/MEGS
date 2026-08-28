import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComboBox } from "../ComboBox";

const sampleOptions = [
  { value: "1", label: "Acme Industrial Corp", subtitle: "Logistics • Valenzuela" },
  { value: "2", label: "Apex Manufacturing Inc", subtitle: "Manufacturing • Laguna" },
  { value: "3", label: "Global Warehousing Ltd", subtitle: "Supply Chain • Batangas" },
  { value: "4", label: "Prime Distribution Services", subtitle: "Distribution • Cavite" },
];

describe("ComboBox Component", () => {
  it("renders with label, placeholder, and initial value", () => {
    render(
      <ComboBox
        label="Client Account"
        placeholder="Search client accounts..."
        options={sampleOptions}
        value="1"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Client Account")).toBeDefined();
    expect(screen.getByDisplayValue("Acme Industrial Corp")).toBeDefined();
  });

  it("filters options dynamically when typing in search input", () => {
    render(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Search client...");
    fireEvent.focus(input);

    // All options should be visible initially in the list
    expect(screen.getByText("Acme Industrial Corp")).toBeDefined();
    expect(screen.getByText("Apex Manufacturing Inc")).toBeDefined();

    // Type "Apex"
    fireEvent.change(input, { target: { value: "Apex" } });

    expect(screen.getByText("Apex Manufacturing Inc")).toBeDefined();
    expect(screen.queryByText("Acme Industrial Corp")).toBeNull();
  });

  it("selects an option on click and calls onChange with selected value", () => {
    const handleChange = vi.fn();

    render(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText("Search client...");
    fireEvent.focus(input);

    const option = screen.getByText("Apex Manufacturing Inc");
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith("2", expect.objectContaining({ value: "2", label: "Apex Manufacturing Inc" }));
  });

  it("supports keyboard navigation: ArrowDown, ArrowUp, Enter, and Escape", () => {
    const handleChange = vi.fn();
    render(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText("Search client...");
    fireEvent.focus(input);

    // Initial focus highlights index 0 (Acme). ArrowDown advances to index 1 (Apex).
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // Press Enter to select
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith("2", expect.objectContaining({ value: "2", label: "Apex Manufacturing Inc" }));
  });

  it("shows empty state when no options match filter", () => {
    render(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        emptyText="No clients found matching query"
      />
    );

    const input = screen.getByPlaceholderText("Search client...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "NonExistentCompanyXYZ" } });

    expect(screen.getByText("No clients found matching query")).toBeDefined();
  });

  it("supports allowCustom mode to commit custom text input", () => {
    const handleChange = vi.fn();

    render(
      <ComboBox
        label="Compliance Clearance"
        placeholder="Select or type clearance..."
        options={[
          { value: "NBI Clearance", label: "NBI Clearance" },
          { value: "Police Clearance", label: "Police Clearance" },
        ]}
        value=""
        onChange={handleChange}
        allowCustom
      />
    );

    const input = screen.getByPlaceholderText("Select or type clearance...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Special Client Background Check" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith(
      "Special Client Background Check",
      expect.objectContaining({ value: "Special Client Background Check", label: "Special Client Background Check" })
    );
  });

  it("clears value when clear button is clicked", () => {
    const handleChange = vi.fn();

    render(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value="1"
        onChange={handleChange}
        clearable
      />
    );

    const clearBtn = screen.getByRole("button", { name: /clear selection/i });
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith("", null);
  });

  it("displays error and helperText correctly", () => {
    const { rerender } = render(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        error="Client is required"
      />
    );

    expect(screen.getByText("Client is required")).toBeDefined();

    rerender(
      <ComboBox
        label="Client Account"
        placeholder="Search client..."
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        helperText="Please select a verified corporate account"
      />
    );

    expect(screen.getByText("Please select a verified corporate account")).toBeDefined();
  });
});
