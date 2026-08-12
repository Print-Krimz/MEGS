import supabase from '../../utils/supabase.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

export const registerUser = async (email: string, password: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("An account with this email already exists");
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Failed to create account");
  }

  const dbUser = await prisma.user.create({
    data: {
      id: authData.user.id,
      email: authData.user.email!,
      role: "APPLICANT",
    },
  });

  logAudit(dbUser.id, "USER_REGISTERED", "User", dbUser.id, { email: dbUser.email });

  return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
};

export const loginUser = async (email: string, password: string, ip?: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error("Invalid email or password");
  }

  logAudit(data.user.id, "USER_LOGGED_IN", "User", data.user.id, { ip });

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
};

export const logoutUser = async (token?: string) => {
  if (token) {
    await supabase.auth.admin.signOut(token);
  }
};
