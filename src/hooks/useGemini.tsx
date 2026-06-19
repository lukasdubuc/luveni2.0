// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.tsx
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StoreSnapshot {
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
  orders_total: number;
  orders_paid: number;
  orders_pending: number;
  orders_failed: number;
  leads_total: number;
  products_published: number;
  products_total: number;
  recent_orders: { email: string; amount_cents: number; status: string; created_at: string }[];
  top_products: { title: string; revenue: number; units: number }[];
}

interface UseGeminiOptions {
  googleToken?: string | null;
  storeSnapshot?: StoreSnapshot | null;
}

export function useGemini(options: UseGeminiOptions = {}) {
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      console.log("[useGemini] Chat Turn Requested:", { userText, timezone });
      history.current.push({ role: "user", content: userText });

      try {
        console.log("[useGemini] Executing Edge Function request...");
        const CHAT_URL = 'https://unitqfuetxedmmrvlocu.supabase.co/functions/v1/jarvis-chat';
        const CHAT_ANON = 'sb_publishable_0jMwlf-VJWjWFjpA1Iz2dA_Lq8EIumc';
        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': CHAT_ANON, 'Authorization': `Bearer ${CHAT_ANON}` },
          body: JSON.stringify({ tool: 'chat', args: { userText, history: history.current.slice(0, -1), storeSnapshot: storeSnapshot || null, timezone } }),
        });
        const data = await response.json().catch(() => ({}));
        const error = !response.ok || !data?.reply ? new Error(data?.error || `chat ${response.status}`) : null;

        if (error) {
          console.error("[useGemini] Edge Function returned an explicit error object:", error);
          throw error;
        }

        console.log("[useGemini] Edge Function returned successfully:", data);

        const reply = data?.reply || "No response received.";
        history.current.push({ role: "assistant", content: reply });
        onChunk?.(reply);
        return reply;
      } catch (e) {
        // Prevent conversational poisoning by popping failed turns
        if (history.current.length > 0) {
          history.current.pop();
        }

        let details = "";
        if (e && typeof e === 'object' && 'context' in e) {
          const context = (e as any).context;
          if (context instanceof Response) {
            try {
              const res = context.clone();
              const jsonErr = await res.json();
              details = typeof jsonErr === 'object' ? JSON.stringify(jsonErr) : String(jsonErr);
            } catch {
              try {
                details = await context.clone().text();
              } catch {}
            }
          }
        }

        const error = e instanceof Error ? e : new Error(String(e));
        const errorMsg = details ? `${details}` : error.message;
        console.error("[useGemini] Conversation execution failed:", errorMsg);
        
        const fallbackMsg = "I apologize, sir, but I encountered a temporary connection issue. Could you repeat that?";
        history.current.push({ role: "assistant", content: fallbackMsg });
        onChunk?.(fallbackMsg);
        return fallbackMsg;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    console.log("[useGemini] History state reset.");
    history.current = [];
  }, []);

  return { ask, reset };
}
