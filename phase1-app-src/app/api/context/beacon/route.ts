/**
 * Beacon purge endpoint for unload-time cleanup.
 * navigator.sendBeacon can only POST, so this accepts { action:'purge', token }.
 */
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let token: string | null = null;
  try {
    const body = (await req.json()) as { action?: string; token?: string };
    if (body.action === "purge" && body.token && /^[0-9a-f]{64}$/.test(body.token)) {
      token = body.token;
    }
  } catch {
    token = null;
  }
  if (token) store.purge(token);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
