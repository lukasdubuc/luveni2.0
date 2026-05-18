import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { Benefits } from "@/components/site/Benefits";
import { OfferSection } from "@/components/site/OfferSection";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CTASection } from "@/components/site/CTASection";
import { LeadCaptureForm } from "@/components/site/LeadCaptureForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Northwind — get the result you actually want" },
      { name: "description", content: "A focused, no-fluff package that gets you to the result faster. Instant access, lifetime updates, 30-day money-back guarantee." },
      { property: "og:title", content: "Northwind — get the result you actually want" },
      { property: "og:description", content: "A focused, no-fluff package that gets you to the result faster." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />
      <Benefits />
      <OfferSection />
      <Testimonials />
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Not ready to buy? Get updates.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            One email when there's something genuinely worth your time.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <LeadCaptureForm source="home-newsletter" />
          </div>
        </div>
      </section>
      <FAQ />
      <CTASection />
    </>
  );
}
