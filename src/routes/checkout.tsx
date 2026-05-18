import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { offer } from "@/config/site";
import { createCheckout } from "@/lib/checkout.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: `Checkout — ${offer.name}` },
      { name: "description", content: `Secure checkout for ${offer.name}. ${offer.guarantee}` },
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

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
          amountCents: offer.priceCents,
          currency: offer.currency,
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
    <section className="bg-muted/40">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-5 md:py-20">
        {/* Form */}
        <div className="md:col-span-3">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Checkout</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your details to get instant access.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="Alex Rivera"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              />
              <p className="text-xs text-muted-foreground">
                We'll send your access link to this address.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-medium text-accent-foreground shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Lock className="h-4 w-4" /> Pay {offer.price} securely
            </button>

            <p className="text-center text-xs text-muted-foreground">
              By completing this purchase you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground">Terms</a> and{" "}
              <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
            </p>
          </form>
        </div>

        {/* Order summary */}
        <aside className="md:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Order summary
            </h2>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{offer.name}</p>
                <p className="text-sm text-muted-foreground">One-time payment</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{offer.price}</p>
                <p className="text-xs text-muted-foreground line-through">{offer.originalPrice}</p>
              </div>
            </div>
            <div className="my-5 h-px bg-border" />
            <ul className="space-y-2 text-sm">
              {offer.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-success" />
                  <span className="text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
            <div className="my-5 h-px bg-border" />
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{offer.price}</span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{offer.guarantee}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
