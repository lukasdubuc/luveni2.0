import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { site } from "@/config/site";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: `Refund Policy — ${site.brand}` },
      { name: "description", content: `Our 30-day refund policy. No questions asked.` },
    ],
  }),
  component: Refund,
});

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight text-foreground">{children}</h2>;
}

function Refund() {
  return (
    <section className="bg-background">
      <article className="mx-auto max-w-3xl px-4 py-16 text-base leading-relaxed text-muted-foreground">
        <p className="text-sm uppercase tracking-wider text-accent">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Refund Policy
        </h1>
        <p className="mt-2 text-sm">Last updated: {new Date().toLocaleDateString()}</p>

        <p className="mt-8">
          We stand behind what we make. If our product isn't a fit for you,
          you can request a full refund within 30 days of purchase — no
          questions, no awkward forms.
        </p>

        <H>How to request a refund</H>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Email{" "}
            <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>{" "}
            from the address you used at checkout.
          </li>
          <li>Mention the product name and the date of purchase.</li>
          <li>We'll process the refund within 5 business days.</li>
        </ol>

        <H>Eligibility</H>
        <p className="mt-3">
          Refunds are available for one-time purchases within 30 days of the
          purchase date. For abuse (such as repeated refund-then-rebuy cycles),
          we reserve the right to decline future refunds and revoke access.
        </p>

        <H>Subscriptions</H>
        <p className="mt-3">
          If we ever offer subscriptions, you can cancel at any time from your
          account. Cancellation prevents future charges; we do not pro-rate the
          current billing period unless required by law.
        </p>

        <H>Contact</H>
        <p className="mt-3">
          Questions? Email{" "}
          <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </p>
      </article>
    </section>
  );
}
