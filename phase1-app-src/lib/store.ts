/**
 * Volatile context store (SERVER-SIDE).
 *
 * Phase 1 privacy guarantees enforced here:
 *  - This holds ONLY the transient working context needed to produce a coherent
 *    response, keyed by the anonymous session token. It is NOT a user table.
 *  - Every entry carries a short TTL and is evicted automatically. A periodic
 *    sweep removes anything past its expiry as a backstop.
 *  - Persistence is disabled by design: nothing here is written to disk. The
 *    default implementation is a plain in-process Map so the working data
 *    cannot be reconstructed from storage after expiry.
 *  - We never create a record whose purpose is to retain a user's history.
 *
 * The interface is deliberately small so the in-memory default can later be
 * swapped for a Redis adapter (persistence disabled, per-key TTL) without
 * changing any calling code.
 */

/** Default time-to-live for a working context, in milliseconds (30 minutes). */
export const CONTEXT_TTL_MS = 30 * 60 * 1000;

/** Sweep interval for the backstop cleanup, in milliseconds (5 minutes). */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export interface ContextEntry {
  /** Opaque working context. Never personal data; never persisted to disk. */
  readonly data: unknown;
  /** Absolute expiry timestamp (epoch ms). */
  readonly expiresAt: number;
}

export interface VolatileStore {
  get(token: string): ContextEntry | undefined;
  set(token: string, data: unknown, ttlMs?: number): void;
  /** Forget a session immediately (e.g. on explicit end / tab close beacon). */
  purge(token: string): void;
  /** Number of live sessions (for non-identifying status display only). */
  size(): number;
}

/**
 * In-memory, persistence-free store. Survives only for the life of the process.
 * Use a singleton across hot reloads in dev via globalThis.
 */
class InMemoryVolatileStore implements VolatileStore {
  private readonly map = new Map<string, ContextEntry>();

  constructor() {
    // Backstop sweep. unref() so it never keeps the process alive.
    const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    if (typeof timer === "object" && timer && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }
  }

  get(token: string): ContextEntry | undefined {
    const entry = this.map.get(token);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.map.delete(token);
      return undefined;
    }
    return entry;
  }

  set(token: string, data: unknown, ttlMs: number = CONTEXT_TTL_MS): void {
    this.map.set(token, { data, expiresAt: Date.now() + ttlMs });
  }

  purge(token: string): void {
    this.map.delete(token);
  }

  size(): number {
    return this.map.size;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [token, entry] of this.map) {
      if (now >= entry.expiresAt) this.map.delete(token);
    }
  }
}

// Singleton, stable across Next.js dev hot-reloads.
const globalForStore = globalThis as unknown as { __bdaiStore?: VolatileStore };
export const store: VolatileStore =
  globalForStore.__bdaiStore ?? (globalForStore.__bdaiStore = new InMemoryVolatileStore());
