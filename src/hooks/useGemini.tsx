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
      const { storeSnapshot } = optionsRef.current;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      console.log("[useGemini] Chat Turn Requested:", { userText, timezone });
      history.current.push({ role: "user", content: userText });

      try {
        console.log("[useGemini] Executing Edge Function request...");
        
        // Invoke the 'jarvis-brain' edge function via the Supabase client helper
        const { data, error: invokeError } = await supabase.functions.invoke("jarvis-brain", {
          body: {
            tool: "chat",
            args: {
              userText,
              history: history.current.slice(0, -1), // Cleanly passes prior context excluding current turn
              storeSnapshot: storeSnapshot || null,
              timezone,
            },
          },
        });

        if (invokeError) throw invokeError;
        if (!data || !data.reply) throw new Error("No reply property returned from server.");

        console.log("[useGemini] Edge Function returned successfully:", data);

        const reply = data.reply;
        history.current.push({ role: "assistant", content: reply });
        onChunk?.(reply);
        return reply;
      } catch (e) {
        // Prevent conversational poisoning by popping failed turns
        if (history.current.length > 0) {
          history.current.pop();
        }

        const error = e instanceof Error ? e : new Error(String(e));
        console.error("[useGemini] Conversation execution failed:", error.message);
        
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
