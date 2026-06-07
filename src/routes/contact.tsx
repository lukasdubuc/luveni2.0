import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { captureLead } from "@/lib/leads.functions";
import { markContactSubmitted } from "@/lib/contact-flag";
import { site } from "@/config/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact ${site.brand}` },
      { name: "description", content: `Get in touch with the ${site.brand} team. We are here to assist with your order or inquiries.` },
      { property: "og:title", content: `Contact — ${site.brand}` },
      { property: "og:description", content: `Connect with ${site.brand} for order support and inquiries.` },
    ],
  }),
  component: Contact,
});

const Schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(5, "Please enter a longer message").max(2000),
});

function Contact() {
  const submit = useServerFn(captureLead);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setLoading(true);
    try {
      const res = await submit({
        data: {
          email: parsed.data.email,
          source: "contact-form",
          metadata: { name: parsed.data.name, message: parsed.data.message },
        },
      });
      if (res?.ok) {
        markContactSubmitted();
        setSent(true);
        setForm({ name: "", email: "", message: "" });
        toast.success("Message received. We'll be in touch shortly.");
      } else {
        toast.error(res?.error ?? "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-accent"></p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Get in touch.</h1>
          <p className="mt-3 text-muted-foreground">
            Have questions about your order, sizing, or our current collection? 
            Send us a note—our team prioritizes every inquiry and will respond within 24 hours.
          </p>
          <div className="mt-8 flex items-center gap-3 border border-black/10 bg-background/50 p-4">
            <span className="grid h-10 w-10 place-items-center border border-black/10 bg-background text-foreground">
              <Mail className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="text-muted-foreground">Direct support</p>
              <a href="mailto:luveni.apparel@gmail.com" className="font-medium underline">
                luveni.apparel@gmail.com
              </a>
            </div>
          </div>
        </div>
        {sent ? (
          <div className="border border-black/10 bg-background/50 p-8 text-center">
            <p className="text-base font-medium text-foreground">Message received.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you for reaching out. A member of our team will assist you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 border border-black/10 bg-background/50 p-6">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="c-name">Name</label>
              <input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required maxLength={120}
                className="h-11 w-full border border-black/10 bg-background px-3 text-sm outline-none focus:border-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="c-email">Email</label>
              <input
                id="c-email" type="email" required maxLength={255}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 w-full border border-black/10 bg-background px-3 text-sm outline-none focus:border-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="c-msg">Message</label>
              <textarea
                id="c-msg" required maxLength={2000} rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full border border-black/10 bg-background p-3 text-sm outline-none focus:border-black"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 border border-black bg-foreground px-5 text-sm font-medium text-background hover:bg-background hover:text-foreground disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send message
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
