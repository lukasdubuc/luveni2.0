import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout } from "@/lib/checkout.functions";
import { useCart } from "@/context/CartContext";

// --- Form Schema ---
const FormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email"),
  address: z.string().min(1, "Address is required"),
  apartment: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "Zip is required"),
  country: z.string().min(1, "Country is required"),
});

export const Route = createFileRoute("/checkout")({
  meta: () => [{ title: "Cart" }],
  loader: async ({ location }) => {
    const params = new URLSearchParams(location.searchStr ?? "");
    const productId = params.get("productId");
    const variantSku = params.get("variantSku");
    if (productId) {
      const { data: product } = await supabase.from("products").select("*").eq("id", productId).eq("is_published", true).maybeSingle();
      if (product) return { product, variantSku };
    }
    return { product: null, variantSku: null };
  },
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const submit = useServerFn(createCheckout);
  const { items, totalCents, updateItemQuantity, removeItem } = useCart();
  
  const [formData, setFormData] = useState({
    name: "", email: "", address: "", apartment: "", city: "", state: "", zip: "", country: "United States"
  });
  const [subscribe, setSubscribe] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "usdc" | "yzy">("card");
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Cart"; }, []);

  const isFormComplete = formData.name && formData.email && formData.address && formData.city && formData.state && formData.zip;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totalCents <= 0) { toast.error("Cart is empty"); return; }
    
    const parsed = FormSchema.safeParse(formData);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    
    setLoading(true);
    try {
      const res = await submit({
        data: { ...parsed.data, subscribe, paymentMethod, productId: items[0]?.productId, variantSku: items[0]?.variantSku },
      });
      if (!res?.ok) { toast.error(res?.error ?? "Checkout failed"); return; }
      if (res.redirectUrl) window.location.href = res.redirectUrl;
      else navigate({ to: "/thank-you", search: { order: res.orderId } });
    } catch { toast.error("Error processing"); } finally { setLoading(false); }
  }

  return (
    <section className="bg-background text-foreground min-h-screen py-12 px-4">
      <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16">
        
        {/* Left: Forms */}
        <form onSubmit={onSubmit} className="space-y-10">
          <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

          {/* Contact */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest">Contact</h2>
            <input placeholder="Full Name" className="w-full border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black dark:focus:border-white" onChange={e => setFormData({...formData, name: e.target.value})} />
            <input type="email" placeholder="Email Address" className="w-full border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black dark:focus:border-white" onChange={e => setFormData({...formData, email: e.target.value})} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={subscribe} onChange={() => setSubscribe(!subscribe)} />
              Subscribe to updates and notifications
            </label>
          </div>

          {/* Billing */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest">Billing Address</h2>
            <input placeholder="Address" className="w-full border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black" onChange={e => setFormData({...formData, address: e.target.value})} />
            <input placeholder="Apartment, Suite, Unit, etc. (Optional)" className="w-full border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black" onChange={e => setFormData({...formData, apartment: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="City" className="border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black" onChange={e => setFormData({...formData, city: e.target.value})} />
              <select className="border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black" onChange={e => setFormData({...formData, state: e.target.value})}>
                <option>SELECT STATE</option>
                {['Alabama', 'California', 'New York', 'Texas'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Zip / Postal Code" className="border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black" onChange={e => setFormData({...formData, zip: e.target.value})} />
              <select className="border-b border-black/20 dark:border-white/20 py-2 bg-transparent outline-none focus:border-black" onChange={e => setFormData({...formData, country: e.target.value})}>
                <option>United States</option>
              </select>
            </div>
          </div>

          {/* Payment */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest">Payment Details</h2>
            {!isFormComplete ? (
              <p className="text-xs text-muted-foreground p-4 bg-gray-100 dark:bg-white/5">PLEASE ENTER YOUR INFORMATION ABOVE TO SELECT A PAYMENT METHOD</p>
            ) : (
              <div className="space-y-2">
                {[ { id: 'card', label: 'Credit / Debit Card' }, { id: 'usdc', label: 'USDC (Crypto)' }, { id: 'yzy', label: 'YZY (Crypto)' } ].map((m) => (
                  <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id as any)} className={`w-full p-4 border flex justify-between items-center ${paymentMethod === m.id ? 'border-black dark:border-white' : 'border-transparent bg-gray-100 dark:bg-white/5'}`}>
                    {m.label} {paymentMethod === m.id && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
            <button type="submit" disabled={!isFormComplete || loading} className="w-full h-12 bg-foreground text-background font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : "Complete Purchase"}
            </button>
          </div>
        </form>

        {/* Right: Summary */}
        <aside className="border-l border-black/10 dark:border-white/10 pl-16">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-8">Order Summary</h2>
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p>${((item.price_cents * item.quantity) / 100).toFixed(0)}</p>
              </div>
            ))}
            <div className="border-t pt-4 font-bold flex justify-between">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(0)}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
