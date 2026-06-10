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

// ─── FADE UP ON SCROLL ────────────────────────────────────────────────────
function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(e.target); } },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.75s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.75s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── PARALLAX IMAGE ───────────────────────────────────────────────────────
function ParallaxImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      if (!ref.current || !imgRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - (rect.bottom / (vh + rect.height));
      const clampedProgress = Math.max(0, Math.min(1, progress));
      imgRef.current.style.transform = `translateY(${clampedProgress * -40}px) scale(1.08)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} className="w-full h-full overflow-hidden">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        style={{ transition: "transform 0.1s linear", willChange: "transform" }}
      />
    </div>
  );
}

// ─── CINEMATIC ZOOM IMAGE (GZ R-01 hero) ─────────────────────────────────
function CinematicProduct() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [entered, setEntered] = useState(false);

  // Scroll-driven scale: zooms from 1.0 to 1.18 as section scrolls through viewport
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      if (!containerRef.current || !imgRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, 1 - rect.bottom / (vh + rect.height)));
      imgRef.current.style.transform = `scale(${1 + progress * 0.18})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fade in on entry
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setEntered(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-neutral-950 overflow-hidden flex items-center justify-center"
      style={{ minHeight: "60vh" }}
    >
      {/* Ambient glow behind shirt */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(255,255,255,0.035) 0%, transparent 70%)",
        }}
      />
      <img
        ref={imgRef}
        src="https://files.cdn.printful.com/files/78f/78fbe8e3abfd368625d5c143ffe0189d_preview.png"
        alt="GZ R-01 Organic Unisex Tee"
        className="relative z-10 select-none"
        style={{
          maxHeight: "82%",
          maxWidth: "82%",
          objectFit: "contain",
          opacity: entered ? 1 : 0,
          transition: "opacity 1.1s cubic-bezier(0.16,1,0.3,1), transform 0.12s linear",
          willChange: "transform",
          filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.7))",
        }}
        draggable={false}
      />
      {/* Bottom label */}
      <div
        className="absolute bottom-6 left-0 right-0 flex justify-center z-20"
        style={{
          opacity: entered ? 1 : 0,
          transition: "opacity 1.4s cubic-bezier(0.16,1,0.3,1) 0.3s",
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "9px",
            letterSpacing: "0.28em",
            color: "rgba(255,255,255,0.28)",
            textTransform: "uppercase",
          }}
        >
          GZ R-01 · Organic Unisex · $28
        </span>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────
