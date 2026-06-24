"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateSessionToken } from "@/lib/session";
import { useSessionHygiene } from "@/lib/useSessionHygiene";
import Chat from "@/components/Chat";

export default function Home() {
  const [token, setToken] = useState<string>("generating…");
  const tokenRef = useRef<string | null>(null);
  const [active, setActive] = useState<number>(0);
  const [synced, setSynced] = useState<boolean>(false);

  const getToken = useCallback(() => tokenRef.current, []);
  useSessionHygiene(getToken);

  useEffect(() => {
    const t = getOrCreateSessionToken();
    tokenRef.current = t;
    setToken(t);

    fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": t },
      body: JSON.stringify({ startedAt: Date.now() }),
    })
      .then(() => setSynced(true))
      .catch(() => setSynced(false));
  }, []);

  useEffect(() => {
    let alive = true;
    const pull = () => {
      fetch("/api/session")
        .then((r) => r.json())
        .then((d: { activeSessions: number }) => {
          if (!alive) return;
          setActive(d.activeSessions);
        })
        .catch(() => {});
    };
    pull();
    const id = setInterval(pull, 5000);
    return () => { alive = false; clearInterval(id); };
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
          <span className="nav-status">
            <span className={`nav-dot-live ${synced ? "synced" : ""}`} />
            {active > 0 ? `${active} active session${active !== 1 ? "s" : ""}` : "ready"}
          </span>
          <a href="#chat">start session →</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="eyebrow">
          <span className="eline" />
          No login · No history · No record
        </div>
        <h1 className="h1">
          The AI that<br />
          <span className="acc">forgets you</span><br />
          the moment<br />
          you leave.
        </h1>
        <p className="body-p">
          Zero retention. Pay-as-you-go. Anonymous by architecture, not by policy.
          Your session token is generated in your browser and never transmitted to
          identify you. Close the tab — it&apos;s gone.
        </p>
        <div className="hero-stats">
          <div className="stat">
            <div className="stat-v r">0</div>
            <div className="stat-l">user records</div>
          </div>
          <div className="stat">
            <div className="stat-v r">0</div>
            <div className="stat-l">prompt logs</div>
          </div>
          <div className="stat">
            <div className="stat-v g">{active}</div>
            <div className="stat-l">live sessions</div>
          </div>
        </div>
        <a href="#chat" className="cta-btn">start anonymous session →</a>
      </section>

      {/* Chat */}
      <div id="chat">
        {token && token !== "generating…" ? (
          <Chat sessionToken={token} />
        ) : (
          <div className="chat-loading">initialising session…</div>
        )}
      </div>

      {/* Token proof */}
      <section className="token-section">
        <div className="eyebrow"><span className="eline" />your session proof</div>
        <div className="token-box">
          <div className="tlbl">session token · generated in browser · never persisted server-side</div>
          <div className="tval">{token}</div>
          <div className="tnote">
            Stored only in <em>SessionStorage</em> (volatile memory).
            Close this tab and it&apos;s gone — {synced ? "✓ server context registered" : "syncing…"}
          </div>
        </div>
      </section>

      <footer>
        <div className="f-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.svg" alt="BioDegradableAI" />
        </div>
        <div>zero user records · zero prompt logs · volatile by design</div>
        <div className="f-right">© 2026 BioDegradableAI</div>
      </footer>
    </div>
  );
}
