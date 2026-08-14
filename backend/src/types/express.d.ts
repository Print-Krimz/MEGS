// Extends Express Request with authenticated user payload.

import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;   // Supabase UUID
        email: string;
        role: string;
        mustChangePassword?: boolean;
        accountStatus?: string;
      };
    }
  }
}
