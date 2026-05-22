import { Star } from "lucide-react";
import { testimonials as defaultTestimonials } from "@/config/site";
import type { TestimonialItem } from "@/lib/site-config";

export function Testimonials({ testimonials }: { testimonials?: TestimonialItem[] }) {
  const items = testimonials ?? defaultTestimonials;

  return (
    <section className="border-t border-black/10 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black">
            Word of mouth
          </p>
          <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
            Quietly <span className="serif-italic text-black">loved</span> by early customers.
          </h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {items.map((t, index) => (
            <figure
              key={`${t.name}-${index}`}
              className="flex h-full flex-col border border-black/10 p-8"
             
            >
              <div className="flex gap-0.5 text-black">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-6 flex-1 font-display text-xl leading-snug tracking-tight text-black">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-8 border-t border-black/10 pt-5 text-sm">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-black/55">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
