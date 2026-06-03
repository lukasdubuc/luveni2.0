import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About ${site.brand}` },
      { name: "description", content: `Discover the story and vision behind ${site.brand}.` },
      { property: "og:title", content: `About — ${site.brand}` },
      { property: "og:description", content: `Discover the story and vision behind ${site.brand}.` },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="border-b border-black/10 bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-foreground"></p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Designed for the everyday uniform.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {site.brand} is defined by minimalist design, intentional quality, 
            and apparel that fits the way you live.
          </p>
        </div>
      </section>
      <section className="bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-16 text-base leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Our approach</h2>
          <p className="mt-4">
            We believe that what you wear should be as functional as it is aesthetic. 
            We started {site.brand} to cut through the noise of fast fashion, 
            offering pieces that prioritize longevity over trends.
          </p>
          <p className="mt-4">
            Every garment we release is crafted to be a staple in your rotation—designed 
            to feel better, last longer, and fit seamlessly into your personal style.
          </p>
          <h2 className="mt-12 text-2xl font-semibold tracking-tight text-foreground">Our standards</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>Quality through simplicity.</li>
            <li>Minimalist design, maximum impact.</li>
            <li>Pieces made to be worn, not just owned.</li>
            <li>Commitment to timeless, elevated essentials.</li>
          </ul>
          <h2 className="mt-12 text-2xl font-semibold tracking-tight text-foreground">Get in touch</h2>
          <p className="mt-4">
            We value the connection to our community. For inquiries, feedback, or 
            support, reach us at{" "}
            <a className="text-foreground underline" href="mailto:luveni.apparel@gmail.com">
              luveni.apparel@gmail.com
            </a>.
          </p>
        </div>
      </section>
    </>
  );
}
