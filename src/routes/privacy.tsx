import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { site } from "@/config/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: `Privacy Policy ${site.brand}` },
      { name: "description", content: `How ${site.brand} collects, uses, and protects your information.` },
    ],
  }),
  component: Privacy,
});

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight text-foreground">{children}</h2>;
}

function Privacy() {
  return (
    <section className="bg-background">
      <article className="mx-auto max-w-3xl px-4 py-16 text-base leading-relaxed text-muted-foreground">
        <p className="text-sm uppercase tracking-wider text-accent">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm">Last updated: {new Date().toLocaleDateString()}</p>

        <p className="mt-8">
          This Privacy Policy describes how {site.brand} ("we", "us", or "our")
          collects, uses, and shares information about you when you use our
          website and services. This template is a starting point and should be
          reviewed by qualified legal counsel before you launch.
        </p>

        <H>Information we collect</H>
        <p className="mt-3">
          We collect information you provide directly — such as your name, email
          address, and payment details when you place an order or contact us.
          We also collect limited technical information such as IP address,
          browser type, and pages visited via standard server logs and
          privacy-respecting analytics.
        </p>

        <H>How we use information</H>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>To process orders and deliver the product you purchased.</li>
          <li>To send transactional emails (receipts, account, support).</li>
          <li>To send marketing emails when you opt in (you can unsubscribe at any time).</li>
          <li>To improve our website and prevent abuse.</li>
        </ul>

        <H>Sharing</H>
        <p className="mt-3">
          We do not sell your personal information. We share information only
          with service providers that help us operate — for example payment
          processors and email tools — and only as needed to provide the service.
        </p>

        <H>Your choices</H>
        <p className="mt-3">
          You can request access, correction, or deletion of your information by
          emailing <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          You can unsubscribe from marketing emails using the link in each email.
        </p>

        <H>Cookies</H>
        <p className="mt-3">
          We use a small number of cookies to operate the site and remember
          preferences. You can control cookies in your browser settings.
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
