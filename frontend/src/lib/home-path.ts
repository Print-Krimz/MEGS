import { Role } from "./types/enums";

/** Which role a path belongs to: /admin is Administrator, /ta is Talent Acquisition, /app is Applicant. Other paths are open to all. */
function areaRole(path: string): string | null {
  if (path === "/admin" || path.startsWith("/admin/")) return Role.ADMINISTRATOR;
  if (path === "/ta" || path.startsWith("/ta/")) return Role.TALENT_ACQUISITION;
  if (path === "/app" || path.startsWith("/app/")) return Role.APPLICANT;
  return null;
}

/** False when the path is another role's area, which the route guard would answer with the 403 page. */
export function canOpenPath(user: { role: string }, path: string): boolean {
  const owner = areaRole(path);
  return owner === null || owner === user.role;
}

export function getHomePath(user: { role: string } | null | undefined): string {
  if (!user) return "/login";
  if (user.role === Role.ADMINISTRATOR) return "/admin";
  if (user.role === Role.TALENT_ACQUISITION) return "/ta";
  return "/app";
}
