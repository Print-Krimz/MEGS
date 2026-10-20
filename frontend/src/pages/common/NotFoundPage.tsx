import React from "react";
import { Compass } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getHomePath } from "../../lib/home-path";
import { StatusPage } from "../../components/common/StatusPage";

export const NotFoundPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <StatusPage
      icon={Compass}
      eyebrow="Error 404"
      title="This page doesn't exist"
      body="The link may be old or mistyped."
      primary={{ label: user ? "Back to your workspace" : "Sign in", to: getHomePath(user) }}
    />
  );
};
