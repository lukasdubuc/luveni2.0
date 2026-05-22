// Re-uses the same component as /offer so /offer/:slug routes correctly
// from Shop product cards without modifying the original offer.tsx logic.
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Route as OfferRoute } from "./offer";
import { offer } from "@/config/site";

export const Route = createFileRoute("/offer/$slug")({
  loader: async ({ params }) => {
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("slug", params.slug)
      .eq("is_published", true)
      .maybeSingle();
    return { product: product ?? null };
  },
  head: ({ loaderData }: any) => {
    const product = loaderData?.product;
    const title = product?.title ?? offer.name;
    const description = product?.description ?? offer.shortPitch;
    return {
      meta: [
        { title: `${title} — Northwind` },
        { name: "description", content: description },
        { property: "og:title", content: `${title} — Northwind` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: OfferRoute.options.component!,
});
