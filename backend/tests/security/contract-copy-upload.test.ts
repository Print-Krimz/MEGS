import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../src/utils/prisma.js", () => ({ default: {} }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { getClaims: vi.fn() }, storage: { from: vi.fn() } } }));

import { uploadContractScan } from "../../src/middleware/upload.middleware.js";
import taRoutes from "../../src/routes/ta/ta.routes.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8//8/AwMDEwMYAAAkBgMBXaJOiAAAAABJRU5ErkJggg==", "base64");
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const app = express().post("/up", uploadContractScan.single("file"), (req, res) => res.json({ ok: true, size: req.file?.size }));

describe("optional signed contract copy upload", () => {
  it("accepts a PNG and a PDF", async () => {
    expect((await request(app).post("/up").attach("file", png, { filename: "a.png", contentType: "image/png" })).status).toBe(200);
    expect((await request(app).post("/up").attach("file", pdf, { filename: "a.pdf", contentType: "application/pdf" })).status).toBe(200);
  });

  it("rejects Word and WebP files by type", async () => {
    const docx = await request(app).post("/up").attach("file", Buffer.from("PK"), {
      filename: "a.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(docx.status).toBe(400);
    expect((await request(app).post("/up").attach("file", png, { filename: "a.webp", contentType: "image/webp" })).status).toBe(400);
  });

  it("rejects a file whose bytes do not match its declared type", async () => {
    const res = await request(app).post("/up").attach("file", Buffer.from("not a pdf"), { filename: "a.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("is a TA route guarded by application ownership", () => {
    const layer = (taRoutes as any).stack.find((l: any) => l.route?.path === "/applications/:id/contract/document" && l.route.methods.post);
    expect(layer).toBeTruthy();
    expect(layer.route.stack.map((l: any) => l.handle?.ownershipKind).filter(Boolean)).toEqual(["application"]);
  });
});
