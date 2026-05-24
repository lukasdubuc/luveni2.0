import { createFileRoute } from "@tanstack/react-router";
import { useCart } from "@/context/CartContext";
import { useState } from "react";
import { createCheckout } from "@/lib/checkout.functions";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, updateItemQuantity, removeItem, totalCents } = useCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (items.length === 0) { setError("Your cart is empty."); return; }
    setLoading(true);
    try {
      const result = await createCheckout({
        data: {
          name,
          email,
          items: items.map((i) => ({
            productId: i.productId,
            variantSku: i.variantSku,
            quantity: i.quantity,
          })),
        },
      });
      if (!result.ok) { setError(result.error ?? "Something went wrong."); return; }
      if (result.redirectUrl) window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono px-4 py-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold uppercase tracking-widest mb-8">Checkout</h1>

        <div className="grid md:grid-cols-2 gap-12">

          {/* ── LEFT: Form ── */}
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Contact Information */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4 border-b border-border pb-2">Contact Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
                    placeholder="jane@example.com"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subscribe}
                    onChange={(e) => setSubscribe(e.target.checked)}
                    className="w-3 h-3"
                  />
                  <span className="text-[10px] uppercase tracking-widest opacity-60">Subscribe to updates and notifications</span>
                </label>
              </div>
            </div>

            {/* Shipping Address */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4 border-b border-border pb-2">Shipping Address</h2>
              <p className="text-[10px] uppercase tracking-widest opacity-50">Collected at next step via Stripe</p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-500 uppercase tracking-widest">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="w-full bg-foreground text-background px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {loading ? "Redirecting..." : "Complete Purchase"}
            </button>
          </form>

          {/* ── RIGHT: Order Summary ── */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 border-b border-border pb-2">Order Summary</h2>

            {/* MOBILE item list */}
            <div className="md:hidden space-y-4 mb-6">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantSku}`} className="flex gap-3 border-b border-border pb-4">
                  {/* FIX 1: no border on image wrapper */}
                  <div className="w-16 h-16 flex-shrink-0 overflow-hidden">
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col flex-1 gap-1 min-w-0">
                    <h3 className="text-xs font-bold uppercase leading-tight">{item.title}</h3>
                    <p className="text-[10px] opacity-60">${(item.price_cents / 100).toFixed(2)} each</p>
                    {/* FIX 2: clean mobile layout - qty left, price+remove right */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center border border-border">
                        <button onClick={() => updateItemQuantity(item.productId, item.quantity - 1, item.variantSku)} className="px-2 py-1 text-xs hover:bg-muted">-</button>
                        <span className="px-2 text-xs">{item.quantity}</span>
                        <button onClick={() => updateItemQuantity(item.productId, item.quantity + 1, item.variantSku)} className="px-2 py-1 text-xs hover:bg-muted">+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
                        <button onClick={() => removeItem(item.productId, item.variantSku)} className="text-[10px] uppercase underline opacity-50">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP item list */}
            <div className="hidden md:block mb-6">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-3 uppercase text-[10px] tracking-widest opacity-60">Product</th>
                    <th className="pb-3 uppercase text-[10px] tracking-widest opacity-60">Qty</th>
                    <th className="pb-3 uppercase text-[10px] tracking-widest opacity-60 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.productId}-${item.variantSku}`} className="border-t border-border">
                      {/* FIX 3: image + title together, no stray image_url text */}
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 flex-shrink-0 overflow-hidden">
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs">{item.title}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateItemQuantity(item.productId, item.quantity - 1, item.variantSku)} className="text-xs px-1 hover:opacity-60">-</button>
                          <span className="text-xs">{item.quantity}</span>
                          <button onClick={() => updateItemQuantity(item.productId, item.quantity + 1, item.variantSku)} className="text-xs px-1 hover:opacity-60">+</button>
                        </div>
                      </td>
                      <td className="py-3 text-right text-xs">${((item.price_cents * item.quantity) / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="opacity-60 uppercase tracking-widest">Subtotal</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="opacity-60 uppercase tracking-widest">Shipping</span>
                <span className="opacity-60">Calculated at next step</span>
              </div>
              <div className="flex justify-between text-sm font-bold uppercase tracking-widest border-t border-border pt-2 mt-2">
                <span>Total</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
