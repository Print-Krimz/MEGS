import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("stays open when the dimmed area outside it is clicked", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Add client">
        <p>Form</p>
      </Dialog>
    );

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
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

  it("starts on the first form field, not the Close button", async () => {
    render(
      <Dialog open onClose={vi.fn()} title="Invite">
        <button type="button">Help</button>
        <input aria-label="Email" />
      </Dialog>
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Email")));
  });

  it("focuses the dialog itself when it has no form field", async () => {
    render(
      <Dialog open onClose={vi.fn()} title="Details">
        <button type="button">Delete</button>
      </Dialog>
    );
    await waitFor(() => expect(document.activeElement?.getAttribute("tabindex")).toBe("-1"));
  });

  describe("nested dialogs", () => {
    const Nested = () => {
      const [parentOpen, setParentOpen] = React.useState(true);
      const [childOpen, setChildOpen] = React.useState(false);
      const [picked, setPicked] = React.useState("none");
      return (
        <>
          <Dialog open={parentOpen} onClose={() => { setParentOpen(false); setPicked("none"); }} title="Parent">
            <button type="button" onClick={() => setPicked("job-1")}>Pick job</button>
            <button type="button" onClick={() => setChildOpen(true)}>Send</button>
            <p>Selected: {picked}</p>
          </Dialog>
          <Dialog open={childOpen} onClose={() => setChildOpen(false)} title="Child">
            <button type="button">Child action</button>
          </Dialog>
        </>
      );
    };

    it("Escape closes only the child and the parent selection remains", () => {
      render(<Nested />);
      fireEvent.click(screen.getByRole("button", { name: "Pick job" }));
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(screen.getByRole("dialog", { name: "Child" })).toBeTruthy();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog", { name: "Child" })).toBeNull();
      expect(screen.getByRole("dialog", { name: "Parent" })).toBeTruthy();
      expect(screen.getByText("Selected: job-1")).toBeTruthy();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("keeps body scroll locked until the last modal closes", () => {
      render(<Nested />);
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(document.body.style.overflow).toBe("hidden");
      fireEvent.keyDown(window, { key: "Escape" });
      expect(document.body.style.overflow).toBe("hidden");
      fireEvent.keyDown(window, { key: "Escape" });
      expect(document.body.style.overflow).toBe("");
    });

    it("traps Tab and Shift+Tab inside the topmost dialog", () => {
      render(<Nested />);
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      const child = within(screen.getByRole("dialog", { name: "Child" }));
      const childClose = child.getByRole("button", { name: "Close dialog" });
      const childAction = child.getByRole("button", { name: "Child action" });

      childAction.focus();
      fireEvent.keyDown(window, { key: "Tab" });
      expect(document.activeElement).toBe(childClose);
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(childAction);

      // Focus that escaped to the parent is pulled back into the child.
      screen.getByRole("button", { name: "Pick job" }).focus();
      fireEvent.keyDown(window, { key: "Tab" });
      expect(document.activeElement).toBe(childClose);
    });

    it("returns focus to the parent trigger when the child closes", async () => {
      render(<Nested />);
      const send = screen.getByRole("button", { name: "Send" });
      send.focus();
      fireEvent.click(send);
      await waitFor(() => expect(document.activeElement).not.toBe(send));
      fireEvent.keyDown(window, { key: "Escape" });
      expect(document.activeElement).toBe(send);
    });
  });

  it("returns focus to the opener when closed or unmounted", async () => {
    const Harness = ({ mode }: { mode: "prop" | "unmount" }) => {
      const [open, setOpen] = React.useState(false);
      const dialog = (
        <Dialog open={open} onClose={() => setOpen(false)} title="Details">
          <p>Body</p>
        </Dialog>
      );
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open {mode}</button>
          {mode === "prop" ? dialog : open && dialog}
        </>
      );
    };
    for (const mode of ["prop", "unmount"] as const) {
      const { unmount } = render(<Harness mode={mode} />);
      const opener = screen.getByRole("button", { name: `Open ${mode}` });
      opener.focus();
      fireEvent.click(opener);
      await waitFor(() => expect(document.activeElement).not.toBe(opener));
      fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
      expect(document.activeElement).toBe(opener);
      unmount();
    }
  });
});
