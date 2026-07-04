import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2, Eye, EyeOff, ChevronUp, Images } from "lucide-react";
import { requireAdmin } from "@/lib/admin-guard";
import { CjTransparencyPanel } from "@/components/admin/CjTransparencyPanel";
import { ProductMediaCurator } from "@/components/admin/ProductMediaCurator";
import { processProductImages } from "@/lib/transparency-processing";

/**
 * Fire-and-forget transparent-PNG treatment for a product the admin just
 * published/added. Runs in the browser, treats EVERY image, and MUST NEVER
 * block or crash the publish action — all failures are swallowed. The
 * CjTransparencyPanel auto-sweep remains a backstop for anything missed here
 * (e.g. webhook-imported products with no browser context).
 */
function autoTreatOnPublish(product: {
  id: string;
  title?: string;
  image_urls?: string[] | null;
  variants?: any[] | null;
  source?: string | null;
}) {
  void (async () => {
    try {
      const summary = await processProductImages({
        id: product.id,
        title: product.title,
        image_urls: Array.isArray(product.image_urls) ? product.image_urls : [],
        variants: product.variants ?? [],
        source: product.source ?? null,
      });
      if (summary.processed > 0) {
        toast.success(
          `Cleaned ${summary.processed} image${summary.processed === 1 ? "" : "s"} for "${product.title ?? "product"}".` +
            (summary.bad ? ` ${summary.bad} flagged low-quality.` : ""),
        );
        window.dispatchEvent(new Event("productsUpdated"));
      }
    } catch {
      /* background-removal is best-effort; never breaks publishing */
    }
  })();
}

export const Route = createFileRoute("/admin/products")({
  beforeLoad: requireAdmin,
  component: ProductsPage,
});

/* ─── Types ─────────────────────────────────────────────── */
type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  discounted_price_cents?: number | null;
  image_urls: string[];
  description?: string | null;
  variants?: any[];
  is_published: boolean;
  source?: string | null;
  created_at?: string;
};

type EditState = Partial<Product> & { variantsText?: string };

