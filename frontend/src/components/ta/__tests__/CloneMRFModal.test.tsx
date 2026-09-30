// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CloneMRFModal, CloneMRFModalProps } from "../CloneMRFModal";
import { taApi } from "../../../lib/api/ta.api";
import type { ManpowerRequest } from "../../../lib/types/ta.types";

vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    listMRFs: vi.fn(),
  },
}));

const mockMRFs: ManpowerRequest[] = [
  {
    id: 12,
    clientId: 101,
    title: "Forklift Operator",
    headcount: 5,
    location: "Laguna Technopark",
    priority: "HIGH",
    status: "OPEN",
    requiredSkills: "Forklift Operation, Pallet Stacking, Safety NC II",
    employmentType: "Contractual",
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-03-15T08:00:00.000Z",
    createdById: "user-1",
    client: {
      id: 101,
      name: "Apex Logistics Corp",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  {
    id: 34,
    clientId: 102,
    title: "Warehouse Associate",
    headcount: 10,
    location: "Cavite Economic Zone",
    priority: "NORMAL",
    status: "IN_PROGRESS",
    requiredSkills: "RF Scanning, Picking, Packing, 5S",
    employmentType: "Full-Time",
    createdAt: "2026-03-20T08:00:00.000Z",
    updatedAt: "2026-03-20T08:00:00.000Z",
    createdById: "user-2",
    client: {
      id: 102,
      name: "Global Freight Solutions",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  {
    id: 56,
    clientId: 103,
    title: "Production Line Assembler",
    headcount: 8,
    location: "Batangas Plant",
    priority: "URGENT",
    status: "OPEN",
    requiredSkills: "Assembly line, Visual inspection",
    employmentType: "Contractual",
    createdAt: "2026-03-25T08:00:00.000Z",
    updatedAt: "2026-03-25T08:00:00.000Z",
    createdById: "user-3",
    // No client relation to test fallback
  },
];

describe("CloneMRFModal Component", () => {
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

  afterEach(() => {
    cleanup();
  });

  function renderModal(props: Partial<CloneMRFModalProps> = {}) {
    const defaultProps: CloneMRFModalProps = {
      open: true,
      onClose: vi.fn(),
      onSelectMRF: vi.fn(),
      ...props,
    };

    const result = render(
      <QueryClientProvider client={queryClient}>
        <CloneMRFModal {...defaultProps} />
      </QueryClientProvider>
    );

    return { ...result, props: defaultProps };
  }

  it("renders list of past MRFs with title and client", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockMRFs);

    renderModal();

    expect(taApi.listMRFs).toHaveBeenCalledWith({ sortBy: "createdAt" });

    // Wait for items to appear
    await waitFor(() => {
      expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    });

    expect(screen.getByText("Apex Logistics Corp")).toBeInTheDocument();
    expect(screen.getByText("#34 - Warehouse Associate")).toBeInTheDocument();
    expect(screen.getByText("Global Freight Solutions")).toBeInTheDocument();
    expect(screen.getByText("#56 - Production Line Assembler")).toBeInTheDocument();
    expect(screen.getByText("Client #103")).toBeInTheDocument();

    // Check details
    expect(screen.getByText("5 headcount")).toBeInTheDocument();
    expect(screen.getByText("Forklift Operation")).toBeInTheDocument();
    expect(screen.getByText("Pallet Stacking")).toBeInTheDocument();
    expect(screen.getByText("3 requests found")).toBeInTheDocument();
  });

  it("filters items when searching by title, client name, or ID", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockMRFs);

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    });

    const searchInput = screen.getByRole("textbox", {
      name: /search past manpower requests/i,
    });

    // 1. Search by title "Forklift"
    fireEvent.change(searchInput, { target: { value: "Forklift" } });
    expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    expect(screen.queryByText("#34 - Warehouse Associate")).not.toBeInTheDocument();
    expect(screen.queryByText("#56 - Production Line Assembler")).not.toBeInTheDocument();

    // 2. Clear search via clear button
    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    fireEvent.click(clearBtn);
    expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    expect(screen.getByText("#34 - Warehouse Associate")).toBeInTheDocument();

    // 3. Search by client name "Global Freight"
    fireEvent.change(searchInput, { target: { value: "Global Freight" } });
    expect(screen.queryByText("#12 - Forklift Operator")).not.toBeInTheDocument();
    expect(screen.getByText("#34 - Warehouse Associate")).toBeInTheDocument();

    // 4. Search by ID with hash "#56"
    fireEvent.change(searchInput, { target: { value: "#56" } });
    expect(screen.queryByText("#12 - Forklift Operator")).not.toBeInTheDocument();
    expect(screen.getByText("#56 - Production Line Assembler")).toBeInTheDocument();

    // 5. Search by numeric ID "12"
    fireEvent.change(searchInput, { target: { value: "12" } });
    expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    expect(screen.queryByText("#34 - Warehouse Associate")).not.toBeInTheDocument();

    // 6. Search with non-matching term
    fireEvent.change(searchInput, { target: { value: "NonExistentQuery" } });
    expect(screen.getByText("No manpower requests found")).toBeInTheDocument();
    expect(
      screen.getByText(/No past requisitions match your search criteria/i)
    ).toBeInTheDocument();
  });

  it("calls onSelectMRF with the chosen MRF and preserveClient: true by default", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockMRFs);

    const onSelectMRF = vi.fn();
    renderModal({
      onSelectMRF,
      currentClientId: 101,
      currentClientName: "Apex Logistics Corp",
    });

    await waitFor(() => {
      expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    });

    // Check client preservation checkbox exists and is checked
    const checkbox = screen.getByRole("checkbox", {
      name: /keep currently selected client \(Apex Logistics Corp\)/i,
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    // Click "Clone Specification" on the first card
    const cloneButtons = screen.getAllByRole("button", {
      name: /clone specification/i,
    });
    fireEvent.click(cloneButtons[0]);

    expect(onSelectMRF).toHaveBeenCalledTimes(1);
    expect(onSelectMRF).toHaveBeenCalledWith(mockMRFs[0], true);
  });

  it("calls onSelectMRF with preserveClient: false when the checkbox is unchecked", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockMRFs);

    const onSelectMRF = vi.fn();
    renderModal({
      onSelectMRF,
      currentClientId: 101,
      currentClientName: "Apex Logistics Corp",
    });

    await waitFor(() => {
      expect(screen.getByText("#34 - Warehouse Associate")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox", {
      name: /keep currently selected client \(Apex Logistics Corp\)/i,
    });
    // Uncheck preservation
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Click "Clone Specification" on the second card (#34)
    const cloneButtons = screen.getAllByRole("button", {
      name: /clone specification/i,
    });
    fireEvent.click(cloneButtons[1]);

    expect(onSelectMRF).toHaveBeenCalledTimes(1);
    expect(onSelectMRF).toHaveBeenCalledWith(mockMRFs[1], false);
  });

  it("calls onClose when Cancel button or dialog close button is clicked", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockMRFs);

    const onClose = vi.fn();
    renderModal({ onClose });

    await waitFor(() => {
      expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialogCloseBtn = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(dialogCloseBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders empty state when no previous MRFs are returned", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue([]);

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("No manpower requests found")).toBeInTheDocument();
    });

    expect(
      screen.getByText("There are no previous manpower requests available to clone.")
    ).toBeInTheDocument();
  });

  it("renders loading state while fetching requests", () => {
    vi.mocked(taApi.listMRFs).mockReturnValue(new Promise(() => {}));

    renderModal();

    expect(screen.getByText("Loading previous manpower requests...")).toBeInTheDocument();
  });

  it("renders fallback client name when currentClientName is not provided", async () => {
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockMRFs);

    renderModal({ currentClientId: 88 });

    await waitFor(() => {
      expect(screen.getByText("#12 - Forklift Operator")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("checkbox", {
        name: /keep currently selected client \(Client #88\)/i,
      })
    ).toBeInTheDocument();
  });
});
