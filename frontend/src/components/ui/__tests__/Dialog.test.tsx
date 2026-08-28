import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../Dialog";

describe("Dialog", () => {
  it("gives assistive technology an accessible name and description", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Remove application" description="This cannot be undone.">
        <button type="button">Cancel</button>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Remove application" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("labels the icon-only close control", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Application details">
        <p>Details</p>
      </Dialog>
    );

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps keyboard focus inside an open dialog", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Confirm action">
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </Dialog>
    );

    const confirm = screen.getByRole("button", { name: "Confirm" });
    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close dialog" }));
  });

  it("does not steal focus from active input during parent re-renders while open", () => {
    const TestComponent = () => {
      const [text, setText] = React.useState("");
      return (
        <Dialog open onClose={() => {}} title="Edit Modal">
          <input
            data-testid="test-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Dialog>
      );
    };

    render(<TestComponent />);
    const input = screen.getByTestId("test-input") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "A" } });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "AB" } });
    expect(document.activeElement).toBe(input);
  });
});
