import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { site } from "@/config/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: `Terms of Service ${site.brand}` },
      { name: "description", content: `The terms that govern your use of ${site.brand}.` },
    ],
  }),
  component: Terms,
});

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight text-foreground">{children}</h2>;
}

function Terms() {
  return (
    <section className="bg-background">
      <article className="mx-auto max-w-3xl px-4 py-16 text-base leading-relaxed text-muted-foreground">
        <p className="text-sm uppercase tracking-wider text-accent">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm">Last updated: {new Date().toLocaleDateString()}</p>

        <p className="mt-8">
          These Terms govern your access to and use of {site.brand}. By using
          our website or purchasing our products, you agree to these Terms.
          This template is a starting point and should be reviewed by qualified
          legal counsel before you launch.
        </p>

        <H>Use of the service</H>
        <p className="mt-3">
          You agree to use the service only for lawful purposes. You may not
          resell, redistribute, or share access credentials for paid products
          without our written permission.
        </p>

        <H>Purchases</H>
        <p className="mt-3">
          All purchases are billed in the currency displayed at checkout.
          You authorize us and our payment processor to charge the payment
          method you provide for the amount shown.
        </p>

        <H>Intellectual property</H>
        <p className="mt-3">
          All content, materials, and code provided as part of the product
          remain the property of {site.brand} unless explicitly stated. You
          receive a personal, non-exclusive, non-transferable license to use
          the materials for your own purposes.
        </p>

        <H>Refunds</H>
        <p className="mt-3">
          Refunds are governed by our{" "}
          <a className="underline" href="/refund">Refund Policy</a>.
        </p>

        <H>Limitation of liability</H>
        <p className="mt-3">
          The service is provided "as is" without warranty of any kind. To the
          fullest extent permitted by law, {site.brand} is not liable for any
          indirect, incidental, or consequential damages arising from your use
          of the service.
        </p>

        <H>Changes</H>
        <p className="mt-3">
          We may update these Terms from time to time. Continued use of the
          service after changes constitutes acceptance of the updated Terms.
        </p>

        <H>Contact</H>
        <p className="mt-3">
          Questions? Email{"luveni.apparel@gmail.com"}
          <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </p>
      </article>
    </section>
  );
}
