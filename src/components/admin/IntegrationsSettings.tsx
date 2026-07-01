import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

type IntegrationType = "printful" | "apliiq" | "zendrop" | "custom";

type SupplierIntegration = {
  id: string;
  name: string;
  type: IntegrationType;
  credentials: Record<string, string>;
  enabled: boolean;
  notes: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<IntegrationType, string> = {
  printful: "Printful",
  apliiq: "Apliiq",
  zendrop: "Zendrop",
  custom: "Custom",
};

// Which credential fields to show per vendor type — keeps the form sane
// instead of one giant generic JSON textarea.
const CREDENTIAL_FIELDS: Record<IntegrationType, { key: string; label: string }[]> = {
  printful: [{ key: "api_key", label: "API Key" }],
  apliiq: [
    { key: "app_id", label: "App ID" },
    { key: "secret", label: "Secret" },
  ],
  zendrop: [{ key: "api_key", label: "API Key" }],
  custom: [
    { key: "api_key", label: "API Key" },
    { key: "endpoint", label: "Endpoint URL" },
  ],
};

const emptyForm = {
  id: null as string | null,
  name: "",
  type: "custom" as IntegrationType,
  credentials: {} as Record<string, string>,
  enabled: true,
  notes: "",
};

export function IntegrationsSettings() {
  const [rows, setRows] = useState<SupplierIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any)
      .from("supplier_integrations")
      .select("id, name, type, credentials, enabled, notes, created_at")
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: SupplierIntegration) {
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      credentials: row.credentials ?? {},
      enabled: row.enabled,
      notes: row.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      credentials: form.credentials,
      enabled: form.enabled,
      notes: form.notes.trim() || null,
    };
    const { error: err } = form.id
      ? await (supabase as any).from("supplier_integrations").update(payload).eq("id", form.id)
      : await (supabase as any).from("supplier_integrations").insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDialogOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this integration? This does not affect orders already placed.")) return;
    const { error: err } = await (supabase as any).from("supplier_integrations").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    load();
  }

  async function toggleEnabled(row: SupplierIntegration) {
    const { error: err } = await (supabase as any)
      .from("supplier_integrations")
      .update({ enabled: !row.enabled })
      .eq("id", row.id);
    if (err) { setError(err.message); return; }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: !r.enabled } : r)));
  }

  const fields = CREDENTIAL_FIELDS[form.type];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Integrations</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage manufacturer & supplier connections — Printful, Apliiq, Zendrop, or add your own.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit integration" : "Add integration"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="int-name">Name</Label>
                <Input
                  id="int-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Printful — Main"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: IntegrationType) =>
                    setForm((f) => ({ ...f, type: v, credentials: {} }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as IntegrationType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`int-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`int-${f.key}`}
                    type={f.key.includes("secret") || f.key.includes("api_key") ? "password" : "text"}
                    value={form.credentials[f.key] ?? ""}
                    onChange={(e) =>
                      setForm((fm) => ({
                        ...fm,
                        credentials: { ...fm.credentials, [f.key]: e.target.value },
                      }))
                    }
                    autoComplete="off"
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="int-notes">Notes (optional)</Label>
                <Input
                  id="int-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label htmlFor="int-enabled">Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Disabled integrations are skipped by sync/fulfillment.
                  </p>
                </div>
                <Switch
                  id="int-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No integrations configured yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.name}
                    {row.notes && (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">{row.notes}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABEL[row.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleEnabled(row)}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Switch checked={row.enabled} onCheckedChange={() => toggleEnabled(row)} />
                      <span className={row.enabled ? "text-foreground" : "text-muted-foreground"}>
                        {row.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
