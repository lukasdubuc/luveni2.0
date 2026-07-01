import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

// Vendor secret groups, ordered by the connect sequence: Zendrop first,
// then TikTok Shop, then the rest. `secret` names must match the edge
// function's ALLOWED_SECRETS allowlist exactly.
type Field = { secret: string; label: string; optional?: boolean };
type Group = { title: string; blurb: string; fields: Field[] };

const GROUPS: Group[] = [
  {
    title: "Zendrop",
    blurb: "Dropship catalog import (Sync pulls the full gallery + variants into curation).",
    fields: [
      { secret: "ZENDROP_API_KEY", label: "API Key" },
      { secret: "ZENDROP_API_BASE", label: "API Base URL", optional: true },
    ],
  },
  {
    title: "TikTok Shop",
    blurb: "Publish target — curated products push here (≤9 images, primary per variant).",
    fields: [
      { secret: "TIKTOK_SHOP_TOKEN", label: "Access Token" },
      { secret: "TIKTOK_SHOP_ID", label: "Shop ID" },
    ],
  },
  {
    title: "Printful",
    blurb: "Print-on-demand catalog sync.",
    fields: [
      { secret: "PRINTFUL_API_KEY", label: "API Key" },
      { secret: "PRINTFUL_STORE_ID", label: "Store ID", optional: true },
    ],
  },
  {
    title: "Apliiq",
    blurb: "Print-on-demand catalog sync + fulfillment.",
    fields: [
      { secret: "APLIIQ_APP_ID", label: "App ID" },
      { secret: "APLIIQ_SHARED_SECRET", label: "Shared Secret" },
    ],
  },
  {
    title: "Etsy",
    blurb: "Optional publish target (≤10 images).",
    fields: [
      { secret: "ETSY_TOKEN", label: "Access Token", optional: true },
      { secret: "ETSY_SHOP_ID", label: "Shop ID", optional: true },
    ],
  },
];

// Fulfillment auto-submit flags — leave OFF until a test order per vendor
// confirms the payload shape against live responses.
const AUTO_FLAGS: { secret: string; label: string }[] = [
  { secret: "APLIIQ_AUTO", label: "Auto-submit Apliiq fulfillment" },
  { secret: "ZENDROP_AUTO", label: "Auto-submit Zendrop fulfillment" },
];

export function ConnectionSecrets() {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("manage-secrets", {
      body: { action: "list" },
    });
    setLoading(false);
    if (err) {
      // 503 bootstrap responses arrive as an error with a JSON body in context.
      const ctx = (err as any).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b?.needsBootstrap) { setNeedsBootstrap(true); return; }
          setError(b?.error || err.message);
          return;
        } catch { /* fall through */ }
      }
      setError(err.message || "Failed to load secret status");
      return;
    }
    if (data?.needsBootstrap) { setNeedsBootstrap(true); return; }
    if (data?.error) { setError(data.error); return; }
    setStatus(data?.secrets ?? {});
    setNeedsBootstrap(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveGroup(group: Group) {
    const payload: Record<string, string> = {};
    for (const f of group.fields) {
      const v = drafts[f.secret];
      if (typeof v === "string" && v.trim() !== "") payload[f.secret] = v.trim();
    }
    if (Object.keys(payload).length === 0) {
      toast.error("Nothing to save — enter at least one value.");
      return;
    }
    setSavingGroup(group.title);
    const { data, error: err } = await supabase.functions.invoke("manage-secrets", {
      body: { action: "set", secrets: payload },
    });
    setSavingGroup(null);
    if (err || data?.error) {
      toast.error(data?.error || err?.message || "Save failed");
      return;
    }
    toast.success(`${group.title} saved.`);
    // Clear the just-saved drafts (values are write-only) and refresh status.
    setDrafts((d) => {
      const next = { ...d };
      for (const k of Object.keys(payload)) delete next[k];
      return next;
    });
    load();
  }

  async function toggleFlag(secret: string, on: boolean) {
    const { data, error: err } = await supabase.functions.invoke("manage-secrets", {
      body: on
        ? { action: "set", secrets: { [secret]: "true" } }
        : { action: "delete", names: [secret] },
    });
    if (err || data?.error) {
      toast.error(data?.error || err?.message || "Update failed");
      return;
    }
    toast.success(`${secret} ${on ? "enabled" : "disabled"}.`);
    load();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Connection secrets</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Set vendor API keys directly. Values are written to Supabase Edge
            secrets — stored encrypted, never shown back, and read only by the
            sync/publish functions.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh status">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {needsBootstrap ? (
        <div className="mt-4 space-y-2 rounded-md bg-muted p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">One-time setup required</p>
          <p>
            To manage secrets from here, add this one secret in
            Supabase → Edge Functions → Secrets:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <code className="rounded bg-background px-1">LUVENI_MANAGEMENT_TOKEN</code>{" "}
              — a personal access token from{" "}
              <a
                href="https://supabase.com/dashboard/account/tokens"
                target="_blank" rel="noreferrer"
                className="underline"
              >
                supabase.com/dashboard/account/tokens
              </a>
            </li>
          </ul>
          <p>
            (The project ref is derived automatically. Custom secret names
            can't start with <code className="rounded bg-background px-1">SUPABASE_</code>,
            which is why the token uses the <code className="rounded bg-background px-1">LUVENI_</code> prefix.)
          </p>
          <p>Then refresh this panel.</p>
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-destructive">{error}</p>
      ) : (
        <div className="mt-4 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">{group.title}</h3>
                {group.fields.some((f) => !f.optional) && (
                  <Badge variant={group.fields.every((f) => f.optional || status[f.secret]) ? "secondary" : "outline"}>
                    {group.fields.every((f) => f.optional || status[f.secret]) ? "Connected" : "Incomplete"}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{group.blurb}</p>
              <div className="mt-3 space-y-3">
                {group.fields.map((f) => (
                  <div key={f.secret} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`sec-${f.secret}`} className="text-xs">
                        {f.label}
                        {f.optional && <span className="ml-1 text-muted-foreground">(optional)</span>}
                      </Label>
                      <span className={`text-[10px] ${status[f.secret] ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {status[f.secret] ? "● Set" : "○ Not set"}
                      </span>
                    </div>
                    <Input
                      id={`sec-${f.secret}`}
                      type="password"
                      autoComplete="off"
                      placeholder={status[f.secret] ? "•••••••• (leave blank to keep)" : "Enter value"}
                      value={drafts[f.secret] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [f.secret]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveGroup(group)}
                  disabled={savingGroup === group.title}
                >
                  {savingGroup === group.title ? "Saving…" : `Save ${group.title}`}
                </Button>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium">Fulfillment auto-submit</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep these off until a test order per vendor confirms the live
              payload shape. When off, orders are captured but not auto-sent.
            </p>
            <div className="mt-3 space-y-3">
              {AUTO_FLAGS.map((flag) => (
                <div key={flag.secret} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <Label className="text-xs">{flag.label}</Label>
                    <p className="text-[10px] text-muted-foreground">
                      <code>{flag.secret}</code>
                    </p>
                  </div>
                  <Switch
                    checked={!!status[flag.secret]}
                    onCheckedChange={(v) => toggleFlag(flag.secret, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
