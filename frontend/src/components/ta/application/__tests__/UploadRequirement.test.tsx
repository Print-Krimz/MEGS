import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../../lib/api/ta.api", () => ({ taApi: { uploadComplianceDocument: vi.fn() } }));

import { taApi } from "../../../../lib/api/ta.api";
import { ApiError } from "../../../../lib/api/client";
import { UploadRequirementDialog } from "../UploadRequirementDialog";
import { RequirementRow, type RequirementRowData } from "../RequirementRow";

const upload = taApi.uploadComplianceDocument as unknown as ReturnType<typeof vi.fn>;

function renderDialog(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <UploadRequirementDialog applicationId="9" requirement={{ id: 4, documentLabel: "NBI Clearance" }} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}
const input = () => screen.getByLabelText(/photo or pdf/i) as HTMLInputElement;
const pick = (f: File) => fireEvent.change(input(), { target: { files: [f] } });

describe("UploadRequirementDialog", () => {
  beforeEach(() => upload.mockClear());

  it("requires a file", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(screen.getByRole("alert").textContent).toMatch(/choose a photo or pdf/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file over 5 MB", () => {
    renderDialog();
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    pick(big);
    expect(screen.getByRole("alert").textContent).toMatch(/over 5 MB/);
    expect((screen.getByRole("button", { name: "Upload" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejects the wrong type", () => {
    renderDialog();
    pick(new File(["x"], "a.docx", { type: "application/msword" }));
    expect(screen.getByRole("alert").textContent).toMatch(/JPEG, PNG or WEBP/);
  });

  it("uploads and closes", async () => {
    upload.mockResolvedValue({ id: 4 });
    const onClose = renderDialog();
    const f = new File(["x"], "nbi.png", { type: "image/png" });
    pick(f);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledWith(4, f);
  });

  it("shows a server error inline and stays open", async () => {
    upload.mockRejectedValueOnce(new ApiError(400, "This application is closed."));
    const onClose = renderDialog();
    pick(new File(["x"], "nbi.png", { type: "image/png" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await screen.findByText(/application is closed/i);
    expect(onClose).not.toHaveBeenCalled();
  });
});

const base: RequirementRowData = { id: 1, documentLabel: "NBI Clearance", isRequired: true, reviewStatus: "PENDING", documentId: null };
const noop = () => undefined;
function row(req: Partial<RequirementRowData>, portal: boolean) {
  render(
    <RequirementRow
      req={{ ...base, ...req }}
      canRemove
      onView={noop}
      onReview={noop}
      onRequestCopy={noop}
      onEditDeadline={noop}
      onRemove={noop}
      onUpload={noop}
      applicantHasPortalAccess={portal}
    />,
  );
}
const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /more actions/i }));

describe("RequirementRow upload action", () => {
  it("is the primary for a no-document row of a walk-in", () => {
    row({}, false);
    expect(screen.getByRole("button", { name: "Upload document" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
  });

  it("is a menu item for a portal applicant", () => {
    row({}, true);
    expect(screen.getByRole("button", { name: "Review" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Upload document" })).toBeNull();
    openMenu();
    expect(screen.getByText("Upload document")).toBeTruthy();
  });

  it("says Replace document when a document exists", () => {
    row({ documentId: 3 }, false);
    openMenu();
    expect(screen.getByText("Replace document")).toBeTruthy();
  });

  it("is hidden for approved rows", () => {
    row({ reviewStatus: "APPROVED", documentId: 3 }, false);
    openMenu();
    expect(screen.queryByText(/upload document|replace document/i)).toBeNull();
  });
});
