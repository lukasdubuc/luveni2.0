import { useRef, useCallback, useEffect } from "react";

interface StoreSnapshot {
  revenue_today_cents: number; revenue_week_cents: number; revenue_month_cents: number;
  orders_total: number; orders_paid: number; orders_pending: number; orders_failed: number;
  leads_total: number; products_published: number; products_total: number;
  recent_orders: { email: string; amount_cents: number; status: string; created_at: string }[];
  top_products: { title: string; revenue: number; units: number }[];
}
interface UseGeminiOptions { googleToken?: string | null; storeSnapshot?: StoreSnapshot | null; }

const CHAT_URL = "https://unitqfuetxedmmrvlocu.supabase.co/functions/v1/jarvis-chat";
const CHAT_ANON = "sb_publishable_0jMwlf-VJWjWFjpA1Iz2dA_Lq8EIumc";

export function useGemini(options: UseGeminiOptions = {}) {
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Start every fresh page load with a clean slate (no cached hallucinations).
  useEffect(() => { history.current = []; }, []);

  const ask = useCallback(async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
    const { storeSnapshot } = optionsRef.current;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    history.current.push({ role: "user", content: userText });

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: CHAT_ANON, Authorization: `Bearer ${CHAT_ANON}` },
        body: JSON.stringify({ tool: "chat", args: { userText, history: history.current.slice(0, -1), storeSnapshot: storeSnapshot || null, timezone } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.reply) throw new Error(data?.error || `chat ${response.status}`);

      const reply = data.reply as string;
      history.current.push({ role: "assistant", content: reply });
      onChunk?.(reply);
      return reply;
    } catch (e) {
      if (history.current.length > 0) history.current.pop();
      console.error("[useGemini] failed:", e instanceof Error ? e.message : String(e));
      const fallbackMsg = "I apologize, sir — a temporary connection issue. Could you repeat that?";
      onChunk?.(fallbackMsg);
      return fallbackMsg;
    }
  }, []);

  const reset = useCallback(() => { history.current = []; }, []);
  return { ask, reset };
}
