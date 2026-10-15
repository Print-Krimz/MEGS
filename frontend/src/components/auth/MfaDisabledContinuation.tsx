import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Spinner } from "@/components/shadcn/spinner";
import { useSecurityControls } from "../../hooks/useSecurityControls";
import { authApi } from "../../lib/api/auth.api";
import type { LoginResponse } from "../../lib/types/auth.types";
import { formatErrorMessage } from "../../lib/feedback";

export const MfaDisabledContinuation = ({ token, open, onSuccess }: {
  token: string; open: boolean; onSuccess: (data: LoginResponse) => void;
}) => {
  const query = useSecurityControls(open);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!query.data?.mfaDisabled || query.isError) return null;
  const continueSession = async () => {
    setPending(true); setError(null);
    try { onSuccess(await authApi.continueWithoutMfa(token)); }
    catch (error) { setError(formatErrorMessage(error)); void query.refetch(); }
    finally { setPending(false); }
  };
  return <div className="flex flex-col gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
    <p>Staff MFA is temporarily disabled for this demo. You can continue with your authenticated session.</p>
    {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    <Button type="button" variant="outline" className="self-start" disabled={pending} onClick={() => void continueSession()}>
      {pending && <Spinner data-icon="inline-start" />}
      Continue without MFA
    </Button>
  </div>;
};
