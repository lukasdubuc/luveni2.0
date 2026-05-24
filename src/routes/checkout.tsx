import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout } from "@/lib/checkout.functions";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/checkout")({
  meta: () => [{ title: "Cart" }],
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const submit = useServerFn(createCheckout);
  const { items, totalCents, updateItemQuantity, removeItem } = useCart();
  
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", address: "", apt: "", 
    city: "", state: "", zip: "", country: "United States", phone: ""
  });
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "usdc" | "yzy">("card");

  useEffect(() => { document.title = "Cart"; }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await submit({
        data: { ...formData, paymentMethod, items },
      });
      if (res?.redirectUrl) window.location.href = res.redirectUrl;
      else if (res?.error) toast.error(res.error);
    } catch { toast.error("Checkout failed."); } 
    finally { setLoading(false); }
  }

  const Input = ({ placeholder, name, type = "text" }: any) => (
    <input 
      placeholder={placeholder} type={type} 
      className="w-full border-b border-black dark:border-white/20 bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
      onChange={(e) => setFormData({...formData, [name]: e.target.value})}
    />
  );

  return (
    <section className="bg-background text-foreground min-h-screen py-12 px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20">
        
        {/* LEFT: Forms */}
        <form onSubmit={onSubmit} className="space-y-12">
          
          {/* Contact */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase">Contact Information</h2>
            <Input placeholder="Email Address" name="email" />
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
              <input type="checkbox" /> Subscribe to updates and notifications
            </label>
          </div>

          {/* Shipping */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase">Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="First Name" name="firstName" />
              <Input placeholder="Last Name" name="lastName" />
            </div>
            <Input placeholder="Address" name="address" />
            <Input placeholder="Apartment, Suite, Unit, etc. (Optional)" name="apt" />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1"><Input placeholder="City" name="city" /></div>
              <div className="col-span-1">
                <select className="w-full border-b border-black dark:border-white/20 bg-transparent py-3 text-sm outline-none">
                  <option>State</option>
                  <option>Texas</option>
                </select>
              </div>
              <div className="col-span-1"><Input placeholder="Zip" name="zip" /></div>
            </div>
            <Input placeholder="Phone Number" name="phone" />
          </div>

          {/* Payment */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase">Payment Details</h2>
            <p className="text-[10px] text-gray-500 uppercase italic">Please enter your information above to select a payment method</p>
            <div className="grid gap-2">
              {[ { id: 'card', label: 'Credit / Debit Card' }, { id: 'usdc', label: 'USDC (Crypto)' }, { id: 'yzy', label: 'YZY (Crypto)' } ].map((m) => (
                <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id as any)} className={`border p-4 text-left ${paymentMethod === m.id ? 'border-black dark:border-white' : 'border-gray-200'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-foreground text-background py-4 font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">
            {loading ? <Loader2 className="animate-spin mx-auto" /> : "Complete Purchase"}
          </button>
        </form>

        {/* RIGHT: Order Summary */}
        <aside className="space-y-8">
          <h2 className="text-xs font-bold tracking-widest uppercase">Order Summary</h2>
          <div className="space-y-6">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantSku}`} className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm">${((item.price_cents * item.quantity) / 100).toFixed(0)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-black dark:border-white pt-6 space-y-2">
            <div className="flex justify-between text-sm uppercase tracking-widest">
              <span>Subtotal</span>
              <span>${(totalCents / 100).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm uppercase tracking-widest text-gray-500">
              <span>Shipping</span>
              <span>Calculated at next step</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-4">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(0)}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
