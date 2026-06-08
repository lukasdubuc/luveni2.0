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

      // Track the user message locally
      history.current.push({ role: "user", content: userText });

      // Format history turns to be compatible with both standard and Gemini SDK formats
      const mappedHistory = history.current.slice(0, -1).map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        content: item.content,
        parts: [{ text: item.content }]
      }));

      try {
        const { data, error } = await supabase.functions.invoke<{ reply?: string }>(
          "jarvis-brain",
          {
            body: {
              tool: "chat",
              args: {
                userText,
                history: mappedHistory,
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
        // Remove the failed user turn to prevent consecutive-turn history pollution
        if (history.current.length > 0) {
          history.current.pop();
        }

        let details = "";
        // Extract the error payload returned by the Supabase Edge Function for debugging
        if (e && typeof e === 'object' && 'context' in e) {
          try {
            // @ts-ignore
            const jsonErr = await e.context.json();
            details = typeof jsonErr === 'object' ? JSON.stringify(jsonErr) : String(jsonErr);
          } catch {
            try {
              // @ts-ignore
              details = await e.context.text();
            } catch {}
          }
        }

        const error = e instanceof Error ? e : new Error(String(e));
        const errorMsg = details ? `${error.message}: ${details}` : error.message;
        console.error("[Jarvis] Edge function error details:", errorMsg);
        throw new Error(errorMsg);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    history.current = [];
  }, []);

  return { ask, reset };
}
