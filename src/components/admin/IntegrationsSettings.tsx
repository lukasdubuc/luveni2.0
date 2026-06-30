// ─────────────────────────────────────────────────────────────
//  Luveni — Admin → Settings → Integrations
//  Add and manage manufacturers / suppliers: enable/disable, see status,
//  trigger each supplier's catalog sync, and register new custom suppliers.
//  API keys live in Supabase Edge secrets (shown as reminders here, never
//  stored in the DB).
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Supplier {
  id: string;
  slug: string;
  name: string;
  kind: "print_on_demand" | "dropship" | "other";
  enabled: boolean;
  sync_function: string | null;
  api_base: string | null;
  required_secrets: string[];
  notes: string | null;
  status: "unconfigured" | "connected" | "error" | "disabled";
  last_synced_at: string | null;
}

const KIND_LABEL: Record<Supplier["kind"], string> = {
  print_on_demand: "Print-on-demand",
  dropship: "Dropship",
  other: "Other",
};

const STATUS_STYLE: Record<Supplier["status"], string> = {
  connected: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
  unconfigured: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  disabled: "bg-muted text-muted-foreground",
};

export function IntegrationsSettings() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("supplier_integrations")
      .select("id, slug, name, kind, enabled, sync_function, api_base, required_secrets, notes, status, last_synced_at")
      .order("created_at", { ascending: true });
    if (!error) setRows((data ?? []) as Supplier[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (s: Supplier) => {
    const enabled = !s.enabled;
    setRows((r) => r.map((x) => (x.id === s.id ? { ...x, enabled } : x)));
    await (supabase as any).from("supplier_integrations")
      .update({ enabled, status: enabled ? "connected" : "disabled" }).eq("id", s.id);
  };

  const syncNow = async (s: Supplier) => {
    if (!s.sync_function) { setMsg(`${s.name} has no sync function configured.`); return; }
    setBusy(s.id); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke(s.sync_function, { body: {} });
      if (error) throw error;
      const synced = (data as any)?.synced ?? 0;
      const errs = (data as any)?.errors?.length ?? 0;
      await (supabase as any).from("supplier_integrations")
        .update({ last_synced_at: new Date().toISOString(), status: errs ? "error" : "connected", last_result: data })
        .eq("id", s.id);
      setMsg(`${s.name}: synced ${synced} product(s)${errs ? `, ${errs} error(s)` : ""}.`);
      load();
    } catch (e: any) {
      setMsg(`${s.name} sync failed: ${e.message || e}`);
      await (supabase as any).from("supplier_integrations").update({ status: "error" }).eq("id", s.id);
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Integrations — Manufacturers &amp; Suppliers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enable a supplier, sync its catalog into the curation buffer, or add a new one.
            API keys are set as Supabase Edge secrets (shown per supplier below).
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          {adding ? "Cancel" : "+ Add supplier"}
        </button>
      </div>

      {msg && <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs">{msg}</p>}

      {adding && <AddSupplierForm onAdded={() => { setAdding(false); load(); }} />}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No suppliers yet.</p>
        ) : rows.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {KIND_LABEL[s.kind]}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLE[s.status]}`}>
                  {s.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => syncNow(s)} disabled={busy === s.id || !s.enabled}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  title={s.enabled ? "Run catalog sync" : "Enable first"}>
                  {busy === s.id ? "Syncing…" : "Sync now"}
                </button>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} className="accent-[#007aff]" />
                  {s.enabled ? "Enabled" : "Disabled"}
                </label>
              </div>
            </div>
            {s.notes && <p className="mt-2 text-xs text-muted-foreground">{s.notes}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {s.api_base && <span>API: <code className="rounded bg-muted px-1">{s.api_base}</code></span>}
              {s.last_synced_at && <span>Last sync: {new Date(s.last_synced_at).toLocaleString()}</span>}
            </div>
            {s.required_secrets?.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Required Edge secrets:{" "}
                {s.required_secrets.map((k) => <code key={k} className="mr-1 rounded bg-muted px-1">{k}</code>)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddSupplierForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Supplier["kind"]>("print_on_demand");
  const [apiBase, setApiBase] = useState("");
  const [syncFn, setSyncFn] = useState("");
  const [secrets, setSecrets] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const save = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr(null);
    const { error } = await (supabase as any).from("supplier_integrations").insert({
      slug: slugify(name),
      name: name.trim(),
      kind,
      api_base: apiBase.trim() || null,
      sync_function: syncFn.trim() || null,
      required_secrets: secrets.split(",").map((s) => s.trim()).filter(Boolean),
      notes: notes.trim() || null,
      enabled: false,
      status: "unconfigured",
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onAdded();
  };

  const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-dashed border-border p-4">
      <input className={field} placeholder="Supplier name (e.g. Gooten)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value as Supplier["kind"])}>
          <option value="print_on_demand">Print-on-demand</option>
          <option value="dropship">Dropship</option>
          <option value="other">Other</option>
        </select>
        <input className={field} placeholder="Sync edge function (optional)" value={syncFn} onChange={(e) => setSyncFn(e.target.value)} />
      </div>
      <input className={field} placeholder="API base URL (optional)" value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
      <input className={field} placeholder="Required secrets, comma-separated (e.g. GOOTEN_API_KEY)" value={secrets} onChange={(e) => setSecrets(e.target.value)} />
      <textarea className={field} placeholder="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {err && <p className="text-xs text-red-500">{err}</p>}
      <button onClick={save} disabled={saving}
        className="rounded-md bg-[#007aff] px-4 py-2 text-xs font-semibold text-white hover:bg-[#005bb5] disabled:opacity-50">
        {saving ? "Saving…" : "Add supplier"}
      </button>
    </div>
  );
}