const EMPTY: EditState = {
  title: "",
  slug: "",
  price_cents: 0,
  discounted_price_cents: null,
  image_urls: [],
  description: "",
  variantsText: "[]",
  is_published: false,
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ─── Page ───────────────────────────────────────────────── */
function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [curatingId, setCuratingId] = useState<string | null>(null);

  /* fetch */
  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  /* open form helpers */
  function openNew() {
    setEditing({ ...EMPTY });
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing({
      ...p,
      variantsText: p.variants ? JSON.stringify(p.variants, null, 2) : "[]",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setFormOpen(false);
  }

  function setField<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === "title" && !prev.id) next.slug = slugify(String(value));
      return next;
    });
  }

  /* save */
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);

    const { id, variantsText, ...payload } = editing;
    let variants: any[] = [];
    if (typeof variantsText === "string" && variantsText.trim()) {
      try { variants = JSON.parse(variantsText); }
      catch { toast.error("Invalid variant JSON"); setSaving(false); return; }
    }

    const final = { ...payload, variants } as any;
    const { data: savedRows, error } = id
      ? await supabase.from("products").update(final).eq("id", id).select().limit(1)
      : await supabase.from("products").insert([final]).select().limit(1);

    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success(id ? "Product updated." : "Product created.");
      // Treat images immediately on publish (all images, non-blocking).
      const saved = (savedRows?.[0] ?? null) as Product | null;
      if (saved && saved.is_published) {
        autoTreatOnPublish({
          id: saved.id,
          title: saved.title,
          image_urls: saved.image_urls,
          variants: saved.variants ?? variants,
          source: saved.source ?? null,
        });
      }
      closeForm();
      window.dispatchEvent(new Event("productsUpdated"));
      fetchProducts();
    }
    setSaving(false);
  };

  /* delete */
  const deleteProduct = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Delete failed: " + error.message);
    else {
      toast.success("Product removed.");
      window.dispatchEvent(new Event("productsUpdated"));
      fetchProducts();
    }
  };

  /* toggle publish */
  const toggleStatus = async (p: Product) => {
    const nowPublished = !p.is_published;
    await supabase.from("products").update({ is_published: nowPublished }).eq("id", p.id);
    // Publishing from the list → treat every image immediately (non-blocking).
    if (nowPublished) {
      autoTreatOnPublish({
        id: p.id,
        title: p.title,
        image_urls: p.image_urls,
        variants: p.variants ?? [],
        source: p.source ?? null,
      });
    }
    window.dispatchEvent(new Event("productsUpdated"));
    fetchProducts();
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-white text-black font-mono text-sm">

      {/* ── Top bar ── */}
      <div className="border-b border-black flex items-center justify-between px-6 py-4">
        <span className="text-[11px] tracking-[0.3em] uppercase font-bold">
          Admin / Products
        </span>
        <button
          onClick={formOpen ? closeForm : openNew}
          className="flex items-center gap-2 border border-black px-4 py-2 text-[11px] tracking-widest uppercase hover:bg-black hover:text-white transition-colors"
        >
          <Plus size={11} />
          {formOpen && !editing?.id ? "Cancel" : "New Product"}
        </button>
      </div>

      {/* ── Collapsible form ── */}
      <div
        className={`overflow-hidden transition-all duration-300 border-b border-black ${
          formOpen ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        <form onSubmit={saveProduct} className="px-6 py-6 bg-[#f7f7f7]">
          {/* Form header */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[11px] tracking-[0.3em] uppercase font-bold">
              {editing?.id ? "Edit Product" : "New Product"}
            </span>
            <button type="button" onClick={closeForm} className="text-black/40 hover:text-black">
              <ChevronUp size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title"
              value={editing?.title ?? ""}
              onChange={(v) => setField("title", v)}
              placeholder="Product name" />

            <Field label="Slug"
              value={editing?.slug ?? ""}
              onChange={(v) => setField("slug", v)}
              placeholder="auto-generated" />

            <Field label="Price (cents)"
              type="number"
              value={String(editing?.price_cents ?? 0)}
              onChange={(v) => setField("price_cents", parseInt(v) || 0)}
              placeholder="4900 = $49" />

            <Field label="Discounted Price (cents) — optional"
              type="number"
              value={editing?.discounted_price_cents != null ? String(editing.discounted_price_cents) : ""}
              onChange={(v) => setField("discounted_price_cents", v === "" ? null : parseInt(v) || null)}
              placeholder="Leave blank for no discount" />

            <Field label="Image URL (first image)"
              value={Array.isArray(editing?.image_urls) ? (editing!.image_urls[0] ?? "") : ""}
              onChange={(v) =>
                setField("image_urls", v.trim() ? [v.trim()] : [])
              }
              placeholder="https://..."
              className="md:col-span-2" />

            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.25em] uppercase text-black/40 mb-1">
                Description
              </label>
              <textarea
                value={editing?.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                placeholder="Short product description..."
                className="w-full border border-black/20 bg-white px-3 py-2 text-[12px] font-mono placeholder:text-black/20 focus:outline-none focus:border-black resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.25em] uppercase text-black/40 mb-1">
                Variants JSON
              </label>
              <textarea
                value={editing?.variantsText ?? "[]"}
                onChange={(e) => setField("variantsText", e.target.value)}
                rows={4}
                placeholder='[{"label":"Size","options":["S","M","L"]}]'
                className="w-full border border-black/20 bg-white px-3 py-2 text-[11px] font-mono placeholder:text-black/20 focus:outline-none focus:border-black resize-none"
              />
            </div>

            {/* Published toggle */}
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setField("is_published", !editing?.is_published)}
                className={`relative w-10 h-5 border transition-colors ${
                  editing?.is_published ? "bg-black border-black" : "bg-white border-black/30"
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white border border-black/20 transition-all ${
                  editing?.is_published ? "left-5" : "left-0.5"
                }`} />
              </button>
              <span className="text-[11px] tracking-widest uppercase">
                {editing?.is_published ? "Published" : "Draft"}
              </span>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="border border-black bg-black text-white px-6 py-2 text-[11px] tracking-widest uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saving ? "Saving..." : editing?.id ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-[11px] tracking-widest uppercase text-black/40 hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* ── CJ transparency tool (only renders when CJ products exist) ── */}
      {!loading && (
        <CjTransparencyPanel
          products={products.map((p) => ({
            id: p.id,
            title: p.title,
            image_urls: p.image_urls ?? [],
            variants: p.variants ?? [],
            source: p.source ?? null,
          }))}
          onUpdated={fetchProducts}
        />
      )}

      {/* ── Product table ── */}
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-12 text-[11px] tracking-widest uppercase text-black/30">
          <Loader2 size={12} className="animate-spin" /> Loading...
        </div>
      ) : products.length === 0 ? (
        <div className="px-6 py-12 text-[11px] tracking-widest uppercase text-black/25">
          No products yet.
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] border-b border-black/10 px-6 py-2 bg-[#fafafa]">
            {["Title", "Price", "Discount", "Status", ""].map((h) => (
              <span key={h} className="text-[9px] tracking-[0.3em] uppercase text-black/30">{h}</span>
            ))}
          </div>

          {products.map((p) => (
            <div key={p.id} className="border-b border-black/10">
            <div
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] px-6 py-4 items-center gap-3 hover:bg-black/[0.015] transition-colors"
            >
              {/* Title + slug */}
              <div className="min-w-0">
                <p className="text-[12px] font-bold tracking-wide truncate">{p.title}</p>
                <p className="text-[10px] text-black/30 tracking-widest mt-0.5 truncate">
                  /{p.slug}
                </p>
              </div>

              {/* Price */}
              <span className="text-[12px] tracking-wider">
                ${(p.price_cents / 100).toFixed(2)}
              </span>

              {/* Discounted price */}
              <span className="text-[12px] tracking-wider">
                {p.discounted_price_cents != null ? (
                  <>${(p.discounted_price_cents / 100).toFixed(2)}</>
                ) : (
                  <span className="text-black/20">—</span>
                )}
              </span>

              {/* Status badge */}
              <span className={`text-[9px] tracking-[0.2em] uppercase px-2 py-1 w-fit font-bold ${
                p.is_published
                  ? "bg-black text-white"
                  : "border border-black/20 text-black/40"
              }`}>
                {p.is_published ? "Live" : "Draft"}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCuratingId((cur) => (cur === p.id ? null : p.id))}
                  className={`transition-colors ${curatingId === p.id ? "text-black" : "text-black/25 hover:text-black"}`}
                  title="Curate photos"
                >
                  <Images size={13} />
                </button>
                <button
                  onClick={() => toggleStatus(p)}
                  className="text-black/25 hover:text-black transition-colors"
                  title={p.is_published ? "Unpublish" : "Publish"}
                >
                  {p.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="text-black/25 hover:text-black transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => deleteProduct(p.id, p.title)}
                  className="text-black/20 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Expandable photo curator */}
            {curatingId === p.id && (
              <div className="border-t border-black/10 bg-[#fafafa] px-6 pb-4">
                <ProductMediaCurator productId={p.id} onChanged={fetchProducts} />
              </div>
            )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ─── Reusable Field ─────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder, type = "text", className = "",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] tracking-[0.25em] uppercase text-black/40 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-black/20 bg-white px-3 py-2 text-[12px] font-mono placeholder:text-black/20 focus:outline-none focus:border-black"
      />
    </div>
  );
}
