

// Retry only explicit transient responses, never an ambiguous timed-out request.
// No record/storage writes occur in this helper.
export async function withProviderRetry<T>(request: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await request(); }
    catch (error: any) {
      const status = Number(error?.status ?? error?.code ?? error?.response?.status);
      if (![429, 500, 503].includes(status) || error?.name === "TimeoutError" || error?.name === "AbortError") throw error;
      const header = error?.response?.headers?.get?.("retry-after") ?? error?.headers?.["retry-after"];
      let details = error?.error?.details ?? error?.details;
      if (!details && typeof error?.message === "string") {
        try { details = JSON.parse(error.message)?.error?.details; } catch { /* no structured retry hint */ }
      }
      const hint = Array.isArray(details) ? details.find(item => item?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo")?.retryDelay : undefined;
      const hintMs = typeof hint === "string" && /^\d+(\.\d+)?s$/.test(hint) ? parseFloat(hint) * 1000 : 0;
      const headerMs = header ? (Number.isFinite(Number(header)) ? Number(header) * 1000 : Date.parse(header) - Date.now()) : 0;
      const delay = Math.max(1000 * 2 ** attempt + Math.floor(Math.random() * 250), hintMs || 0, headerMs || 0);
      if (attempt + 1 >= attempts || delay > 60_000) {
        throw Object.assign(new Error("AI provider is temporarily unavailable. Please retry resume processing later."), {
          retryable: true, retryAfterMs: delay,
        });
      }
      console.warn(`[Gemini] Provider busy; retry ${attempt + 1}/${attempts - 1} in ${Math.ceil(delay / 1000)}s.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
