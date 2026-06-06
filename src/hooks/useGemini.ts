// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StoreSnapshot {
  revenue_today_cents:  number;
  revenue_week_cents:   number;
  revenue_month_cents:  number;
  orders_total:         number;
  orders_paid:          number;
  orders_pending:       number;
  orders_failed:        number;
  leads_total:          number;
  products_published:   number;
  products_total:       number;
  recent_orders: { email: string; amount_cents: number; status: string; created_at: string }[];
  top_products:  { title: string; revenue: number; units: number }[];
}

interface UseGeminiOptions {
  googleToken?:   string | null;
  storeSnapshot?: StoreSnapshot | null;
}

export function useGemini(apiKey?: string, options: UseGeminiOptions = {}) {
  const history    = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;

      // Add user message to history
      history.current.push({ role: 'user', content: userText });

      try {
        const { data, error } = await supabase.functions.invoke('jarvis-google', {
          body: {
            tool:          'chat',
            args: {
              userText,
              history:       history.current.slice(0, -1), // all but latest
              storeSnapshot: storeSnapshot || null,
              googleToken:   googleToken   || null,
            }
          }
        });

        if (error) throw error;

        const reply = data?.reply || 'No response received.';
        history.current.push({ role: 'assistant', content: reply });
        onChunk?.(reply);
        return reply;

      } catch (e: any) {
        console.error('[Jarvis] Edge function error:', e.message);
        throw e;
      }
    },
    []
  );

  const reset = useCallback(() => { history.current = []; }, []);

  return { ask, reset };
}
