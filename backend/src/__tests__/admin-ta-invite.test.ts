import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockGenerateLink = vi.fn();

vi.mock("../utils/supabase.js", () => ({
  default: {
    auth: {
      admin: {
        createUser: (...args: any[]) => mockCreateUser(...args),
        generateLink: (...args: any[]) => mockGenerateLink(...args),
      },
    },
  },
}));

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock("../utils/prisma.js", () => ({
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      create: (...args: any[]) => mockCreate(...args),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

const mockSendMail = vi.fn();
vi.mock("../utils/mailer.js", () => ({
  sendMail: (...args: any[]) => mockSendMail(...args),
  fromAddress: "test@example.com",
}));

import { inviteTA } from "../services/admin/admin.service.js";

describe("TA Invitation and Staff Account Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Admin invites TA", () => {
    it("creates user in DB with TALENT_ACQUISITION role and INVITED status", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "new-ta-uuid", email: "newta@megs.com" } },
        error: null,
      });
      mockCreate.mockResolvedValueOnce({
        id: "new-ta-uuid",
        email: "newta@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "INVITED",
        mustChangePassword: true,
        invitedAt: new Date(),
      });
      mockGenerateLink.mockResolvedValueOnce({
        data: { properties: { action_link: "https://auth.example.com/setup?token=xyz" } },
        error: null,
      });
      mockSendMail.mockResolvedValueOnce({ success: true, messageId: "email-123" });

      const result = await inviteTA("admin-123", "newta@megs.com", "Jane", "Doe");

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newta@megs.com",
          email_confirm: true,
        })
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "new-ta-uuid",
          email: "newta@megs.com",
          role: "TALENT_ACQUISITION",
          accountStatus: "INVITED",
          mustChangePassword: true,
          invitedBy: "admin-123",
        }),
        select: expect.any(Object),
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        "newta@megs.com",
        expect.stringContaining("Talent Acquisition"),
        expect.stringContaining("https://auth.example.com/setup?token=xyz"),
        expect.stringContaining("https://auth.example.com/setup?token=xyz")
      );

      expect(result.user.role).toBe("TALENT_ACQUISITION");
      expect(result.user.accountStatus).toBe("INVITED");
    });

    it("rejects invitation if email already exists in system", async () => {
      mockFindUnique.mockResolvedValueOnce({ id: "existing-user", email: "existing@megs.com" });

      await expect(
        inviteTA("admin-123", "existing@megs.com", "John", "Doe")
      ).rejects.toThrow("A user with this email already exists");

      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });
});
