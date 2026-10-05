import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAIClient, AI_MODEL } from "./client";

/**
 * Live AI connectivity check for the admin Settings page.
 *
 * Makes ONE minimal request with the same key and model every AI feature uses
 * (Fluent scoring, Techno knowledge generation, the AI interviewer, report
 * writing) and maps the SDK's typed errors to a plain-language cause. Added
 * after 5 Oct 2026: every Techno generation on the L&D function failed within
 * two seconds and the only way to learn why was a Render log search.
 *
 * Never retried and short-timed: this is a probe, not a feature path.
 */

export type AiConnectivityResult =
  | { ok: true; model: string; latencyMs: number; inputTokens: number; outputTokens: number; checkedAt: string }
  | {
      ok: false;
      configured: boolean;
      model: string;
      latencyMs: number;
      checkedAt: string;
      /** Stable category for the UI badge. */
      kind: "not_configured" | "auth" | "permission" | "model" | "spend_limit" | "billing" | "bad_request" | "rate_limit" | "overloaded" | "server" | "network" | "unknown";
      httpStatus: number | null;
      message: string;
      /** What to do about it, in one sentence. */
      hint: string;
    };

const PROBE_TIMEOUT_MS = 20_000;

export async function checkAiConnectivity(): Promise<AiConnectivityResult> {
  const checkedAt = new Date().toISOString();
  const client = getAIClient();
  if (!client) {
    return {
      ok: false,
      configured: false,
      model: AI_MODEL,
      latencyMs: 0,
      checkedAt,
      kind: "not_configured",
      httpStatus: null,
      message: "ANTHROPIC_API_KEY is not set on this server.",
      hint: "Add ANTHROPIC_API_KEY to the service's environment and redeploy. Until then every AI feature serves its static fallback.",
    };
  }

  const started = Date.now();
  try {
    const res = await client.messages.create(
      {
        model: AI_MODEL,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with the single word OK." }],
      },
      { timeout: PROBE_TIMEOUT_MS, maxRetries: 0 },
    );
    return {
      ok: true,
      model: res.model,
      latencyMs: Date.now() - started,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      checkedAt,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const base = { ok: false as const, configured: true, model: AI_MODEL, latencyMs, checkedAt };
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof Anthropic.AuthenticationError) {
      return { ...base, kind: "auth", httpStatus: err.status, message, hint: "The API key is invalid or has been revoked. Compare ANTHROPIC_API_KEY on the server with the keys listed in the Anthropic Console, then redeploy." };
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return { ...base, kind: "permission", httpStatus: err.status, message, hint: "The key is valid but not allowed to use this model or workspace. Check the key's workspace and model access in the Anthropic Console." };
    }
    if (err instanceof Anthropic.NotFoundError) {
      return { ...base, kind: "model", httpStatus: err.status, message, hint: `The configured model "${AI_MODEL}" is not available to this account. Change AI_MODEL in src/lib/ai/client.ts to a model the account can use.` };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ...base, kind: "rate_limit", httpStatus: err.status, message, hint: "The account is being rate limited. Wait a few minutes and run the check again; if it persists, review the organisation's rate limits in the Anthropic Console." };
    }
    if (err instanceof Anthropic.BadRequestError) {
      // The organisation's own monthly spend cap (seen 5 Oct 2026: "You have
      // reached your specified API usage limits. You will regain access on
      // 2026-11-01 at 00:00 UTC."). Not a credit problem: the limit is raised
      // in the Console and access resumes at once.
      if (/usage limit/i.test(message)) {
        const reset = message.match(/regain access on ([^."]+)/i)?.[1];
        return { ...base, kind: "spend_limit", httpStatus: err.status, message, hint: `The organisation's monthly API spend limit has been reached${reset ? ` (resets ${reset})` : ""}. Raise or remove the limit under Settings, Limits in the Anthropic Console; AI features resume immediately, no redeploy needed.` };
      }
      const billing = /credit|billing|balance|purchase/i.test(message);
      return billing
        ? { ...base, kind: "billing", httpStatus: err.status, message, hint: "The Anthropic account has run out of credit. Add credit under Billing in the Anthropic Console; AI features resume immediately afterwards." }
        : { ...base, kind: "bad_request", httpStatus: err.status, message, hint: "The API rejected the request. The message above names the parameter; this usually means the model or request shape in the code needs updating." };
    }
    if (err instanceof Anthropic.InternalServerError) {
      const overloaded = err.status === 529 || /overloaded/i.test(message);
      return overloaded
        ? { ...base, kind: "overloaded", httpStatus: err.status, message, hint: "The API is temporarily overloaded. Feature calls retry automatically; run the check again in a few minutes." }
        : { ...base, kind: "server", httpStatus: err.status, message, hint: "The API returned a server error. Run the check again in a few minutes and check status.anthropic.com." };
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return { ...base, kind: "network", httpStatus: null, message, hint: `No response within ${PROBE_TIMEOUT_MS / 1000} seconds. Check outbound network access from the server to api.anthropic.com.` };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ...base, kind: "network", httpStatus: null, message, hint: "The server could not reach api.anthropic.com. Check outbound network access, DNS and any proxy on the host." };
    }
    if (err instanceof Anthropic.APIError) {
      return { ...base, kind: "unknown", httpStatus: err.status ?? null, message, hint: "Unexpected API error. The message above is the API's own description." };
    }
    return { ...base, kind: "unknown", httpStatus: null, message, hint: "Unexpected error while calling the API." };
  }
}
