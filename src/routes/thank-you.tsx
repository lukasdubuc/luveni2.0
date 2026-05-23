import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { site } from "@/config/site";

const Search = z.object({
  order: z.string().optional(),
});

export const Route = createFileRoute("/thank-you")({
  validateSearch: (s) => Search.parse(s),
  head: () => ({
    meta: [
      { title: "Thank you — your order is confirmed" },
      { name: "description", content: "Your order is confirmed. Check your inbox for next steps." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYou,
});

function ThankYou() {
  const { order } = Route.useSearch();
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-none bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">
          You're all set.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Thank you for your purchase. We just sent a confirmation to your email
          with everything you need to get started.
        </p>
        {order && (
          <p className="mt-3 text-xs text-muted-foreground">
            Order reference: <span className="font-mono">{order}</span>
          </p>
        )}
        <div className="mx-auto mt-8 max-w-md rounded-none border border-black/10 bg-background/50 p-6 text-left ">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            What happens next
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Check your inbox for a confirmation email.</li>
            <li>Follow the access link to get started immediately.</li>
            <li>
              Questions? Reach us at{" "}
              <a href={`mailto:${site.supportEmail}`} className="text-foreground underline">
                {site.supportEmail}
              </a>.
            </li>
          </ol>
        </div>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-none border border-black/10 bg-background px-5 py-2.5 text-sm font-medium hover:bg-background/80"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