function About() {
  const zoomRef = useRef<HTMLDivElement>(null);
  const [zoomVisible, setZoomVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setZoomVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (zoomRef.current) obs.observe(zoomRef.current);
    return () => obs.disconnect();
  }, []);

  const handleAddToCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const item = {
        id: "f3cb47f6-0d11-4b97-9e3b-29d306607819",
        title: "GZ R-01 (organic, unisex)",
        price: 2800,
        image: "https://files.cdn.printful.com/files/78f/78fbe8e3abfd368625d5c143ffe0189d_preview.png",
        quantity: 1,
      };
      const idx = cart.findIndex((i: any) => i.id === item.id);
      if (idx > -1) cart[idx].quantity += 1;
      else cart.push(item);
      localStorage.setItem("cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Added GZ R-01 to cart");
    } catch (e) {
      console.error(e);
    }
  };

  // ── Detail strip: three zoomed angles of GZ R-01
  const details = [
    {
      img: "https://files.cdn.printful.com/files/615/61572d86e70a8bfe299150c10432c496_preview.png",
      label: "Construction",
      heading: "Ribbed collar",
      copy: "Double-needle reinforcement. Holds its shape after a hundred washes.",
    },
    {
      img: "https://files.cdn.printful.com/files/9e8/9e876ce4efee7c0415d88386792f6f5d_preview.png",
      label: "Signature",
      heading: "Bonsai mark",
      copy: "High-density embroidery at the chest. Patience rendered in thread.",
    },
    {
      img: "https://files.cdn.printful.com/files/1f4/1f4017c83d3d8099557f471924905541_preview.png",
      label: "Material",
      heading: "Organic cotton",
      copy: "240 GSM. Substantial hand-feel. Breathable for every-day wear.",
    },
  ];

  // ── Brand values
  const values = [
    { icon: Shield, title: "Quality", desc: "Highest-grade fabrics selected to endure years of wear and wash." },
    { icon: Sparkles, title: "Timeless", desc: "Silhouettes designed to outlast whatever season they drop in." },
    { icon: Eye, title: "Minimal", desc: "Everything superfluous removed. Only the essential remains." },
    { icon: Users, title: "Community", desc: "Built for real people in real fits — not for a runway." },
  ];

  return (
    <div className="w-full bg-background text-foreground">

      {/* ══════════════════════════════════════════════════════════════════
          1. CINEMATIC PRODUCT HERO
          ══════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 md:grid-cols-2 border-b border-black/10 dark:border-white/10" style={{ minHeight: "92vh" }}>

        {/* LEFT — full bleed shirt, scroll zoom */}
        <div className="relative border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10" style={{ minHeight: "56vh" }}>
          <CinematicProduct />
        </div>

        {/* RIGHT — product info */}
        <div className="flex flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-20">
          <FadeUp>
            <p
              className="text-muted-foreground uppercase mb-5"
              style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}
            >
              Signature piece · GZ R-01
            </p>

            <h1
              className="tracking-tight text-foreground mb-6"
              style={{ fontSize: "clamp(32px, 4.5vw, 56px)", fontWeight: 300, lineHeight: 1.06, letterSpacing: "-0.025em" }}
            >
              The one you<br />
              <span style={{ fontWeight: 600 }}>reach for first.</span>
            </h1>

            <p className="text-sm leading-relaxed text-muted-foreground mb-10 max-w-md" style={{ fontWeight: 300 }}>
              Heavyweight combed organic cotton. A bonsai mark reduced to its most essential form.
              The GZ R-01 is the piece Luveni was built around — designed for your rotation, not the rack.
            </p>

            {/* Specs */}
            <div
              className="grid grid-cols-2 mb-10 border-t border-b border-black/10 dark:border-white/10"
              style={{ gap: 0 }}
            >
              {[
                ["Material", "100% Organic Cotton"],
                ["Fit", "Relaxed / Boxy"],
                ["Weight", "Heavyweight 240 GSM"],
                ["Care", "Machine Wash Cold"],
              ].map(([label, val], i) => (
                <div
                  key={i}
                  className="py-4 pr-6"
                  style={{
                    borderRight: i % 2 === 0 ? "0.5px solid" : "none",
                    borderBottom: i < 2 ? "0.5px solid" : "none",
                    borderColor: "rgba(128,128,128,0.15)",
                  }}
                >
                  <span
                    className="text-muted-foreground uppercase block mb-1"
                    style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.18em" }}
                  >
                    {label}
                  </span>
                  <span className="text-foreground text-xs font-medium">{val}</span>
                </div>
              ))}
            </div>

            {/* Price + CTA */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <span
                  className="text-muted-foreground uppercase block mb-1"
                  style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.18em" }}
                >
                  Price
                </span>
                <span className="text-foreground" style={{ fontSize: "32px", fontWeight: 300, letterSpacing: "-0.02em" }}>
                  $28
                </span>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-1 max-w-xs bg-foreground text-background hover:opacity-80 active:scale-[0.97] transition-all"
                style={{
                  padding: "14px 32px",
                  fontFamily: "monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Add to Cart
              </button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2. DETAIL STRIP — three close-up angles
          ══════════════════════════════════════════════════════════════════ */}
      <section
        ref={zoomRef}
        className="border-b border-black/10 dark:border-white/10"
        style={{ background: "var(--background)" }}
      >
        {/* Header */}
        <div className="px-6 py-10 border-b border-black/10 dark:border-white/10">
          <FadeUp>
            <p
              className="text-muted-foreground uppercase mb-2"
              style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}
            >
              Detail · GZ R-01
            </p>
            <h2
              className="text-foreground"
              style={{ fontSize: "clamp(20px, 3vw, 32px)", fontWeight: 300, letterSpacing: "-0.02em" }}
            >
              Every thread, considered.
            </h2>
          </FadeUp>
        </div>

        {/* 3-col strip */}
        <div className="grid grid-cols-1 md:grid-cols-3">
          {details.map((d, i) => (
            <div
              key={i}
              className="group"
              style={{
                borderRight: i < 2 ? "0.5px solid rgba(128,128,128,0.15)" : "none",
                opacity: zoomVisible ? 1 : 0,
                transform: zoomVisible ? "translateY(0)" : "translateY(32px)",
                transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 160}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 160}ms`,
              }}
            >
              {/* Image — tall, fills, hover slight zoom */}
              <div
                className="w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900"
                style={{ height: "clamp(260px, 32vw, 420px)" }}
              >
                <img
                  src={d.img}
                  alt={d.heading}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ display: "block" }}
                />
              </div>
              {/* Info */}
              <div className="px-7 py-8 border-t border-black/10 dark:border-white/10">
                <p
                  className="text-muted-foreground uppercase mb-3"
                  style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.22em" }}
                >
                  {String(i + 1).padStart(2, "0")} — {d.label}
                </p>
                <h3 className="text-foreground text-base font-medium mb-2">{d.heading}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed" style={{ fontWeight: 300 }}>{d.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3. BRAND STORY + VALUES
          ══════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-black/10 dark:border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Left — story */}
          <div
            className="px-8 py-16 sm:px-12 md:px-16 lg:px-20 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10"
          >
            <FadeUp>
              <p
                className="text-muted-foreground uppercase mb-5"
                style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}
              >
                Our approach
              </p>
              <h2
                className="text-foreground mb-7"
                style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.2 }}
              >
                Cut through the noise<br />of fast fashion.
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground" style={{ fontWeight: 300 }}>
                <p>
                  We believe what you wear should be as functional as it is aesthetic.{" "}
                  {site.brand} exists to cut through the noise of fast fashion — offering pieces that
                  prioritize longevity over trends.
                </p>
                <p>
                  Every garment is crafted to be a staple in your rotation. Designed to feel better,
                  last longer, and fit seamlessly into your personal style.
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-black/10 dark:border-white/10">
                <p
                  className="text-muted-foreground uppercase mb-4"
                  style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.22em" }}
                >
                  Standards
                </p>
                <ul className="space-y-2">
                  {[
                    "Quality through simplicity.",
                    "Minimalist design, maximum impact.",
                    "Pieces made to be worn, not just owned.",
                    "Commitment to timeless, elevated essentials.",
                  ].map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2" style={{ fontWeight: 300 }}>
                      <span className="mt-[5px] w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0 opacity-50" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-black/10 dark:border-white/10 text-xs text-muted-foreground" style={{ fontWeight: 300 }}>
                Reach us at{" "}
                <a
                  href="mailto:luveni.apparel@gmail.com"
                  className="text-foreground underline underline-offset-2 hover:opacity-60 transition-opacity"
                >
                  luveni.apparel@gmail.com
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Right — values */}
          <div className="px-8 py-16 sm:px-12 md:px-16 lg:px-20 flex items-center">
            <FadeUp delay={120}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                {values.map((v, i) => {
                  const Icon = v.icon;
                  return (
                    <div key={i}>
                      <div
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mb-4"
                      >
                        <Icon size={13} className="text-foreground" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">{v.title}</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground" style={{ fontWeight: 300 }}>
                        {v.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4. FULL-WIDTH EDITORIAL IMAGE BAND
             Uses the third Printful preview as an atmospheric wide shot
          ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden border-b border-black/10 dark:border-white/10"
        style={{ height: "clamp(280px, 45vw, 560px)" }}
      >
        <ParallaxImage
          src="https://files.cdn.printful.com/files/1f4/1f4017c83d3d8099557f471924905541_preview.png"
          alt="Luveni fabric detail"
        />
        {/* Dark overlay + centered text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ background: "rgba(0,0,0,0.42)" }}
        >
          <FadeUp>
            <p
              className="uppercase mb-3"
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                letterSpacing: "0.28em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Luveni · {new Date().getFullYear()}
            </p>
            <p
              style={{
                fontSize: "clamp(24px, 4vw, 48px)",
                fontWeight: 200,
                letterSpacing: "-0.025em",
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              Designed for the<br />
              <span style={{ fontWeight: 500 }}>everyday uniform.</span>
            </p>
          </FadeUp>
        </div>
      </section>

    </div>
  );
}
