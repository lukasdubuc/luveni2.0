import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { offer } from "@/config/site";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout } from "@/lib/checkout.functions";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/checkout")({
  loader: async ({ location }) => {
    const params = new URLSearchParams(location.searchStr ?? "");
    const productId = params.get("productId");
    const variantSku = params.get("variantSku");

    if (productId) {
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("is_published", true)
        .maybeSingle();

      if (product) return { product, variantSku };
    }
    return { product: null, variantSku: null };
  },
  component: Checkout,
});

const FormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
});

function Checkout() {
  const navigate = useNavigate();
  const submit = useServerFn(createCheckout);
  const { product } = Route.useLoaderData();
  // Added removeItem and updateQuantity to destructured values
  const { items, totalCents, removeItem, updateQuantity } = useCart();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const displayPrice = `$${(totalCents / 100).toFixed(0)}`;
  
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // SAFEGUARD: Block empty checkout
    if (totalCents <= 0) {
      toast.error("Your cart is empty. Please add items to continue.");
      return;
    }

    const parsed = FormSchema.safeParse({ name, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    
    setLoading(true);
    try {
      const res = await submit({
        data: { 
          name: parsed.data.name, 
          email: parsed.data.email, 
          productId: items[0]?.productId, 
          variantSku: items[0]?.variantSku 
        },
      });
      if (!res?.ok) {
        toast.error(res?.error ?? "Could not start checkout.");
        return;
      }
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      navigate({ to: "/thank-you", search: { order: res.orderId } });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-5 md:py-20">
        <div className="md:col-span-3">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Checkout</h1>
          <form onSubmit={onSubmit} className="mt-8 space-y-5 border border-black/10 bg-background/50 p-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Alex Rivera" className="h-11 w-full border border-black/10 bg-background px-3 text-sm outline-none focus:border-black" />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} placeholder="you@email.com" className="h-11 w-full border border-black/10 bg-background px-3 text-sm outline-none focus:border-black" />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || totalCents <= 0} 
              className="inline-flex h-12 w-full items-center justify-center gap-2 border border-black bg-foreground text-base font-medium text-background transition-colors hover:bg-background hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Lock className="h-4 w-4" /> 
              {totalCents > 0 ? `Pay ${displayPrice} securely` : "Cart Empty"}
            </button>
          </form>
        </div>

        <aside className="md:col-span-2">
          <div className="border border-black/10 bg-background/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Order summary</h2>
            
            <div className="mt-4 space-y-4">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              ) : (
                items.map((item) => (
                  <div key={`${item.productId}-${item.variantSku}`} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      
                      {/* Quantity and Edit Controls */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2 border border-black/10">
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.variantSku, item.quantity - 1)}
                            className="px-2 py-1 text-xs hover:bg-black/5"
                          >-</button>
                          <span className="text-xs w-4 text-center">{item.quantity}</span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.variantSku, item.quantity + 1)}
                            className="px-2 py-1 text-xs hover:bg-black/5"
                          >+</button>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantSku)}
                          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-black underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">${((item.price_cents * item.quantity) / 100).toFixed(0)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
