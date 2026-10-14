import { useState } from "react";
import { useSecurityControls } from "../../hooks/useSecurityControls";
import { authApi } from "../../lib/api/auth.api";
import type { LoginResponse } from "../../lib/types/auth.types";
import { Button } from "../ui";
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
  return <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm">
    <p>Staff MFA is temporarily disabled for this demo. You can continue with your authenticated session.</p>
    {error && <p role="alert">{error}</p>}
    <Button type="button" loading={pending} onClick={() => void continueSession()}>Continue without MFA</Button>
  </div>;
};
