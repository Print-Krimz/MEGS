import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../../lib/api/client";
import { ErrorState } from "../ErrorState";

describe("ErrorState", () => {
  it("keeps transport status codes out of the user-facing recovery message", () => {
    render(<ErrorState error={new ApiError(500, "POST /api/v1/applications failed")} />);

    expect(screen.getByText("We couldn't load this information.")).toBeDefined();
    expect(screen.queryByText(/error 500/i)).toBeNull();
    expect(screen.queryByText(/POST \/api/i)).toBeNull();
  });
});
