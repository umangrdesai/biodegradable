/**
 * /api/chat — ephemeral AI streaming endpoint.
 *
 * Privacy guarantees:
 *  - Authenticated only by the anonymous session token (x-session-token header).
 *  - Messages are NEVER written to disk, logged, or stored beyond the request.
 *  - The session token is never forwarded to Anthropic — only the message content.
 *  - No IP, no account, no history. The conversation exists only in volatile RAM
 *    while this request is alive. When it ends, it's gone.
 *
 * Streams a Server-Sent Events (SSE) response so the UI can render tokens
 * as they arrive — no waiting for the full completion.
 */
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an anonymous, ephemeral AI assistant running on BioDegradableAI — a platform built on the principle of absolute privacy. You have no memory of previous conversations and no access to user data. Every session is cryptographically isolated and leaves no trace.

Your personality: precise, direct, and privacy-aware. You never ask for personal information. You never volunteer to "remember" things for later. You treat each message as if it's the only one that will ever exist — because architecturally, it is.

When users ask about how you work: you run on Anthropic's Claude model, accessed through an anonymous, session-keyed API call. No account is required. No prompt logs are kept. The conversation exists only in volatile memory and vanishes when the session ends.`;

function tokenFrom(req: NextRequest): string | null {
  const t = req.headers.get("x-session-token");
  return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
}

export async function POST(req: NextRequest) {
  const token = tokenFrom(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "missing or invalid session token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && typeof m.role === "string" && typeof m.content === "string"
  );

  if (!messages.length) {
    return new Response(JSON.stringify({ error: "no messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream from Anthropic Messages API
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ error: "AI error", detail: err }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pipe Anthropic's SSE stream directly to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Forward each SSE line, filtering to just text_delta events
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data.delta.text })}\n\n`));
                } else if (data.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch { /* skip malformed lines */ }
            }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
