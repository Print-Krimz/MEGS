import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MRFHistoryTab } from "./MRFHistoryTab";

describe("request creator identity", () => {
  const render = (name: string, email: string, readOnly = false) => renderToStaticMarkup(
    <MRFHistoryTab deployments={[]} headcount={1} readOnly={readOnly} createdAt="2026-01-01" createdByName={name} createdByEmail={email} />
  );
  it("shows email alongside a distinct name", () => {
    expect(render("Ana Cruz", "ana@example.com")).toContain("Ana Cruz (ana@example.com)");
  });
  it("does not duplicate the email fallback or show the creator in read-only mode", () => {
    expect(render("ana@example.com", "ana@example.com").match(/ana@example.com/g)).toHaveLength(1);
    expect(render("Ana Cruz", "ana@example.com", true)).not.toContain("ana@example.com");
    expect(render("Ana Cruz", "ana@example.com", true)).not.toContain("Ana Cruz");
  });
});
