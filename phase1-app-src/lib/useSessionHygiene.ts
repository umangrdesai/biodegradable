"use client";

/**
 * Session hygiene (CLIENT-SIDE).
 *
 * Ordinary cache-hygiene listeners (NOT anti-forensic tooling) that clear the
 * in-browser working state when the user is clearly done:
 *   - tab close / navigation away (pagehide / beforeunload)
 *   - tab hidden for a sustained period (visibilitychange + idle timer)
 *   - prolonged inactivity while the tab is open (idle timer)
 *
 * On these events we:
 *   1. Best-effort tell the server to purge the volatile context for this token.
 *   2. Forget the local session token so a returning user starts fresh and
 *      anonymous.
 */
import { useEffect, useRef } from "react";
import { clearSessionToken } from "./session";

/** Idle threshold before we consider the session abandoned (15 minutes). */
const IDLE_MS = 15 * 60 * 1000;
/** Grace period after the tab is hidden before purging (2 minutes). */
const HIDDEN_GRACE_MS = 2 * 60 * 1000;

export function useSessionHygiene(getToken: () => string | null): void {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const purgeServer = (token: string) => {
      // sendBeacon survives unload; DELETE-style payload via a tiny POST.
      try {
        const blob = new Blob([JSON.stringify({ action: "purge", token })], {
          type: "application/json",
        });
        navigator.sendBeacon?.("/api/context/beacon", blob);
      } catch {
        /* best effort only */
      }
    };

    const endSession = (alsoForgetToken: boolean) => {
      const token = getToken();
      if (token) {
        // Best-effort server purge.
        fetch("/api/context", {
          method: "DELETE",
          headers: { "x-session-token": token },
          keepalive: true,
        }).catch(() => {
          purgeServer(token);
        });
      }
      if (alsoForgetToken) clearSessionToken();
    };

    const resetIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => endSession(true), IDLE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
        hiddenTimer.current = setTimeout(() => endSession(true), HIDDEN_GRACE_MS);
      } else {
        if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
        resetIdle();
      }
    };

    const onLeave = () => endSession(true);

    // Activity that resets the idle timer.
    const activity = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"];
    activity.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    resetIdle();

    return () => {
      activity.forEach((e) => window.removeEventListener(e, resetIdle));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
    };
  }, [getToken]);
}
