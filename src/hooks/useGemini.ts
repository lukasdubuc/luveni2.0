// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import { JARVIS_SYSTEM_PROMPT } from '../lib/jarvis-config';
import { supabase } from '@/integrations/supabase/client';

// ─── API Keys ─────────────────────────────────────────────────
const MISTRAL_API_KEY = import.meta.env.MISTRAL_API_KEY || import.meta.env.VITE_MISTRAL_API_KEY || '';
const TAVILY_API_KEY  = import.meta.env.TAVILY_API_KEY  || import.meta.env.VITE_TAVILY_API_KEY  || '';

// ─── Types ────────────────────────────────────────────────────

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

// ─── Live Store Context Builder ───────────────────────────────

function buildLiveContext(snapshot: StoreSnapshot | null | undefined): string {
  if (!snapshot) return '';

  const fmt   = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines = [
    '--- LIVE STORE DATA (as of right now) ---',
    `Revenue today: ${fmt(snapshot.revenue_today_cents)}`,
    `Revenue this week: ${fmt(snapshot.revenue_week_cents)}`,
    `Revenue this month: ${fmt(snapshot.revenue_month_cents)}`,
    `Orders — paid: ${snapshot.orders_paid} | pending: ${snapshot.orders_pending} | failed: ${snapshot.orders_failed} | total: ${snapshot.orders_total}`,
    `Leads captured: ${snapshot.leads_total}`,
    `Products — published: ${snapshot.products_published} / ${snapshot.products_total} total`,
  ];

  if (snapshot.recent_orders.length > 0) {
    lines.push('Recent orders:');
    snapshot.recent_orders.slice(0, 5).forEach(o => {
      lines.push(`  • ${o.email} — ${fmt(o.amount_cents)} (${o.status}) on ${new Date(o.created_at).toLocaleDateString()}`);
    });
  }

  if (snapshot.top_products.length > 0) {
    lines.push('Top products by revenue:');
    snapshot.top_products.slice(0, 3).forEach(p => {
      lines.push(`  • ${p.title}: ${fmt(p.revenue)} across ${p.units} orders`);
    });
  }

  lines.push('--- END LIVE DATA ---');
  return lines.join('\n');
}

// ─── Tavily Web Search ────────────────────────────────────────

async function callTavily(query: string): Promise<string> {
  if (!TAVILY_API_KEY) return 'Error: TAVILY_API_KEY is not set.';

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:             TAVILY_API_KEY,
        query,
        search_depth:        'basic',
        include_answer:      true,
        include_raw_content: false,
        max_results:         5,
      })
    });

    if (!res.ok) throw new Error(`Tavily error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const lines: string[] = [];
    if (data.answer) lines.push(`Summary: ${data.answer}`);
    if (data.results?.length) {
      lines.push('Sources:');
      data.results.slice(0, 5).forEach((r: any) => {
        lines.push(`• ${r.title} (${r.url}): ${r.content?.slice(0, 300)}`);
      });
    }
    return lines.join('\n') || 'No results found.';
  } catch (e: any) {
    console.warn('[Jarvis] Tavily search failed:', e.message);
    return `Search error: ${e.message}`;
  }
}

// ─── Edge Function Tool Handler ───────────────────────────────

async function callEdgeTool(toolName: string, args: Record<string, any>, googleToken?: string | null): Promise<string> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const supabaseToken = sessionData.session?.access_token;
    const anonKey       = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (anonKey)       headers['apikey']        = anonKey;
    if (supabaseToken) headers['Authorization'] = `Bearer ${supabaseToken}`;

    const { data, error } = await supabase.functions.invoke('jarvis-google', {
      body: { tool: toolName, args, googleToken: googleToken || '' },
      headers,
    });

    if (error) throw error;
    if (data) {
      return typeof data === 'object' && 'results' in data ? data.results : String(data);
    }
  } catch (e: any) {
    console.warn(`[Jarvis] Edge tool "${toolName}" failed:`, e.message);
  }
  return `Error: Tool "${toolName}" failed to execute.`;
}

// ─── GitHub Tool Handler ──────────────────────────────────────

async function callGithubTool(toolName: string, args: Record<string, any>): Promise<string> {
  const githubToken =
    (typeof import.meta !== 'undefined' && (import.meta.env?.GITHUB_TOKEN || import.meta.env?.VITE_GITHUB_TOKEN)) ||
    (typeof process     !== 'undefined' && (process.env?.GITHUB_TOKEN    || process.env?.VITE_GITHUB_TOKEN))    ||
    '';

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    ...(githubToken && { 'Authorization'
