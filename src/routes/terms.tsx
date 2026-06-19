import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { site } from "@/config/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: `Terms of Service — ${site.brand || "Luveni"}` },
      { name: "description", content: `The terms that govern your use of ${site.brand || "Luveni"} and our products.` },
    ],
  }),
  component: Terms,
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

function Terms() {
  return (
    <section className="bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Legal</p>
        <h1
          className="mt-4 tracking-tighter text-foreground"
          style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.03em" }}
        >
          Terms of service.
        </h1>
        <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
          These terms govern your access to and use of {BRAND}. By browsing our site or purchasing our products,
          you agree to them.
        </p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Last updated {UPDATED}</p>

        <div className="mt-12 border-t border-border">
          <Section title="Use of the site">
            <p>
              You agree to use our site only for lawful purposes. You may not attempt to disrupt the service,
              access it through automated means without permission, or use it in any way that infringes the rights
              of others.
            </p>
          </Section>

          <Section title="Orders &amp; pricing">
            <p>
              All orders are subject to acceptance and availability. Prices are shown in the currency displayed at
              checkout and may change without notice. We reserve the right to refuse or cancel any order — for
              example in cases of suspected fraud, pricing errors, or stock issues — and to refund you in full if we
              do.
            </p>
          </Section>

          <Section title="Payment">
            <p>
              You authorize us and our payment processor to charge the payment method you provide for the full
              amount shown at checkout, including any applicable shipping and taxes.
            </p>
          </Section>

          <Section title="Shipping &amp; returns">
            <p>
              Delivery is governed by our{" "}
              <a className="underline" href="/shipping">Shipping</a> policy, and returns and refunds are governed by
              our <a className="underline" href="/refund">Returns &amp; Refunds</a> policy.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              All branding, designs, graphics, photography, and site content remain the property of {BRAND} unless
              explicitly stated. You may not reproduce, resell, or redistribute them without our written permission.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              Our products and site are provided on an "as is" basis. To the fullest extent permitted by law,
              {" "}{BRAND} is not liable for any indirect, incidental, or consequential damages arising from your use
              of the site or products.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. Continued use of the site after changes are posted
              constitutes acceptance of the updated terms.
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-3 border border-border bg-muted/30 p-4">
          <span className="grid h-10 w-10 place-items-center border border-border bg-background text-foreground">
            <Mail className="h-5 w-5" />
          </span>
          <div className="text-sm">
            <p className="text-muted-foreground">Questions about these terms?</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </article>
    </section>
  );
}
