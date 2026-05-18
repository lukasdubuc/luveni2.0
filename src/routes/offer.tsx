import { createFileRoute } from "@tanstack/react-router";
import { OfferSection } from "@/components/site/OfferSection";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CTASection } from "@/components/site/CTASection";
import { offer } from "@/config/site";

export const Route = createFileRoute("/offer")({
  head: () => ({
    meta: [
      { title: `${offer.name} — Northwind` },
      { name: "description", content: offer.shortPitch },
      { property: "og:title", content: `${offer.name} — Northwind` },
      { property: "og:description", content: offer.shortPitch },
    ],
  }),
  component: OfferPage,
});

function OfferPage() {
  return (
    <>
      <section className="border-b border-border" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">The offer</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{offer.name}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{offer.shortPitch}</p>
        </div>
      </section>
      <OfferSection />
      <Testimonials />
      <FAQ />
      <CTASection />
    </>
  );
}
