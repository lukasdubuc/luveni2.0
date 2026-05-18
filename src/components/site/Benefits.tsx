import { benefits } from "@/config/site";
import { Check } from "lucide-react";

export function Benefits() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Why people pick this
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three simple reasons it works — without the usual overwhelm.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-xl border border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-accent/15 text-accent">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
