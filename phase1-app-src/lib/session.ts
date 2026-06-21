/**
 * Anonymous session layer (CLIENT-SIDE).
 *
 * Phase 1 privacy guarantees enforced here:
 *  - Identity is a single cryptographically-random token, generated in the
 *    browser. It carries no personal meaning and cannot be reversed to an identity.
 *  - The token lives ONLY in volatile browser memory (sessionStorage), which the
 *    browser clears when the tab closes. We do not use cookies, localStorage, or
 *    any persistent identifier for tracking.
 *  - There are no accounts: no email, no password, no OAuth. Nothing to recover.
 *
 * The token authorizes a temporary, server-side usage context (see lib/store.ts).
 * The server never receives anything that ties the token to a real person.
 */

const TOKEN_KEY = "bdai_session_token";

/** 256 bits of CSPRNG randomness, hex-encoded. */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Returns the current session token, creating one if needed.
 * Stored in sessionStorage (volatile) — gone when the tab closes.
 * Safe to call on the client only.
 */
export function getOrCreateSessionToken(): string {
  if (typeof window === "undefined") {
    throw new Error("Session tokens are client-side only and never minted on the server.");
  }
  let token: string | null = null;
  try {
    token = window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // sessionStorage may be unavailable (privacy mode); fall back to in-memory.
  }
  if (!token) {
    token = generateToken();
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // If storage is blocked, the token simply lives for this page only.
    }
  }
  return token;
}

/** Immediately forget the local session token (used by session hygiene). */
export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Short, display-friendly form of a token for UI (never the basis of identity). */
export function shortToken(token: string): string {
  return token.length <= 16 ? token : `${token.slice(0, 8)}…${token.slice(-8)}`;
}
