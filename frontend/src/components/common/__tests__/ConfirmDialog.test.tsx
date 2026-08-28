import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title, description and action buttons when open", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Archive Requisition"
        description="Are you sure you want to archive this job?"
        confirmLabel="Archive"
        variant="danger"
      />
    );

    expect(screen.getByText("Archive Requisition")).toBeDefined();
    expect(screen.getByText("Are you sure you want to archive this job?")).toBeDefined();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm Action"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables cancel button and shows loading on confirm button when loading is true", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Deleting Item"
        loading={true}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
    const confirmBtn = screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement;

    expect(cancelBtn.disabled).toBe(true);
    expect(confirmBtn.disabled).toBe(true);
  });
});
