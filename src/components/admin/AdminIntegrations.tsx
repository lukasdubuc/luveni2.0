import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// Compact vendor integrations panel, styled to match the admin dashboard's
// inline settings (mono / rounded / dark-aware). Sets vendor API keys as
// Supabase Edge secrets via the manage-secrets function and triggers each
// vendor's catalog sync. Ordered Zendrop → Apliiq → Printful → TikTok Shop.

type Field = { secret: string; label: string };
type Vendor = {
  key: string;
  name: string;
  fields: Field[];
  syncFn: string | null; // catalog sync edge function, if any
};

const VENDORS: Vendor[] = [
  { key: "cj", name: "CJ Dropshipping", syncFn: "cj-inventory-sync", fields: [
    { secret: "CJ_EMAIL", label: "Account Email" },
    { secret: "CJ_API_KEY", label: "API Key" },
  ] },
  { key: "zendrop", name: "Zendrop", syncFn: "zendrop-sync", fields: [
    { secret: "ZENDROP_API_KEY", label: "API Key" },
  ] },
  { key: "apliiq", name: "Apliiq", syncFn: "apliiq-sync", fields: [
    { secret: "APLIIQ_APP_ID", label: "App ID" },
    { secret: "APLIIQ_SHARED_SECRET", label: "Shared Secret" },
  ] },
  { key: "printful", name: "Printful", syncFn: "printful-sync", fields: [
    { secret: "PRINTFUL_API_KEY", label: "API Key" },
  ] },
  { key: "tiktok", name: "TikTok Shop", syncFn: null, fields: [
    { secret: "TIKTOK_SHOP_TOKEN", label: "Access Token" },
    { secret: "TIKTOK_SHOP_ID", label: "Shop ID" },
  ] },
];

export function AdminIntegrations({ isDark }: { isDark: boolean }) {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("manage-secrets", { body: { action: "list" } });
    if (error) {
      const ctx = (error as any).context;
      if (ctx?.json) { try { const b = await ctx.json(); if (b?.needsBootstrap) setNeedsBootstrap(true); } catch { /* ignore */ } }
      return; // Leave status null → render neutrally, never a false "not set".
    }
    if (data?.needsBootstrap) { setNeedsBootstrap(true); return; }
    if (data?.secrets) { setStatus(data.secrets); setNeedsBootstrap(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveVendor(v: Vendor) {
    const payload: Record<string, string> = {};
    for (const f of v.fields) {
      const val = drafts[f.secret];
      if (typeof val === "string" && val.trim() !== "") payload[f.secret] = val.trim();
    }
    if (!Object.keys(payload).length) { toast.error("Enter a value first."); return; }
    setSavingKey(v.key);
    const { data, error } = await supabase.functions.invoke("manage-secrets", { body: { action: "set", secrets: payload } });
    setSavingKey(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Save failed"); return; }
    toast.success(`${v.name} key saved.`);
    setDrafts((d) => { const n = { ...d }; for (const k of Object.keys(payload)) delete n[k]; return n; });
    load();
  }

  async function sync(v: Vendor) {
    if (!v.syncFn) return;
    setSyncingKey(v.key);
    const { data, error } = await supabase.functions.invoke(v.syncFn, { body: {} });
    setSyncingKey(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || `${v.name} sync failed`); return; }
    // Catalog syncs report synced/total; the CJ inventory sync reports stock counts.
    const msg = typeof data?.variants_checked === "number"
      ? `${v.name}: checked ${data.variants_checked} variant(s), updated ${data.products_updated ?? 0} product(s).`
      : `${v.name}: synced ${data?.synced ?? 0}/${data?.total ?? 0} product(s).`;
    toast.success(msg);
  }

  const cardCls = `p-5 border rounded-[24px] overflow-hidden transition-all duration-300 space-y-5 ${
    isDark ? "bg-neutral-955/30 border-neutral-900" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"
  }`;
  const inputCls = `w-full bg-transparent border rounded-[9999px] px-4 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 ${
    isDark ? "border-neutral-850 text-white placeholder-neutral-700 focus:border-white focus:ring-white/25" : "border-[#D1D1D6] text-black placeholder-neutral-350 focus:border-black focus:ring-black/10 bg-white shadow-sm"
  }`;
  const solidBtn = `text-[9px] font-mono font-bold uppercase px-4 py-1.5 rounded-[9999px] transition-all disabled:opacity-30 ${
    isDark ? "bg-white text-black hover:bg-neutral-202" : "bg-black text-white hover:bg-neutral-800 shadow-sm"
  }`;

  // A vendor is "connected" only when every field is confirmed set. When
  // status is unknown (null / no management token) we show nothing loud.
  const vendorConnected = (v: Vendor) => status ? v.fields.every((f) => status[f.secret]) : null;

  return (
    <div className={cardCls}>
      {needsBootstrap && (
        <p className={`text-[9px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>
          Add <code className={`px-1 rounded ${isDark ? "bg-white/10" : "bg-black/5"}`}>LUVENI_MANAGEMENT_TOKEN</code> in
          Supabase → Edge Functions → Secrets to show live connection status. Keys can still be saved below.
        </p>
      )}

      {VENDORS.map((v, i) => {
        const connected = vendorConnected(v);
        return (
          <div key={v.key} className={i > 0 ? `pt-5 border-t ${isDark ? "border-neutral-900" : "border-[#F2F2F7]"}` : ""}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">{v.name}</span>
                {connected === true && (
                  <span className="flex items-center gap-1 text-[8px] font-mono uppercase text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                  </span>
                )}
              </div>
              {v.syncFn && (
                <button
                  onClick={() => sync(v)}
                  disabled={syncingKey === v.key}
                  title="Sync catalog now"
                  className={`flex items-center gap-1.5 text-[8px] font-mono font-bold uppercase px-3 py-1 rounded-[9999px] border transition-all disabled:opacity-40 ${
                    isDark ? "border-neutral-800 text-neutral-300 hover:bg-white/[0.05]" : "border-[#D1D1D6] text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <RefreshCw size={9} className={syncingKey === v.key ? "animate-spin" : ""} /> Sync
                </button>
              )}
            </div>

            <div className="mt-2.5 space-y-2">
              {v.fields.map((f) => (
                <div key={f.secret} className="flex items-center gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={`${f.label}${status?.[f.secret] ? " — set (blank keeps it)" : ""}`}
                    value={drafts[f.secret] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [f.secret]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <button onClick={() => saveVendor(v)} disabled={savingKey === v.key} className={solidBtn}>
                  {savingKey === v.key ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
