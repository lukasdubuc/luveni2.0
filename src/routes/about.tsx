import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { CTASection } from "@/components/site/CTASection";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About — ${site.brand}` },
      { name: "description", content: `Learn what ${site.brand} is, who it's for, and why we built it.` },
      { property: "og:title", content: `About — ${site.brand}` },
      { property: "og:description", content: `Learn what ${site.brand} is, who it's for, and why we built it.` },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-black">About</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            We make small, useful things.
          </h1>
          <p className="mt-4 text-lg text-black/55">
            {site.brand} exists for one reason: to help people get to a real
            result without the usual overwhelm.
          </p>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-base leading-relaxed text-black/55">
          <h2 className="text-2xl font-semibold tracking-tight text-black">Our story</h2>
          <p className="mt-4">
            We started {site.brand} after years of watching smart, motivated
            people get stuck inside endless tabs, courses, and "ultimate guides"
            — and never actually finish anything.
          </p>
          <p className="mt-4">
            So we built the opposite: a focused, no-fluff package designed to
            move you from zero to a real result in a weekend, not a quarter.
          </p>
          <h2 className="mt-12 text-2xl font-semibold tracking-tight text-black">What we believe</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>Clarity beats completeness.</li>
            <li>Less, but better.</li>
            <li>Your time matters more than our content.</li>
            <li>Honesty about what works — and what doesn't.</li>
          </ul>
          <h2 className="mt-12 text-2xl font-semibold tracking-tight text-black">Get in touch</h2>
          <p className="mt-4">
            We're a small team and we read every email. Reach us at{" "}
            <a className="text-black underline" href={`mailto:${site.supportEmail}`}>
              {site.supportEmail}
            </a>.
          </p>
        </div>
      </section>
      <CTASection />
    </>
  );
}
