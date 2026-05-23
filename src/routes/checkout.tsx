import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Check } from "lucide-react";
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

    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1);
    return { product: products?.[0] ?? null, variantSku: null };
  },
  head: () => ({
    meta: [
      { title: `Checkout — ${offer.name}` },
      { name: "description", content: `Secure checkout for ${offer.name}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const FormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
});

function Checkout() {
  const navigate = useNavigate();
  const submit = useServerFn(createCheckout);
  const { product, variantSku } = Route.useLoaderData();
  
  // Using global cart state
  const { items, addItem, totalCents } = useCart();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize cart with product from loader if empty
  useEffect(() => {
    if (product && items.length === 0) {
      addItem({
        productId: product.id,
        variantSku: variantSku ?? undefined,
        title: product.title,
        price_cents: product.price_cents,
        quantity: 1
      });
    }
  }, [product, items.length, addItem, variantSku]);

  const selectedVariant = (product?.variants as any[])?.find(
    (variant: any) => variant.sku === variantSku,
  );

  const displayName = selectedVariant?.sku
    ? `${product?.title} (${selectedVariant.sku})`
    : product?.title ?? offer.name;

  const displayPrice = `$${(totalCents / 100).toFixed(0)}`;

  const displayBullets: string[] = selectedVariant?.bullet_points?.length
    ? selectedVariant.bullet_points
    : product?.bullet_points?.length
    ? product.bullet_points
    : product?.description
    ? product.description.split("\n").map((b: string) => b.trim()).filter(Boolean)
    : offer.bullets;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your details to get instant access.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-5 border border-black/10 bg-background/50 p-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="Alex Rivera"
                className="h-11 w-full border border-black/10 bg-background px-3 text-sm outline-none focus:border-black"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="you@email.com"
                className="h-11 w-full border border-black/10 bg-background px-3 text-sm outline-none focus:border-black"
              />
              <p className="text-xs text-muted-foreground">We'll send your access link to this address.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 border border-black bg-foreground text-base font-medium text-background transition-colors hover:bg-background hover:text-foreground disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Lock className="h-4 w-4" /> Pay {displayPrice} securely
            </button>
            <p className="text-center text-xs text-muted-foreground">
              By completing this purchase you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground">Terms</a> and{" "}
              <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
            </p>
          </form>
        </div>

        <aside className="md:col-span-2">
          <div className="border border-black/10 bg-background/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Order summary
            </h2>

            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{displayName}</p>
                <p className="text-sm text-muted-foreground">One-time payment</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{displayPrice}</p>
              </div>
            </div>

            <div className="my-5 h-px bg-black/10" />
            <ul className="space-y-2 text-sm">
              {displayBullets.map((b: string) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-foreground" />
                  <span className="text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
            <div className="my-5 h-px bg-black/10" />

            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{displayPrice}</span>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">{offer.guarantee}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
