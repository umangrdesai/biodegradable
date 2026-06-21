/**
 * Volatile context API.
 *
 * GET  /api/context   -> read the current working context for a session token
 * POST /api/context   -> set/refresh the working context (short TTL)
 * DELETE /api/context  -> purge the session immediately
 *
 * Privacy notes:
 *  - The session token arrives in the `x-session-token` header. We do NOT log
 *    request bodies and we do NOT pair the token with an IP to build a profile.
 *  - Nothing here is written to disk; the store is volatile and TTL-bound.
 *  - This endpoint deliberately stores no personal data — only transient context.
 */
import { NextRequest, NextResponse } from "next/server";
import { store, CONTEXT_TTL_MS } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

function tokenFrom(req: NextRequest): string | null {
  const t = req.headers.get("x-session-token");
  // Accept only well-formed 64-hex-char tokens; reject anything else.
  return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
}

export async function GET(req: NextRequest) {
  const token = tokenFrom(req);
  if (!token) return NextResponse.json({ error: "missing or invalid token" }, { status: 400, headers: noStore });

  const entry = store.get(token);
  return NextResponse.json(
    {
      exists: Boolean(entry),
      ttlMs: CONTEXT_TTL_MS,
      data: entry?.data ?? null,
    },
    { headers: noStore },
  );
}

export async function POST(req: NextRequest) {
  const token = tokenFrom(req);
  if (!token) return NextResponse.json({ error: "missing or invalid token" }, { status: 400, headers: noStore });

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  store.set(token, body, CONTEXT_TTL_MS);
  return NextResponse.json({ ok: true, ttlMs: CONTEXT_TTL_MS }, { headers: noStore });
}

export async function DELETE(req: NextRequest) {
  const token = tokenFrom(req);
  if (!token) return NextResponse.json({ error: "missing or invalid token" }, { status: 400, headers: noStore });

  store.purge(token);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
