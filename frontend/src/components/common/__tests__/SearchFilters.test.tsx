import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchFilters } from "../SearchFilters";

describe("SearchFilters", () => {
  it("gives search and filters clear accessible names", () => {
    render(
      <SearchFilters
        searchValue=""
        onSearchChange={vi.fn()}
        filters={[
          {
            key: "status",
            label: "Application status",
            options: [{ value: "SUBMITTED", label: "Submitted" }],
          },
        ]}
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "Search records" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Application status" })).toBeDefined();
  });
});
