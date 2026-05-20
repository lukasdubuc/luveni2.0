import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, variantsText, ...payload } = editing;
    let variants = [];

    if (typeof variantsText === "string" && variantsText.trim()) {
      try {
        variants = JSON.parse(variantsText);
      } catch {
        toast.error("Invalid variant JSON");
        return;
      }
    }

    const payloadWithVariants = { ...payload, variants };
    const { error } = id 
      ? await supabase.from("products").update(payloadWithVariants).eq("id", id)
      : await supabase.from("products").insert([payloadWithVariants]);

    if (error) {
      toast.error("DATA_SYNC_FAILURE");
    } else {
      toast.success("VAULT_UPDATED");
      setEditing(null);
      fetchProducts();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("PERMANENT_ERASURE?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("PURGE_FAILED");
    else {
      toast.error("PRODUCT_REMOVED");
      fetchProducts();
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase.from("products").update({ is_published: !current }).eq("id", id);
    fetchProducts();
  };

  useEffect(() => { fetchProducts(); }, []);

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-8 font-sans text-black">
      <div className="max-w-7xl mx-auto flex justify-between items-end border-b border-black/10 pb-8 mb-12">
        <div>
          <h1 className="text-4xl font-light tracking-tighter uppercase italic leading-none">Inventory_Control</h1>
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.4em] opacity-30 mt-3">services2day // stock_unit</p>
        </div>
        <button 
          onClick={() => setEditing({
            title: "",
            description: "",
            price_cents: 0,
            currency: "usd",
            slug: "",
            source_url: "",
            fulfillment_provider: "",
            external_sku: "",
            bullet_points: [],
            variantsText: "[]",
            is_published: false,
          })}
          className="text-[10px] font-bold border border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-all"
        >
          Add_New_Item
        </button>
      </div>

      {loading ? (
        <div className="p-20 text-center animate-pulse font-mono text-[10px] tracking-widest uppercase">Syncing_Vault...</div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <div key={p.id} className="group border border-black/10 bg-white p-6 transition-all hover:shadow-md relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold uppercase tracking-tight text-lg">{p.title}</h3>
                  <p className="text-[9px] font-mono opacity-30 uppercase">/{p.slug}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    {p.fulfillment_provider || "No provider"}
                    {p.external_sku ? ` · SKU: ${p.external_sku}` : ""}
                  </p>
                </div>
                <span className={`text-[8px] font-bold px-2 py-1 uppercase border ${p.is_published ? 'bg-black text-white' : 'text-black/30 border-black/10'}`}>
                  {p.is_published ? 'Live' : 'Draft'}
                </span>
              </div>
<p className="text-sm text-muted-foreground mb-1">
                    {p.bullet_points?.length ? `${p.bullet_points.length} bullet points` : "No bullet points yet"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {p.variants?.length ? `${p.variants.length} variants available` : "No variants defined"}
                  </p>
                  <div className="text-3xl font-light italic mb-6 tracking-tighter">
                    ${(p.price_cents / 100).toFixed(2)}
                  </div>

              <div className="flex gap-4 border-t border-black/5 pt-4">
                <button onClick={() => setEditing({
                  ...p,
                  description: p.description ?? "",
                  source_url: p.source_url ?? "",
                  fulfillment_provider: p.fulfillment_provider ?? "",
                  external_sku: p.external_sku ?? "",
                  bullet_points: p.bullet_points ?? [],
                  variantsText: JSON.stringify(p.variants ?? [], null, 2),
                })} className="text-[10px] font-bold uppercase opacity-40 hover:opacity-100 flex items-center gap-1">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => toggleStatus(p.id, p.is_published)} className="text-[10px] font-bold uppercase opacity-40 hover:opacity-100 flex items-center gap-1">
                   {p.is_published ? <X size={12} /> : <Check size={12} />} {p.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => deleteProduct(p.id)} className="text-[10px] font-bold uppercase text-red-400/50 hover:text-red-600 flex items-center gap-1 ml-auto">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT MODAL - TECH INDUSTRIAL STYLE */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6">
          <form onSubmit={saveProduct} className="w-full max-w-xl bg-white border border-black p-10 shadow-2xl">
            <h2 className="text-2xl font-light italic uppercase tracking-tighter mb-8 border-b border-black/10 pb-4">Modify_Record</h2>
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Title</label>
                <input 
                  className="w-full border-b border-black outline-none py-2 font-bold uppercase text-sm" 
                  value={editing.title} 
                  onChange={e => setEditing({...editing, title: e.target.value})}
                  required 
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Price (Cents)</label>
                <input 
                  type="number" 
                  className="w-full border-b border-black outline-none py-2 font-mono font-bold" 
                  value={editing.price_cents} 
                  onChange={e => setEditing({...editing, price_cents: Number(e.target.value)})}
                  required 
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Slug</label>
                <input 
                  className="w-full border-b border-black outline-none py-2 text-sm italic" 
                  value={editing.slug} 
                  onChange={e => setEditing({...editing, slug: e.target.value})}
                  required 
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Description</label>
                <textarea
                  rows={4}
                  className="w-full border border-black/10 bg-white p-3 text-sm outline-none"
                  value={editing.description ?? ""}
                  onChange={e => setEditing({...editing, description: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Bullet Points</label>
                <textarea
                  rows={4}
                  className="w-full border border-black/10 bg-white p-3 text-sm outline-none"
                  value={Array.isArray(editing.bullet_points) ? editing.bullet_points.join("\n") : ""}
                  onChange={e => setEditing({
                    ...editing,
                    bullet_points: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Variants JSON</label>
                <textarea
                  rows={6}
                  className="w-full border border-black/10 bg-white p-3 text-sm outline-none font-mono"
                  value={editing.variantsText ?? "[]"}
                  onChange={e => setEditing({ ...editing, variantsText: e.target.value })}
                />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Provide a JSON array of variants, for example: <span className="font-mono">{"[{ \"sku\":\"black-s\",\"stock\":10,\"price_cents\":4900,\"attributes\":{\"color\":\"Black\",\"size\":\"S\"}}]"}</span>
                </p>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Fulfillment Provider</label>
                <input
                  className="w-full border-b border-black outline-none py-2 text-sm"
                  value={editing.fulfillment_provider ?? ""}
                  onChange={e => setEditing({...editing, fulfillment_provider: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">External SKU</label>
                <input
                  className="w-full border-b border-black outline-none py-2 text-sm"
                  value={editing.external_sku ?? ""}
                  onChange={e => setEditing({...editing, external_sku: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase opacity-40 block mb-2 tracking-widest">Source URL</label>
                <input 
                  className="w-full border-b border-black outline-none py-2 text-sm italic" 
                  value={editing.source_url ?? ""} 
                  onChange={e => setEditing({...editing, source_url: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="submit" className="flex-1 bg-black text-white py-4 font-bold uppercase text-[10px] tracking-widest hover:invert transition-all">Save_Record</button>
              <button type="button" onClick={() => setEditing(null)} className="px-8 border border-black py-4 font-bold uppercase text-[10px] tracking-widest hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
