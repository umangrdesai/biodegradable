"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateSessionToken } from "@/lib/session";
import { useSessionHygiene } from "@/lib/useSessionHygiene";

/**
 * Phase 1 landing page.
 *
 * Demonstrates the full ephemeral foundation working end to end:
 *  - an anonymous session token minted in the browser (volatile only),
 *  - a round-trip to the volatile, TTL-bound server context store,
 *  - live, non-identifying status counters,
 *  - session-hygiene listeners that wipe local state on close/idle.
 *
 * Design matches the live site exactly (Poppins/DM Mono, forest + cream + amber)
 * and uses the new transparent SVG logo.
 */
export default function Home() {
  const [token, setToken] = useState<string>("generating locally…");
  const tokenRef = useRef<string | null>(null);
  const [active, setActive] = useState<number>(0);
  const [ttlMin, setTtlMin] = useState<number>(30);
  const [synced, setSynced] = useState<boolean>(false);

  const getToken = useCallback(() => tokenRef.current, []);
  useSessionHygiene(getToken);

  // Mint the anonymous token on the client and register a volatile context.
  useEffect(() => {
    const t = getOrCreateSessionToken();
    tokenRef.current = t;
    setToken(t);

    // Register an empty working context so the live count is honest.
    fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": t },
      body: JSON.stringify({ startedAt: Date.now() }),
    })
      .then(() => setSynced(true))
      .catch(() => setSynced(false));
  }, []);

  // Poll the non-identifying status endpoint.
  useEffect(() => {
    let alive = true;
    const pull = () => {
      fetch("/api/session")
        .then((r) => r.json())
        .then((d: { activeSessions: number; ttlMs: number }) => {
          if (!alive) return;
          setActive(d.activeSessions);
          setTtlMin(Math.round(d.ttlMs / 60000));
        })
        .catch(() => {});
    };
    pull();
    const id = setInterval(pull, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div id="app">
      <div className="stripe" />
      <div className="stripe-sub" />

      <nav>
        <div className="nav-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.svg" alt="BioDegradableAI" />
        </div>
        <div className="nav-right">
          <a href="#token">stay off-record →</a>
        </div>
      </nav>

      <section className="hero" id="token">
        <div className="eyebrow">
          <span className="eline" />
          Phase 1 · Ephemeral foundation · Live
        </div>

        <h1 className="h1">
          No login.
          <br />
          No history.
          <br />
          <span className="acc">No record</span> of this
          <br />
          session, the moment it ends.
        </h1>

        <p className="body-p">
          Your identity here is a random token, generated in your browser and held
          only in volatile memory. Close the tab and it is gone. We never store an
          account, and we never keep the content of your session to build a profile.
        </p>

        <div className="token-box">
          <div className="tlbl">
            your local session token · generated in browser · never persisted
          </div>
          <div className="tval">{token}</div>
          <div className="tnote">
            Lives only in your <em>SessionStorage</em>. Close this tab and it&rsquo;s
            gone. Server-side context is held for {ttlMin} minutes, then evicted —{" "}
            <em>{synced ? "context registered" : "syncing…"}</em>.
          </div>
        </div>

        <div className="counts">
          <div className="cc">
            <div className="cl">user records</div>
            <div className="cv r">0</div>
          </div>
          <div className="cc">
            <div className="cl">prompt logs</div>
            <div className="cv r">0</div>
          </div>
          <div className="cc">
            <div className="cl">active volatile sessions</div>
            <div className="cv g">{active.toLocaleString()}</div>
          </div>
        </div>
      </section>

      <footer>
        <div className="f-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.svg" alt="BioDegradableAI" />
        </div>
        <div>zero user records · zero prompt logs · volatile by design</div>
        <div className="f-right">phase 1 · 2026</div>
      </footer>
    </div>
  );
}
