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

      // Extract client's local timezone dynamically (e.g. "America/Chicago")
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      history.current.push({ role: "user", content: userText });

      try {
        // Invoking 'jarvis-brain' as requested
        const { data, error } = await supabase.functions.invoke<{ reply?: string }>(
          "jarvis-brain",
          {
            body: {
              tool: "chat",
              args: {
                userText,
                history: history.current.slice(0, -1),
                storeSnapshot: storeSnapshot || null,
                googleToken: googleToken || null,
                timezone,
              },
            },
          },
        );

        if (error) throw error;

        const reply = data?.reply || "No response received.";
        history.current.push({ role: "assistant", content: reply });
        onChunk?.(reply);
        return reply;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("[Jarvis] Edge function error:", error.message);
        throw error;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    history.current = [];
  }, []);

  return { ask, reset };
}
