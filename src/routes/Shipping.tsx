import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { site } from "@/config/site";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: `Shipping — ${site.brand || "Luveni"}` },
      { name: "description", content: "Shipping times, costs, tracking, and international delivery for Luveni orders." },
    ],
  }),
  component: Shipping,
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

function Shipping() {
  return (
    <section className="bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Customer Care</p>
        <h1
          className="mt-4 tracking-tighter text-foreground"
          style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.03em" }}
        >
          Shipping.
        </h1>
        <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
          Every {BRAND} order is packed by hand and dispatched from our studio. Here is exactly what to expect
          from the moment you check out to the moment it arrives.
        </p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Last updated {UPDATED}</p>

        <div className="mt-12 border-t border-border">
          <Section title="Processing time">
            <p>
              Orders are processed within 1–2 business days. During launches, restocks, and holiday periods this
              can extend slightly — if so, we note it at checkout. You will receive a confirmation email the
              moment your order is placed, and a second email with tracking once it ships.
            </p>
          </Section>

          <Section title="Domestic delivery">
            <ul className="list-disc space-y-2 pl-5">
              <li>Standard shipping arrives in 3–5 business days after dispatch.</li>
              <li>Express shipping arrives in 1–2 business days where available.</li>
              <li>Shipping is calculated at checkout and shown before you pay — no surprises.</li>
            </ul>
          </Section>

          <Section title="International delivery">
            <p>
              We ship worldwide. International orders typically arrive within 7–14 business days after dispatch,
              depending on the destination and local carrier handling. Tracking is provided for every international
              parcel.
            </p>
          </Section>

          <Section title="Customs &amp; duties">
            <p>
              Import duties, taxes, and customs fees are set by the destination country and are not included in
              your order total. Any such charges are the responsibility of the recipient and are collected by the
              carrier or local authority on delivery.
            </p>
          </Section>

          <Section title="Tracking your order">
            <p>
              As soon as your order ships, we email you a tracking link. Please allow up to 24 hours for the first
              scan to appear once the carrier collects your parcel. If your tracking has not updated after a few
              days, reach out and we will look into it.
            </p>
          </Section>

          <Section title="Lost or delayed parcels">
            <p>
              Carrier delays are rare but do happen. If your order is significantly overdue or appears lost in
              transit, email us with your order number and we will open an investigation with the carrier and make
              it right.
            </p>
          </Section>

          <Section title="Wrong address">
            <p>
              Please double-check your shipping address at checkout. We cannot reroute a parcel once it has been
              dispatched. If a package is returned to us due to an incorrect address, we will contact you to arrange
              re-shipment.
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-3 border border-border bg-muted/30 p-4">
          <span className="grid h-10 w-10 place-items-center border border-border bg-background text-foreground">
            <Mail className="h-5 w-5" />
          </span>
          <div className="text-sm">
            <p className="text-muted-foreground">Questions about a delivery?</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </article>
    </section>
  );
}
