"use client";

/**
 * Chat — ephemeral AI conversation interface.
 *
 * Privacy by design:
 *  - Messages live only in React state (volatile RAM). Refresh = gone.
 *  - No localStorage, no cookies, no IndexedDB.
 *  - Every request carries only the anonymous session token.
 *  - The conversation never touches a database.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ChatProps {
  sessionToken: string;
}

export default function Chat({ sessionToken }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const { text } = JSON.parse(payload);
              if (text) {
                assistantText += text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                    streaming: true,
                  };
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }

      // Mark streaming done
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: assistantText };
        return updated;
      });
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => !m.streaming));
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sessionToken]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <section className="chat-section">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-dot" />
          <span className="chat-label">ephemeral session · no logs · no history</span>
        </div>
        {messages.length > 0 && (
          <button className="chat-clear" onClick={clearChat} title="Clear conversation">
            clear session
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">⊘</div>
            <div className="chat-empty-title">Nothing here yet.</div>
            <div className="chat-empty-sub">
              This conversation exists only in your browser&apos;s volatile memory.
              <br />
              Close the tab and it disappears — permanently.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
            <div className="chat-msg-role">
              {msg.role === "user" ? "you" : "biodegradableai"}
            </div>
            <div className="chat-msg-content">
              {msg.content || (msg.streaming ? <span className="chat-cursor" /> : null)}
              {msg.streaming && msg.content && <span className="chat-cursor" />}
            </div>
          </div>
        ))}

        {error && (
          <div className="chat-error">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-wrap">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything. It won't be remembered."
          rows={1}
          disabled={loading}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? <span className="chat-spinner" /> : "↑"}
        </button>
      </div>

      <div className="chat-footer-note">
        ⊘ &nbsp;No logs · No account · Session ends when you close this tab
      </div>
    </section>
  );
}
