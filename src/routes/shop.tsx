import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";
import { useMemo, memo, useEffect, useState } from "react";
import { trackEvent } from "@/lib/track";
import { isLikelyTransparentImage } from "@/lib/img";
import {
  computeDisplayImages,
  fetchAllProductMedia,
  LAST_VIEWED_PRODUCT_KEY,
} from "@/lib/displayImages";
import type { ProductMedia } from "@/lib/useProductMedia";

type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  price_cents_discounted?: number | null;
  discounted_price_cents?: number | null;
  image_urls?: string[];
  variants?: any[];
};

export const Route = createFileRoute("/shop")({
  loader: async () => {
    // Products AND curated media in one round: the tile is computed from the
    // exact same display pipeline the offer gallery renders, so the tile URL
    // and the gallery's first image are always identical (seamless morph).
    const [products, mediaByProduct] = await Promise.all([
      fetchProducts({ onlyPublished: true }),
      fetchAllProductMedia(),
    ]);
    return { products: products ?? [], mediaByProduct };
  },
  // Serve the cached catalog instantly on back/forward navigation; the
  // useProducts hook refreshes it in the background.
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: "Shop" },
      { name: "description", content: "Browse all products." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const loader = Route.useLoaderData();
  const { products: clientProducts } = useProducts({ onlyPublished: true });
  const products: Product[] = useMemo(() => {
    return clientProducts && clientProducts.length > 0
      ? (clientProducts as Product[])
      : ((loader?.products as Product[]) ?? []);
  }, [clientProducts, loader?.products]);
  const mediaByProduct = (loader?.mediaByProduct ?? {}) as Record<string, ProductMedia[]>;

  // Shared-element bookkeeping: exactly ONE tile carries the view-transition
  // name at any time — the product being (or about to be) viewed. Naming every
  // tile would make the browser snapshot dozens of independent layers on each
  // navigation, which is what made the morph stutter.
  const [morphProductId, setMorphProductId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : sessionStorage.getItem(LAST_VIEWED_PRODUCT_KEY),
  );

  useEffect(() => {
    trackEvent("page_view");
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-inherit font-mono selection:bg-current selection:text-current">
      {products.length === 0 ? (
        <div className="flex h-screen items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-30">
            No Products Available
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 overflow-visible bg-inherit sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((product, index) => (
            <ProductCell
              key={product.id}
              product={product}
              index={index}
              media={mediaByProduct[product.id]}
              isMorphTarget={morphProductId === product.id}
              onOpen={() => setMorphProductId(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Whole dollars stay clean ($25); real cents are never rounded away ($32.99).
function formatCents(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

// The tile is the first image of the SAME curated display pipeline the offer
// gallery renders (cutouts replace originals, hidden/bad media excluded) —
// identical URL on both pages, so the click-through morph never flashes.
function pickThumbnail(
  product: Product,
  media: ProductMedia[] | undefined,
): { url: string; transparent: boolean } | null {
  const { images } = computeDisplayImages(media, product.image_urls, product.variants);
  const url = images[0];
  if (!url) return null;
  return { url, transparent: isLikelyTransparentImage(url) };
}

const ProductCell = memo(
  ({
    product,
    index,
    media,
    isMorphTarget,
    onOpen,
  }: {
    product: Product;
    index: number;
    media: ProductMedia[] | undefined;
    isMorphTarget: boolean;
    onOpen: () => void;
  }) => {
    const thumb = useMemo(() => pickThumbnail(product, media), [product, media]);
    const imageUrl = thumb?.url ?? null;
    // Transparent PNGs (Printful mockups, admin-treated CJ uploads) float on the
    // bare grid. Untreated vendor photos (CJ JPGs on studio backdrops) get a
    // neutral rounded tile so they read as deliberate, not pasted rectangles.
    const framed = !!thumb && !thumb.transparent;

    const discounted = product.price_cents_discounted ?? product.discounted_price_cents ?? null;
    const hasDiscount = discounted != null && discounted < product.price_cents;
    const displayPrice = hasDiscount ? discounted! : product.price_cents;

    // First 6 products load eagerly and with high priority (above the fold).
    const isAboveFold = index < 6;

    return (
      <Link
        to="/offer/$slug"
        params={{ slug: product.slug }}
        preload="intent"
        viewTransition
        // The offer page is a fixed full-viewport canvas — it never needs the
        // window scrolled to top, and leaving the grid's scroll untouched keeps
        // the shared-element geometry anchored to what's actually on screen.
        resetScroll={false}
        state={{ fromShop: true } as any}
        onClick={(e) => {
          // Stamp the shared name on the clicked tile synchronously, BEFORE the
          // router snapshots the old page, so the morph always originates from
          // the tile the shopper actually clicked.
          const img = e.currentTarget.querySelector("img");
          if (img) img.style.viewTransitionName = `product-media-${product.id}`;
          try {
            sessionStorage.setItem(LAST_VIEWED_PRODUCT_KEY, product.id);
          } catch {
            /* private mode */
          }
          onOpen();
          trackEvent("product_click", { product_id: product.id });
        }}
        className="group relative z-0 block border-none bg-transparent outline-none [transform:translateZ(0)] transition-transform duration-300 ease-out will-change-transform hover:z-10 hover:scale-[1.04] focus:outline-none focus-visible:outline-none"
      >
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-transparent p-6 sm:p-8 md:p-10">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              width={600}
              height={600}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
              className={
                framed
                  ? "aspect-square h-full w-full rounded-2xl bg-white object-contain p-3 shadow-[0_1px_10px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
                  : "max-h-full max-w-full object-contain"
              }
              loading={isAboveFold ? "eager" : "lazy"}
              decoding="async"
              {...(isAboveFold ? { fetchPriority: "high" } : {})}
              suppressHydrationWarning
              // Shared element: only the viewed tile is named, so returning
              // from the product page morphs the image back into this exact
              // cell (Yeezy-style zoom-out) without snapshotting the whole grid.
              style={
                isMorphTarget
                  ? { viewTransitionName: `product-media-${product.id}` }
                  : undefined
              }
            />
          ) : (
            <span className="text-[7px] uppercase tracking-[0.3em] opacity-20">No Image</span>
          )}
          {hasDiscount && (
            <span className="absolute right-3 top-3 text-[8px] font-bold uppercase tracking-[0.15em] text-current">
              Sale
            </span>
          )}
        </div>
        <div className="px-2 pb-8 text-center">
          <p className="mb-1.5 text-[11px] leading-tight tracking-[0.02em] text-current opacity-90">
            {product.title}
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] tracking-[0.02em] text-current">
              {formatCents(displayPrice)}
            </span>
            {hasDiscount && (
              <span className="text-[10px] tracking-[0.02em] opacity-45 line-through">
                {formatCents(product.price_cents)}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  },
);
ProductCell.displayName = "ProductCell";
