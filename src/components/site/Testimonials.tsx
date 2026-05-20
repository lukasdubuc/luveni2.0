import { Star } from "lucide-react";
import { testimonials as defaultTestimonials } from "@/config/site";
import type { TestimonialItem } from "@/lib/site-config";

export function Testimonials({ testimonials }: { testimonials?: TestimonialItem[] }) {
  const items = testimonials ?? defaultTestimonials;

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            Word of mouth
          </p>
          <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
            Quietly <span className="serif-italic text-accent">loved</span> by early customers.
          </h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {items.map((t, index) => (
            <figure
              key={`${t.name}-${index}`}
              className="flex h-full flex-col rounded-2xl border border-border p-8"
              style={{ backgroundImage: "var(--gradient-surface)" }}
            >
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-6 flex-1 font-display text-xl leading-snug tracking-tight text-foreground">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-8 border-t border-border pt-5 text-sm">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
