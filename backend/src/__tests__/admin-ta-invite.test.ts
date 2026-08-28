import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock("../utils/supabase.js", () => ({
  default: {
    auth: {
      admin: {
        createUser: (...args: any[]) => mockCreateUser(...args),
        deleteUser: (...args: any[]) => mockDeleteUser(...args),
      },
    },
  },
}));

const mockFindUniqueUser = vi.fn();
const mockCreateUserDb = vi.fn();
const mockUpdateUserDb = vi.fn();
const mockDeleteUserDb = vi.fn();

const mockFindUniqueInvitation = vi.fn();
const mockFindFirstInvitation = vi.fn();
const mockCreateInvitation = vi.fn();
const mockUpdateInvitation = vi.fn();
const mockUpdateManyInvitation = vi.fn();

vi.mock("../utils/prisma.js", () => ({
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUniqueUser(...args),
      create: (...args: any[]) => mockCreateUserDb(...args),
      update: (...args: any[]) => mockUpdateUserDb(...args),
      delete: (...args: any[]) => mockDeleteUserDb(...args),
    },
    userInvitation: {
      findUnique: (...args: any[]) => mockFindUniqueInvitation(...args),
      findFirst: (...args: any[]) => mockFindFirstInvitation(...args),
      create: (...args: any[]) => mockCreateInvitation(...args),
      update: (...args: any[]) => mockUpdateInvitation(...args),
      updateMany: (...args: any[]) => mockUpdateManyInvitation(...args),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

const mockSendTAInvitationEmail = vi.fn();
const mockSendMail = vi.fn();
vi.mock("../utils/mailer.js", () => ({
  sendTAInvitationEmail: (...args: any[]) => mockSendTAInvitationEmail(...args),
  sendMail: (...args: any[]) => mockSendMail(...args),
  fromAddress: "test@example.com",
}));

import {
  inviteTA,
  resendTAInvitation,
  cancelTAInvitation,
} from "../services/admin/admin.service.js";

describe("TA Invitation and Staff Account Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Admin invites TA", () => {
    it("creates user in DB with TALENT_ACQUISITION role and PENDING status, and creates single-use invitation token", async () => {
      mockFindUniqueUser.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "new-ta-uuid", email: "newta@megs.com" } },
        error: null,
      });
      mockCreateUserDb.mockResolvedValueOnce({
        id: "new-ta-uuid",
        email: "newta@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "PENDING",
        mustChangePassword: false,
        invitedAt: new Date(),
        invitedBy: "admin-123",
      });
      mockUpdateManyInvitation.mockResolvedValueOnce({ count: 0 });
      mockCreateInvitation.mockResolvedValueOnce({
        id: "invitation-1",
        userId: "new-ta-uuid",
        email: "newta@megs.com",
        tokenHash: "mocked-hash",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        isUsed: false,
      });
      mockSendTAInvitationEmail.mockResolvedValueOnce({ success: true, messageId: "email-123" });

      const result = await inviteTA("admin-123", "newta@megs.com", "Jane", "Doe");

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newta@megs.com",
        })
      );

      expect(mockCreateUserDb).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "new-ta-uuid",
          email: "newta@megs.com",
          role: "TALENT_ACQUISITION",
          accountStatus: "PENDING",
          mustChangePassword: false,
          invitedBy: "admin-123",
        }),
        select: expect.any(Object),
      });

      expect(mockCreateInvitation).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "new-ta-uuid",
          email: "newta@megs.com",
          createdByAdminId: "admin-123",
          isUsed: false,
        }),
      });

      expect(mockSendTAInvitationEmail).toHaveBeenCalledWith(
        "newta@megs.com",
        expect.stringContaining("/setup-account/"),
        "Jane"
      );

      expect(result.user.role).toBe("TALENT_ACQUISITION");
      expect(result.user.accountStatus).toBe("PENDING");
    });

    it("rejects invitation if email already belongs to an active account", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "existing-user",
        email: "existing@megs.com",
        accountStatus: "ACTIVE",
      });

      await expect(
        inviteTA("admin-123", "existing@megs.com", "John", "Doe")
      ).rejects.toThrow("A user with this email already exists");

      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });

  describe("Admin resends TA invitation", () => {
    it("invalidates previous tokens and dispatches new token without creating duplicate user", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "ta-uuid-1",
        email: "recruiter@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "PENDING",
        applicantProfile: { firstName: "Maria", lastName: "Santos" },
      });

      mockUpdateManyInvitation.mockResolvedValueOnce({ count: 1 });
      mockCreateInvitation.mockResolvedValueOnce({
        id: "invitation-2",
        userId: "ta-uuid-1",
        email: "recruiter@megs.com",
      });
      mockUpdateUserDb.mockResolvedValueOnce({
        id: "ta-uuid-1",
        email: "recruiter@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "PENDING",
        invitedAt: new Date(),
      });
      mockSendTAInvitationEmail.mockResolvedValueOnce({ success: true });

      const result = await resendTAInvitation("admin-123", "ta-uuid-1");

      expect(mockUpdateManyInvitation).toHaveBeenCalledWith({
        where: { userId: "ta-uuid-1", isUsed: false },
        data: { isUsed: true },
      });

      expect(mockCreateInvitation).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "ta-uuid-1",
          email: "recruiter@megs.com",
          createdByAdminId: "admin-123",
          isUsed: false,
        }),
      });

      expect(mockCreateUserDb).not.toHaveBeenCalled();
      expect(mockSendTAInvitationEmail).toHaveBeenCalledWith(
        "recruiter@megs.com",
        expect.stringContaining("/setup-account/"),
        "Maria"
      );
      expect(result.message).toContain("Invitation resent successfully");
    });

    it("rejects resending if user account is already active", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "active-ta-uuid",
        email: "active@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
      });

      await expect(resendTAInvitation("admin-123", "active-ta-uuid")).rejects.toThrow(
        "Cannot resend invitation: Account is already active"
      );
      expect(mockCreateInvitation).not.toHaveBeenCalled();
    });
  });

  describe("Admin cancels TA invitation", () => {
    it("invalidates invitation tokens and removes pending user account", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "pending-ta-uuid",
        email: "cancelme@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "PENDING",
      });

      mockUpdateManyInvitation.mockResolvedValueOnce({ count: 1 });
      mockDeleteUserDb.mockResolvedValueOnce({ id: "pending-ta-uuid" });
      mockDeleteUser.mockResolvedValueOnce({ data: {}, error: null });

      const result = await cancelTAInvitation("admin-123", "pending-ta-uuid");

      expect(mockUpdateManyInvitation).toHaveBeenCalledWith({
        where: { userId: "pending-ta-uuid", isUsed: false },
        data: { isUsed: true },
      });
      expect(mockDeleteUserDb).toHaveBeenCalledWith({
        where: { id: "pending-ta-uuid" },
      });
      expect(result.message).toContain("Invitation cancelled successfully");
    });

    it("rejects cancellation if account is already ACTIVE", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "active-ta-uuid",
        email: "active@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
      });

      await expect(cancelTAInvitation("admin-123", "active-ta-uuid")).rejects.toThrow(
        "Cannot cancel invitation for an active user"
      );
      expect(mockDeleteUserDb).not.toHaveBeenCalled();
    });
  });
});
