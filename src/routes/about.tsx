import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useRef, useState } from "react";
import { Shield, Sparkles, Eye, Users } from "lucide-react";
import { toast } from "sonner";

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

// ────────────────────────────────────────────────────────────────────────────
// LIGHTWEIGHT INTERSECTION OBSERVER CONTAINER FOR FADE-UP ANIMATIONS
// ────────────────────────────────────────────────────────────────────────────
function FadeInDirection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -45px 0px" }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: `${delay}ms`,
      }}
      className="motion-reduce:opacity-100 motion-reduce:transform-none"
    >
      {children}
    </div>
  );
}

function About() {
  const heroImageRef = useRef<HTMLImageElement>(null);
  const zoomSectionRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);

  // IntersectionObserver to scale hero image from 1.0 to 1.12
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setHeroVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeroVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (heroImageRef.current) {
      observer.observe(heroImageRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // IntersectionObserver to trigger stagger on zoom strip elements
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setZoomVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    if (zoomSectionRef.current) {
      observer.observe(zoomSectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleAddToCart = () => {
    try {
      const existingCart = JSON.parse(localStorage.getItem("cart") || "[]");
      const item = {
        id: "f3cb47f6-0d11-4b97-9e3b-29d306607819", // Standard GZ R-01 Product ID
        title: "GZ R-01 (organic, unisex)",
        price: 2800, // Cents
        image: "https://files.cdn.printful.com/files/78f/78fbe8e3abfd368625d5c143ffe0189d_preview.png",
        quantity: 1,
      };

      const existingIndex = existingCart.findIndex((i: any) => i.id === item.id);
      if (existingIndex > -1) {
        existingCart[existingIndex].quantity += 1;
      } else {
        existingCart.push(item);
      }

      localStorage.setItem("cart", JSON.stringify(existingCart));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Added GZ R-01 (organic, unisex) to cart");
    } catch (e) {
      console.error("Cart action error:", e);
    }
  };

  const zoomStripCols = [
    {
      img: "https://files.cdn.printful.com/files/615/61572d86e70a8bfe299150c10432c496_preview.png",
      label: "CONSTRUCTION",
      heading: "Ribbed Collar",
      copy: "Reinforced double-needle stitching designed to maintain shape wash after wash.",
    },
    {
      img: "https://files.cdn.printful.com/files/9e8/9e876ce4efee7c0415d88386792f6f5d_preview.png",
      label: "SIGNATURE",
      heading: "Bonsai Embroidery",
      copy: "Our minimal, high-density emblem represents resilient elegance and steady growth.",
    },
    {
      img: "https://files.cdn.printful.com/files/1f4/1f4017c83d3d8099557f471924905541_preview.png",
      label: "SENSORY",
      heading: "Textured Organic Cotton",
      copy: "Subtle slub character provides a premium tactile experience with ultimate breathability.",
    },
  ];

  const brandValues = [
    {
      icon: Shield,
      title: "Quality",
      description: "We select fabrics of the highest grade, built to endure years of wear and wash.",
    },
    {
      icon: Sparkles,
      title: "Timeless",
      description: "Designed for longevity, our silhouettes transcend seasonal fast-fashion cycles.",
    },
    {
      icon: Eye,
      title: "Minimal",
      description: "Removing the superfluous to highlight impeccable details and drape.",
    },
    {
      icon: Users,
      title: "Community",
      description: "Partnering with local craftspeople and nurturing global wearers.",
    },
  ];

  return (
    <div className="w-full bg-background text-foreground transition-colors duration-300">
      
      {/* ───────────────────────────────────────────────────────────────────
          SECTION 1: PRODUCT HERO
          ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-80px)] border-b border-black/10 dark:border-white/10">
        
        {/* Left column: GZ R-01 image on black background */}
        <div className="bg-neutral-950 relative flex items-center justify-center overflow-hidden h-[50vh] md:h-auto min-h-[400px]">
          <img
            ref={heroImageRef}
            src="https://files.cdn.printful.com/files/78f/78fbe8e3abfd368625d5c143ffe0189d_preview.png"
            alt="GZ R-01 Signature T-Shirt"
            className="max-h-[85%] max-w-[85%] object-contain select-none"
            style={{
              transform: heroVisible ? "scale(1.12)" : "scale(1.0)",
              transition: "transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* Right column: Details */}
        <div className="flex flex-col justify-center p-8 sm:p-12 md:p-16 lg:p-24">
          <FadeInDirection>
            <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground uppercase">
              Signature Piece · GZ R-01
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mt-3 mb-6">
              The one you reach for first.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground mb-10 max-w-lg">
              Crafted from heavyweight, combed organic cotton, the GZ R-01 balances a relaxed, modern silhouette with highly structured lines. 
              Finished with our minimal Bonsai emblem, it represents slow, intentional design built for the everyday rotation.
            </p>

            {/* 2x2 specs grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10 py-8 border-t border-b border-black/10 dark:border-white/10">
              <div>
                <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase block">Material</span>
                <span className="text-xs font-semibold mt-1 block">100% Organic Cotton</span>
              </div>
              <div>
                <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase block">Fit</span>
                <span className="text-xs font-semibold mt-1 block">Relaxed / Boxy</span>
              </div>
              <div>
                <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase block">Weight</span>
                <span className="text-xs font-semibold mt-1 block">Heavyweight 240 GSM</span>
              </div>
              <div>
                <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase block">Care</span>
                <span className="text-xs font-semibold mt-1 block">Machine Wash Cold</span>
              </div>
            </div>

            {/* Pricing & Button */}
            <div className="flex flex-row items-center justify-between gap-6">
              <div>
                <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase block">Retail Price</span>
                <span className="text-3xl font-semibold tracking-tight">$28</span>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-1 max-w-xs text-center font-mono tracking-widest text-[10px] font-bold px-8 py-4 bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all uppercase"
              >
                Add To Cart
              </button>
            </div>
          </FadeInDirection>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          SECTION 2: ZOOM DETAIL STRIP
          ─────────────────────────────────────────────────────────────────── */}
      <section ref={zoomSectionRef} className="w-full bg-muted/30 py-16 md:py-24 border-b border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {zoomStripCols.map((col, index) => (
              <div
                key={index}
                style={{
                  opacity: zoomVisible ? 1 : 0,
                  transform: zoomVisible ? "translateY(0)" : "translateY(24px)",
                  transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: zoomVisible ? `${index * 150}ms` : "0ms",
                }}
                className="group flex flex-col pointer-events-auto motion-reduce:opacity-100 motion-reduce:transform-none"
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-900 relative">
                  <img
                    src={col.img}
                    alt={col.heading}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="mt-6 space-y-2">
                  <span className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground uppercase block">
                    {col.label}
                  </span>
                  <h3 className="text-lg font-medium text-foreground">
                    {col.heading}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {col.copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          SECTION 3: BRAND STORY + VALUES (INTEGRATING ORIGINAL COPY)
          ─────────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Left Column: Brand Story (Original context & text) */}
          <div className="flex flex-col justify-center">
            <FadeInDirection>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-6">
                Cut through the noise of fast fashion.
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground font-normal">
                <p>
                  We believe that what you wear should be as functional as it is aesthetic. 
                  We started {site.brand} to cut through the noise of fast fashion, 
                  offering pieces that prioritize longevity over trends.
                </p>
                <p>
                  Every garment we release is crafted to be a staple in your rotation—designed 
                  to feel better, last longer, and fit seamlessly into your personal style.
                </p>
                
                <div className="pt-4 border-t border-black/10 dark:border-white/10">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">Our standards</h3>
                  <ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">
                    <li>Quality through simplicity.</li>
                    <li>Minimalist design, maximum impact.</li>
                    <li>Pieces made to be worn, not just owned.</li>
                    <li>Commitment to timeless, elevated essentials.</li>
                  </ul>
                </div>

                <div className="pt-4 text-xs">
                  <p>
                    For inquiries, feedback, or support, reach us at{" "}
                    <a className="text-foreground underline hover:opacity-80" href="mailto:luveni.apparel@gmail.com">
                      luveni.apparel@gmail.com
                    </a>.
                  </p>
                </div>
              </div>
            </FadeInDirection>
          </div>

          {/* Right Column: Values 2x2 grid */}
          <div className="flex items-center">
            <FadeInDirection delay={100}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-10">
                {brandValues.map((value, i) => {
                  const Icon = value.icon;
                  return (
                    <div key={i} className="space-y-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground">
                        <Icon size={14} />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {value.title}
                      </h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {value.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </FadeInDirection>
          </div>

        </div>
      </section>

    </div>
  );
}
