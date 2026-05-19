import { benefits } from "@/config/site";
import { ArrowUpRight } from "lucide-react";

export function Benefits() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            Why it works
          </p>
          <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
            Three reasons people <span className="serif-italic text-accent">actually</span> finish.
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            No overwhelm, no fluff. A clear path designed to be completed — not bookmarked.
          </p>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              className="group relative bg-card p-8 transition-colors hover:bg-secondary/40 md:p-10"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-accent">
                  0{i + 1}
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <h3 className="mt-10 font-display text-2xl tracking-tight">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
