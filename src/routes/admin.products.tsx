import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/admin/products")({
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

  /* fetch */
  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts(data || []);
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

    const final = { ...payload, variants };
    const { error } = id
      ? await supabase.from("products").update(final).eq("id", id)
      : await supabase.from("products").insert([final]);

    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success(id ? "Product updated." : "Product created.");
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
    await supabase.from("products").update({ is_published: !p.is_published }).eq("id", p.id);
    window.dispatchEvent(new Event("productsUpdated"));
    fetchProducts();
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-black text-white font-mono text-sm">

      {/* ── Top bar ── */}
      <div className="border-b border-white flex items-center justify-between px-6 py-4">
        <span className="text-[11px] tracking-[0.3em] uppercase font-bold">
          Admin / Products
        </span>
        <button
          onClick={formOpen ? closeForm : openNew}
          className="flex items-center gap-2 border border-white px-4 py-2 text-[11px] tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
        >
          <Plus size={11} />
          {formOpen && !editing?.id ? "Cancel" : "New Product"}
        </button>
      </div>

      {/* ── Collapsible form ── */}
      <div
        className={`overflow-hidden transition-all duration-300 border-b border-white ${
          formOpen ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        <form onSubmit={saveProduct} className="px-6 py-6 bg-black">
          {/* Form header */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[11px] tracking-[0.3em] uppercase font-bold">
              {editing?.id ? "Edit Product" : "New Product"}
            </span>
            <button type="button" onClick={closeForm} className="text-white/40 hover:text-white">
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
              <label className="block text-[10px] tracking-[0.25em] uppercase text-white/40 mb-1">
                Description
              </label>
              <textarea
                value={editing?.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                placeholder="Short product description..."
                className="w-full border border-white bg-black px-3 py-2 text-[12px] font-mono placeholder:text-white/20 focus:outline-none focus:border-white resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.25em] uppercase text-white/40 mb-1">
                Variants JSON
              </label>
              <textarea
                value={editing?.variantsText ?? "[]"}
                onChange={(e) => setField("variantsText", e.target.value)}
                rows={4}
                placeholder='{"label":"Size","options":["S","M","L"]}'
                className="w-full border border-white bg-black px-3 py-2 text-[11px] font-mono placeholder:text-white/20 focus:outline-none focus:border-white resize-none"
              />
            </div>

            {/* Published toggle */}
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setField("is_published", !editing?.is_published)}
                className={`relative w-10 h-5 border transition-colors ${
                  editing?.is_published ? "bg-white border-white" : "bg-black border-white/30"
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-black border border-white/20 transition-all ${
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
              className="border border-white bg-white text-black px-6 py-2 text-[11px] tracking-widest uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saving ? "Saving..." : editing?.id ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-[11px] tracking-widest uppercase text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* ── Product table ── */}
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-12 text-[11px] tracking-widest uppercase text-white/30">
          <Loader2 size={12} className="animate-spin" /> Loading...
        </div>
      ) : products.length === 0 ? (
        <div className="px-6 py-12 text-[11px] tracking-widest uppercase text-white/25">
          No products yet.
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] border-b border-white px-6 py-2 bg-black">
            {["Title", "Price", "Discount", "Status", ""].map((h) => (
              <span key={h} className="text-[9px] tracking-[0.3em] uppercase text-white/30">{h}</span>
            ))}
          </div>

          {products.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] border-b border-white px-6 py-4 items-center gap-3 hover:bg-white/5 transition-colors"
            >
              {/* Title + slug */}
              <div className="min-w-0">
                <p className="text-[12px] font-bold tracking-wide truncate">{p.title}</p>
                <p className="text-[10px] text-white/30 tracking-widest mt-0.5 truncate">
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
                  ? "bg-white text-black"
                  : "border border-white/20 text-white/40"
              }`}>
                {p.is_published ? "Live" : "Draft"}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleStatus(p)}
                  className="text-white/25 hover:text-white transition-colors"
                  title={p.is_published ? "Unpublish" : "Publish"}
                >
                  {p.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="text-white/25 hover:text-white transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => deleteProduct(p.id, p.title)}
                  className="text-white/20 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
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
      <label className="block text-[10px] tracking-[0.25em] uppercase text-white/40 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-white bg-black px-3 py-2 text-[12px] font-mono placeholder:text-white/20 focus:outline-none focus:border-white"
      />
    </div>
  );
}
