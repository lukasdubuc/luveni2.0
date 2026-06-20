// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.tsx
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VisualPayload } from "@/components/jarvis/visual/types";

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
    async (
      userText: string,
      opts?: { images?: string[]; fileText?: string },
    ): Promise<{ reply: string; visual: VisualPayload | null }> => {
      const { googleToken, storeSnapshot } = optionsRef.current;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const images = opts?.images ?? [];
      const fileText = opts?.fileText ?? "";

      console.log("[useGemini] Chat Turn Requested:", { userText, timezone, images: images.length });
      // Store only the text in history (images/files are per-turn, not replayed).
      history.current.push({ role: "user", content: userText });

      try {
        console.log("[useGemini] Executing Edge Function request...");
        const { data, error } = await supabase.functions.invoke<{ reply?: string; visual?: VisualPayload | null }>(
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
                images,
                fileText,
              },
            },
          },
        );

        if (error) {
          console.error("[useGemini] Edge Function returned an explicit error object:", error);
          throw error;
        }

        console.log("[useGemini] Edge Function returned successfully:", data);

        const reply = data?.reply || "No response received.";
        const visual = data?.visual ?? null;
        history.current.push({ role: "assistant", content: reply });
        return { reply, visual };
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
        return { reply: fallbackMsg, visual: null };
      }
    },
    [],
  );

  const reset = useCallback(() => {
    console.log("[useGemini] History state reset.");
    history.current = [];
  }, []);

  // Request a proactive morning briefing. The edge function gates this strictly
  // to morning hours (04:00–11:59 in the user's timezone) and returns
  // { isMorning: false } at any other time, so nothing is ever spoken off-hours.
  const morningBrief = useCallback(async (): Promise<{ isMorning: boolean; brief?: string }> => {
    const { storeSnapshot } = optionsRef.current;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    try {
      const { data, error } = await supabase.functions.invoke<{ isMorning?: boolean; brief?: string }>(
        "jarvis-brain",
        {
          body: {
            tool: "morning_brief",
            args: { storeSnapshot: storeSnapshot || null, timezone },
          },
        },
      );
      if (error || !data) return { isMorning: false };
      return { isMorning: !!data.isMorning, brief: data.brief };
    } catch (e) {
      console.error("[useGemini] Morning brief failed:", e);
      return { isMorning: false };
    }
  }, []);

  return { ask, reset, morningBrief };
}
