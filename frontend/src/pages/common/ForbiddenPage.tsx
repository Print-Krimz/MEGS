import React from "react";
import { ShieldX } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getHomePath } from "../../lib/home-path";
import { StatusPage } from "../../components/common/StatusPage";

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <StatusPage
      icon={ShieldX}
      eyebrow="Error 403"
      title="You don't have permission to view this page"
      body="Your account can't open this area. If you think this is a mistake, contact your recruitment administrator."
      primary={{ label: user ? "Back to your workspace" : "Sign in", to: getHomePath(user) }}
    />
  );
};
