import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentPreviewModal } from "../DocumentPreviewModal";
import { documentsApi } from "../../../lib/api/documents.api";

vi.mock("../../../lib/api/documents.api", () => ({
  documentsApi: {
    getPreview: vi.fn(),
    getDownloadUrl: vi.fn((id) => `/api/documents/${id}/download`),
  },
}));

describe("DocumentPreviewModal Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithClient = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  it("does not render anything when open is false", () => {
    renderWithClient(
      <DocumentPreviewModal
        open={false}
        onClose={vi.fn()}
        documentId={101}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders empty state when documentId is missing/null", () => {
    renderWithClient(
      <DocumentPreviewModal
        open={true}
        onClose={vi.fn()}
        documentId={null}
        title="Government ID"
      />
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Government ID/i)).toBeDefined();
    expect(screen.getByText(/No Document Uploaded/i)).toBeDefined();
  });

  it("renders image preview when document is an image", async () => {
    (documentsApi.getPreview as any).mockResolvedValueOnce({
      id: 101,
      originalName: "gov-id.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 204800,
      category: "VAULT_201",
      uploadedAt: new Date().toISOString(),
      applicantName: "Juan Dela Cruz",
      url: "https://mock-storage.supabase.co/signed/gov-id.jpg",
    });

    renderWithClient(
      <DocumentPreviewModal
        open={true}
        onClose={vi.fn()}
        documentId={101}
        title="Government ID"
        applicantName="Juan Dela Cruz"
        requirementStatus="SUBMITTED"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeDefined();
      expect(screen.getByText("SUBMITTED")).toBeDefined();
      expect(screen.getByText("Juan Dela Cruz")).toBeDefined();
    });
  });

  it("renders PDF iframe when document is a PDF", async () => {
    (documentsApi.getPreview as any).mockResolvedValueOnce({
      id: 102,
      originalName: "nbi-clearance.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512000,
      category: "VAULT_201",
      uploadedAt: new Date().toISOString(),
      applicantName: "Maria Santos",
      url: "https://mock-storage.supabase.co/signed/nbi.pdf",
    });

    renderWithClient(
      <DocumentPreviewModal
        open={true}
        onClose={vi.fn()}
        documentId={102}
        title="NBI Clearance"
        applicantName="Maria Santos"
        requirementStatus="SUBMITTED"
      />
    );

    await waitFor(() => {
      const iframe = screen.getByTitle("nbi-clearance.pdf");
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute("src")).toBe(
        "https://mock-storage.supabase.co/signed/nbi.pdf"
      );
    });
  });

  it("triggers onApprove when Approve Document is clicked", async () => {
    (documentsApi.getPreview as any).mockResolvedValueOnce({
      id: 103,
      originalName: "police-clearance.pdf",
      mimeType: "application/pdf",
      sizeBytes: 102400,
      category: "VAULT_201",
      uploadedAt: new Date().toISOString(),
      url: "https://mock-storage.supabase.co/signed/police.pdf",
    });

    const onApprove = vi.fn();
    renderWithClient(
      <DocumentPreviewModal
        open={true}
        onClose={vi.fn()}
        documentId={103}
        title="Police Clearance"
        onApprove={onApprove}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve Document/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Approve Document/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("allows specifying rejection notes and triggers onReject", async () => {
    (documentsApi.getPreview as any).mockResolvedValueOnce({
      id: 104,
      originalName: "blurry-scan.png",
      mimeType: "image/png",
      sizeBytes: 102400,
      category: "VAULT_201",
      uploadedAt: new Date().toISOString(),
      url: "https://mock-storage.supabase.co/signed/blurry.png",
    });

    const onReject = vi.fn();
    renderWithClient(
      <DocumentPreviewModal
        open={true}
        onClose={vi.fn()}
        documentId={104}
        title="Medical Certificate"
        onReject={onReject}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Reject$/i }));

    expect(screen.getByText(/Specify Rejection Reason/i)).toBeDefined();
    const textarea = screen.getByPlaceholderText(/e\.g\. Document is blurry/i);
    fireEvent.change(textarea, { target: { value: "Document is unreadable." } });

    fireEvent.click(screen.getByRole("button", { name: /Confirm Document Rejection/i }));
    expect(onReject).toHaveBeenCalledWith("Document is unreadable.");
  });
});
