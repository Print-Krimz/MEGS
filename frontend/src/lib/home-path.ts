import { Role } from "./types/enums";

export function getHomePath(user: { role: string } | null | undefined): string {
  if (!user) return "/login";
  if (user.role === Role.ADMINISTRATOR) return "/admin";
  if (user.role === Role.TALENT_ACQUISITION) return "/ta";
  return "/app";
}
