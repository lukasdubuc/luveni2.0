import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { site } from "@/config/site";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: `Returns & Refunds — ${site.brand || "Luveni"}` },
      { name: "description", content: "Our 30-day returns policy for unworn apparel, plus exchanges and how to start a return." },
    ],
  }),
  component: Refund,
});

const BRAND = site.brand || "Luveni";
const SUPPORT_EMAIL = "luveni.apparel@gmail.com";
const UPDATED = "June 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-8">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm font-light leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Refund() {
  return (
    <section className="bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Customer Care</p>
        <h1
          className="mt-4 tracking-tighter text-foreground"
          style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.03em" }}
        >
          Returns &amp; refunds.
        </h1>
        <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
          We want every piece to earn its place in your rotation. If something is not right, you have 30 days to
          return it — clearly, and without friction.
        </p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Last updated {UPDATED}</p>

        <div className="mt-12 border-t border-border">
          <Section title="The 30-day window">
            <p>
              You may return eligible items within 30 days of delivery for a full refund to your original payment
              method. Items must be unworn, unwashed, and returned with all original tags attached in their
              original condition.
            </p>
          </Section>

          <Section title="How to start a return">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Email{" "}
                <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
                from the address used at checkout.
              </li>
              <li>Include your order number and the item(s) you would like to return.</li>
              <li>We will reply with a return authorization and instructions within 1–2 business days.</li>
            </ol>
          </Section>

          <Section title="Refund processing">
            <p>
              Once your return arrives and passes a quick condition check, we issue your refund within 5 business
              days. Depending on your bank or card issuer, it can take a few additional days for the funds to appear
              on your statement.
            </p>
          </Section>

          <Section title="Exchanges">
            <p>
              Need a different size or colour? Start a return for the original item and place a new order for the
              one you want. This is the fastest way to get the correct piece to you while stock lasts.
            </p>
          </Section>

          <Section title="Damaged or incorrect items">
            <p>
              If your order arrives damaged, defective, or incorrect, email us within 7 days of delivery with your
              order number and a photo. We will cover return shipping and send a replacement or full refund — your
              choice.
            </p>
          </Section>

          <Section title="Return shipping">
            <p>
              For standard returns, the cost of return shipping is the customer's responsibility. For damaged,
              defective, or incorrectly shipped items, {BRAND} covers it in full.
            </p>
          </Section>

          <Section title="Final sale">
            <p>
              Items marked "final sale" cannot be returned or exchanged unless they arrive damaged or defective.
              This is always stated clearly on the product page before purchase.
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-3 border border-border bg-muted/30 p-4">
          <span className="grid h-10 w-10 place-items-center border border-border bg-background text-foreground">
            <Mail className="h-5 w-5" />
          </span>
          <div className="text-sm">
            <p className="text-muted-foreground">Need to start a return?</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </article>
    </section>
  );
}
