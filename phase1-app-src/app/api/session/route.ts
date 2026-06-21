/**
 * Non-identifying status endpoint.
 *
 * GET /api/session -> returns ONLY an aggregate count of live volatile sessions.
 * This intentionally exposes no per-user data. It exists so the landing page can
 * show a real "active sessions" figure that is honest and non-identifying.
 */
import { NextResponse } from "next/server";
import { store, CONTEXT_TTL_MS } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      activeSessions: store.size(),
      ttlMs: CONTEXT_TTL_MS,
      // Stated plainly so the contract is auditable:
      userRecords: 0,
      promptLogs: 0,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
