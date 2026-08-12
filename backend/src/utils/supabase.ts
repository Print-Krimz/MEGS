import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

if (!process.env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL in .env");
if (!process.env.SUPABASE_SECRET_KEY) throw new Error("Missing SUPABASE_SECRET_KEY in .env");

// Admin Supabase client using secret key (service_role).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      // Disable session persistence for stateless server runtime
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Set service_role Bearer header to bypass storage RLS
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      },
    },
  }
);

export default supabase;
