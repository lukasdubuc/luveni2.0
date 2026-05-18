import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listProducts,
  upsertProduct,
  deleteProduct,
  togglePublish,
  importProductFromUrl,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
});

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_urls: string[];
  source_url: string | null;
  fulfillment_notes: string | null;
  is_published: boolean;
};

const blank = {
  id: undefined as string | undefined,
  slug: "",
  title: "",
  description: "",
  price_cents: 0,
  currency: "usd",
  image_urls: [] as string[],
  source_url: "",
  fulfillment_notes: "",
  is_published: false,
};

function ProductsPage() {
  const qc = useQueryClient();
  const fetchProducts = useServerFn(listProducts);
  const save = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const toggle = useServerFn(togglePublish);
  const importFn = useServerFn(importProductFromUrl);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
  });

  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const saveMut = useMutation({
    mutationFn: (p: any) => save({ data: p }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; is_published: boolean }) =>
      toggle({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  async function runImport() {
    if (!importUrl) return;
    setImporting(true);
    try {
      const r = await importFn({ data: { url: importUrl } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setEditing({
        ...blank,
        ...r.prefill,
        description: r.prefill.description ?? "",
        fulfillment_notes: "",
        is_published: false,
        slug: r.prefill.title
          ? r.prefill.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)
          : "",
      });
      setImportUrl("");
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    saveMut.mutate({
      id: editing.id,
      slug: editing.slug,
      title: editing.title,
      description: editing.description || null,
      price_cents: Number(editing.price_cents) || 0,
      currency: editing.currency,
      image_urls: editing.image_urls.filter(Boolean),
      source_url: editing.source_url || null,
      fulfillment_notes: editing.fulfillment_notes || null,
      is_published: editing.is_published,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <button
          onClick={() => setEditing({ ...blank })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New product
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Import from URL</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a product page URL — we'll prefill the form. You can always edit before saving.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://example.com/product"
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            onClick={runImport}
            disabled={importing || !importUrl}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Prefill
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !products?.length ? (
          <p className="p-6 text-sm text-muted-foreground">No products yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: ProductRow) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: p.currency.toUpperCase(),
                    }).format(p.price_cents / 100)}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={p.is_published}
                        onChange={(e) =>
                          toggleMut.mutate({ id: p.id, is_published: e.target.checked })
                        }
                      />
                      {p.is_published ? "Live" : "Draft"}
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setEditing({
                            id: p.id,
                            slug: p.slug,
                            title: p.title,
                            description: p.description ?? "",
                            price_cents: p.price_cents,
                            currency: p.currency,
                            image_urls: p.image_urls ?? [],
                            source_url: p.source_url ?? "",
                            fulfillment_notes: p.fulfillment_notes ?? "",
                            is_published: p.is_published,
                          })
                        }
                        className="rounded p-2 hover:bg-muted"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${p.title}"?`)) delMut.mutate(p.id);
                        }}
                        className="rounded p-2 text-destructive hover:bg-muted"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">
              {editing.id ? "Edit product" : "New product"}
            </h2>
            <div className="mt-4 space-y-3">
              <Field label="Title">
                <input
                  required
                  maxLength={200}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Slug (URL)">
                <input
                  required
                  pattern="^[a-z0-9-]+$"
                  maxLength={120}
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  className="input"
                  placeholder="my-product"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (cents)">
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    value={editing.price_cents}
                    onChange={(e) =>
                      setEditing({ ...editing, price_cents: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Currency">
                  <input
                    maxLength={3}
                    value={editing.currency}
                    onChange={(e) =>
                      setEditing({ ...editing, currency: e.target.value.toLowerCase() })
                    }
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Image URLs (one per line)">
                <textarea
                  rows={2}
                  value={editing.image_urls.join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      image_urls: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="input"
                  placeholder="https://..."
                />
              </Field>
              <Field label="Source URL (optional)">
                <input
                  value={editing.source_url}
                  onChange={(e) => setEditing({ ...editing, source_url: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Fulfillment notes (private)">
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={editing.fulfillment_notes}
                  onChange={(e) =>
                    setEditing({ ...editing, fulfillment_notes: e.target.value })
                  }
                  className="input"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_published}
                  onChange={(e) =>
                    setEditing({ ...editing, is_published: e.target.checked })
                  }
                />
                Published (visible publicly)
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
            <style>{`.input{height:2.5rem;width:100%;border:1px solid hsl(var(--input));background:hsl(var(--background));border-radius:0.375rem;padding:0 0.75rem;font-size:0.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px hsl(var(--ring))}textarea.input{height:auto;padding:0.5rem 0.75rem}`}</style>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
