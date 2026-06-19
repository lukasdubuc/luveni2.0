import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { site } from "@/config/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: `Privacy Policy — ${site.brand || "Luveni"}` },
      { name: "description", content: `How ${site.brand || "Luveni"} collects, uses, and protects your information.` },
    ],
  }),
  component: Privacy,
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

function Privacy() {
  return (
    <section className="bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Legal</p>
        <h1
          className="mt-4 tracking-tighter text-foreground"
          style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.03em" }}
        >
          Privacy policy.
        </h1>
        <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
          This policy describes how {BRAND} collects, uses, and protects your information when you shop with us
          or visit our site. We keep it short, and we keep it honest.
        </p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Last updated {UPDATED}</p>

        <div className="mt-12 border-t border-border">
          <Section title="Information we collect">
            <p>
              We collect information you provide directly — such as your name, email address, shipping address, and
              payment details when you place an order or contact us. We also collect limited technical information
              such as IP address, browser type, and pages visited through standard server logs and
              privacy-respecting analytics.
            </p>
          </Section>

          <Section title="How we use information">
            <ul className="list-disc space-y-2 pl-5">
              <li>To process, pack, and ship the orders you place.</li>
              <li>To send transactional emails — order confirmations, shipping updates, and support.</li>
              <li>To send marketing emails only when you opt in. You can unsubscribe at any time.</li>
              <li>To improve our products and site, and to prevent fraud and abuse.</li>
            </ul>
          </Section>

          <Section title="Payments">
            <p>
              Payments are handled by our PCI-compliant payment processor. We never see or store your full card
              number — it is transmitted directly to the processor and tokenized.
            </p>
          </Section>

          <Section title="Sharing">
            <p>
              We do not sell your personal information. We share it only with the service providers that help us
              operate — for example payment processors, shipping carriers, and email tools — and only as needed to
              fulfil your order and run the business.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You can request access to, correction of, or deletion of your information at any time by emailing{" "}
              <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You can unsubscribe from
              marketing emails using the link in any message we send.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use a small number of cookies to operate the store, keep your cart, and remember preferences. You
              can control or clear cookies in your browser settings at any time.
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-3 border border-border bg-muted/30 p-4">
          <span className="grid h-10 w-10 place-items-center border border-border bg-background text-foreground">
            <Mail className="h-5 w-5" />
          </span>
          <div className="text-sm">
            <p className="text-muted-foreground">Privacy questions?</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </article>
    </section>
  );
}
