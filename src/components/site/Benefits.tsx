import { benefits as defaultBenefits } from "@/config/site";
import { ArrowUpRight } from "lucide-react";
import type { FeatureItem } from "@/lib/site-config";

export function Benefits({ benefits }: { benefits?: FeatureItem[] }) {
  const items = benefits ?? defaultBenefits;

  return (
    <section className="border-t border-black/10 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black">
            Why it works
          </p>
          <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
            Three reasons people <span className="serif-italic text-black">actually</span> finish.
          </h2>
          <p className="mt-4 max-w-lg text-black/55">
            No overwhelm, no fluff. A clear path designed to be completed — not bookmarked.
          </p>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden border border-black/10 bg-white md:grid-cols-3">
          {items.map((b, i) => (
            <div
              key={`${b.title}-${i}`}
              className="group relative border-r border-black/10 bg-white p-8 transition-colors hover:bg-black/[0.02] md:p-10"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-black">
                  0{i + 1}
                </span>
                <ArrowUpRight className="h-4 w-4 text-black/55 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <h3 className="mt-10 font-display text-2xl tracking-tight">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-black/55">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
