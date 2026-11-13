import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Role } from "../lib/types/enums";
import { TA_COPY } from "../lib/ta-copy";

/** Clients, requests and job openings live under /admin for the team leader and /ta for recruiters. */
export function useRecordBase(): "/admin" | "/ta" {
  // Read the context directly: shared record pages and their tests may render without a signed-in provider.
  const user = useContext(AuthContext)?.user;
  return user?.role === Role.ADMINISTRATOR ? "/admin" : "/ta";
}

/** Breadcrumb root: "Administration" for the team leader, "Overview" for recruiters. */
export function recordRootLabel(base: "/admin" | "/ta"): string {
  return base === "/admin" ? "Administration" : TA_COPY.breadcrumbRoot;
}
