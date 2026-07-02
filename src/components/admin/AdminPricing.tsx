import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// Retail pricing calculator backed by the pricing-engine edge function
// (parameters in the pricing_rules table). Quote any vendor cost → retail
// with the fee/profit breakdown, or reprice + publish the whole catalog.

type Quote = {
  retail_cents: number;
  fees_cents: number;
  profit_cents: number;
  margin: number;
  rule: string;
  category: string;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function AdminPricing({ isDark }: { isDark: boolean }) {
  const [cost, setCost] = useState("");
  const [title, setTitle] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"quote" | "reprice" | null>(null);

  async function getQuote() {
    const costCents = Math.round(parseFloat(cost) * 100);
    if (!costCents || costCents <= 0) { toast.error("Enter the vendor cost first."); return; }
    setBusy("quote");
    const { data, error } = await supabase.functions.invoke("pricing-engine", {
      body: { action: "quote", cost_cents: costCents, title },
    });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Quote failed"); return; }
    setQuote(data as Quote);
  }

  async function repriceAll() {
    setBusy("reprice");
    const { data, error } = await supabase.functions.invoke("pricing-engine", {
      body: { action: "reprice", publish: true },
    });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Reprice failed"); return; }
    toast.success(`Repriced ${data?.repriced ?? 0}/${data?.total ?? 0} product(s) from vendor cost.`);
  }

  const cardCls = `p-5 border rounded-[24px] overflow-hidden transition-all duration-300 space-y-4 ${
    isDark ? "bg-neutral-955/30 border-neutral-900" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"
  }`;
  const inputCls = `w-full bg-transparent border rounded-[9999px] px-4 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 ${
    isDark ? "border-neutral-850 text-white placeholder-neutral-700 focus:border-white focus:ring-white/25" : "border-[#D1D1D6] text-black placeholder-neutral-350 focus:border-black focus:ring-black/10 bg-white shadow-sm"
  }`;
  const solidBtn = `text-[9px] font-mono font-bold uppercase px-4 py-1.5 rounded-[9999px] transition-all disabled:opacity-30 ${
    isDark ? "bg-white text-black hover:bg-neutral-202" : "bg-black text-white hover:bg-neutral-800 shadow-sm"
  }`;
  const dimTxt = isDark ? "text-neutral-500" : "text-neutral-455";

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Pricing Calculator</span>
        <button
          onClick={repriceAll}
          disabled={busy === "reprice"}
          title="Recompute retail for every product from its stored vendor cost and publish"
          className={`flex items-center gap-1.5 text-[8px] font-mono font-bold uppercase px-3 py-1 rounded-[9999px] border transition-all disabled:opacity-40 ${
            isDark ? "border-neutral-800 text-neutral-300 hover:bg-white/[0.05]" : "border-[#D1D1D6] text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          <RefreshCw size={9} className={busy === "reprice" ? "animate-spin" : ""} /> Reprice Catalog
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input inputMode="decimal" placeholder="Vendor cost (e.g. 9.12)" value={cost}
          onChange={(e) => setCost(e.target.value)} className={inputCls} />
        <input placeholder="Title (for category match)" value={title}
          onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        <button onClick={getQuote} disabled={busy === "quote"} className={solidBtn}>
          {busy === "quote" ? "…" : "Quote"}
        </button>
      </div>

      {quote && (
        <div className={`text-[10px] font-mono flex flex-wrap gap-x-5 gap-y-1 ${dimTxt}`}>
          <span className={isDark ? "text-white" : "text-black"}>Retail {money(quote.retail_cents)}</span>
          <span>Profit {money(quote.profit_cents)} after fees</span>
          <span>Fees {money(quote.fees_cents)}</span>
          <span>Margin {(quote.margin * 100).toFixed(0)}%</span>
          <span>Rule: {quote.category ?? quote.rule}</span>
        </div>
      )}
      <p className={`text-[9px] font-mono ${dimTxt}`}>
        retail = max((cost + shipping + min profit) ÷ (1 − fees), cost ÷ (1 − target margin)), rounded to .99.
        Tune parameters in the pricing_rules table.
      </p>
    </div>
  );
}
