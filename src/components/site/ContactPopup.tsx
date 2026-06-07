import { useEffect, useState } from "react";
import { X, Loader2, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { captureLead } from "@/lib/leads.functions";

const Schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(5, "Please enter a longer message").max(2000),
});

// Module-level flag: persists across route changes within the same page load,
// resets on refresh. Ensures the popup only ever shows once per session.
let hasShownThisSession = false;

export function ContactPopup() {
  const [open, setOpen] = useState(false);
  const submit = useServerFn(captureLead);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (hasShownThisSession) return;
    const t = window.setTimeout(() => {
      hasShownThisSession = true;
      setOpen(true);
    }, 60_000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
          source: "contact-popup",
          metadata: { name: parsed.data.name, message: parsed.data.message },
        },
      });
      if (res?.ok) {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-lg border border-border bg-background p-6 text-foreground shadow-lg md:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 text-foreground/60 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-semibold tracking-tight">Get in touch.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions about your order, sizing, or our current collection? Send us a note—our team responds within 24 hours.
        </p>

        <div className="mt-5 flex items-center gap-3 border border-border bg-background/50 p-3">
          <span className="grid h-9 w-9 place-items-center border border-border bg-background">
            <Mail className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <p className="text-muted-foreground">Direct support</p>
            <a href="mailto:luveni.apparel@gmail.com" className="font-medium underline">
              luveni.apparel@gmail.com
            </a>
          </div>
        </div>

        {sent ? (
          <div className="mt-5 border border-border bg-background/50 p-6 text-center">
            <p className="text-base font-medium">Message received.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you for reaching out. A member of our team will assist you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="cp-name">Name</label>
              <input
                id="cp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required maxLength={120}
                className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="cp-email">Email</label>
              <input
                id="cp-email" type="email" required maxLength={255}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="cp-msg">Message</label>
              <textarea
                id="cp-msg" required maxLength={2000} rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 border border-foreground bg-foreground px-5 text-sm font-medium text-background hover:bg-background hover:text-foreground disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
