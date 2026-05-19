import { faqs } from "@/config/site";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-[1fr_1.5fr] md:py-32">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            FAQ
          </p>
          <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
            Common <span className="serif-italic text-accent">questions</span>.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Still on the fence? Here's what most people ask before getting started.
          </p>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`item-${i}`}
              className="overflow-hidden rounded-xl border border-border bg-card px-5"
            >
              <AccordionTrigger className="py-5 text-left font-display text-lg font-normal tracking-tight hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
