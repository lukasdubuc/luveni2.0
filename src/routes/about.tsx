import { createFileRoute, Link } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useRef, useState } from "react";
import HERO from "@/assets/about-hero.png";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About ${site.brand}` },
      { name: "description", content: `Discover the story and craft behind ${site.brand}.` },
    ],
  }),
  component: About,
});

/* ───────────────────── helpers ───────────────────── */

function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const o = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } },
      { threshold }
    );
    o.observe(ref.current);
    return () => o.disconnect();
  }, [threshold]);
  return { ref, visible: v };
}

function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const raw = 1 - r.bottom / (vh + r.height);
      setP(Math.max(0, Math.min(1, raw)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return { ref, p };
}

/* ───────────────────── sticky nav ───────────────────── */

function ProNav() {
  return (
    <div
      className="sticky top-0 z-50 w-full backdrop-blur-2xl"
      style={{ background: "rgba(0,0,0,0.72)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="mx-auto flex h-11 max-w-[1200px] items-center justify-between px-6">
        <span
          className="text-[13px] font-medium tracking-tight text-white/90"
          style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui" }}
        >
          {site.brand}
        </span>
        <div className="hidden items-center gap-7 text-[11px] text-white/60 sm:flex">
          <a href="#overview" className="transition-colors hover:text-white">Overview</a>
          <a href="#design" className="transition-colors hover:text-white">Design</a>
          <a href="#craft" className="transition-colors hover:text-white">Craft</a>
          <a href="#story" className="transition-colors hover:text-white">Story</a>
        </div>
        <Link
          to="/shop"
          className="rounded-full bg-white px-3.5 py-1 text-[11px] font-medium text-black transition-opacity hover:opacity-90"
        >
          Shop
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────── hero ───────────────────── */

function Hero() {
  const { ref, p } = useScrollProgress<HTMLDivElement>();
  const scale = 1 + p * 0.18;
  const y = p * -60;
  const titleOpacity = 1 - p * 1.4;

  return (
    <section
      ref={ref}
      id="overview"
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #1c1c1f 0%, #0a0a0b 55%, #000 100%)",
      }}
    >
      {/* halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 60%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%)",
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center px-6 pt-24 text-center">
        <p
          className="mb-4 text-[12px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: "linear-gradient(90deg,#ff8a3d,#ff5e9b,#7c5cff,#3dc6ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: titleOpacity,
          }}
        >
          {site.brand} — Studio Edition
        </p>

        <h1
          className="text-balance text-white"
          style={{
            fontFamily: "'SF Pro Display', -apple-system, system-ui",
            fontWeight: 600,
            fontSize: "clamp(56px, 9.5vw, 132px)",
            lineHeight: 0.95,
            letterSpacing: "-0.045em",
            opacity: titleOpacity,
          }}
        >
          Built for those who notice.
        </h1>
        <p
          className="mt-6 max-w-2xl text-balance text-[17px] font-light leading-relaxed text-white/70 sm:text-[20px]"
          style={{ opacity: titleOpacity }}
        >
          Heavyweight materials. Quiet construction. A point of view you can
          feel the moment you put it on.
        </p>
      </div>

      {/* product image */}
      <div
        className="absolute inset-x-0 bottom-0 z-0 flex items-end justify-center"
        style={{ transform: `translateY(${y}px) scale(${scale})`, transformOrigin: "50% 100%" }}
      >
        <img
          src={HERO}
          alt="Signature product"
          className="h-auto w-[78vw] max-w-[1100px] select-none object-contain"
          draggable={false}
          style={{ filter: "drop-shadow(0 60px 120px rgba(0,0,0,0.85))" }}
        />
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40">
        Scroll
      </div>
    </section>
  );
}

/* ───────────────────── feature row ───────────────────── */

function FeatureRow({
  eyebrow,
  title,
  body,
  side,
  treatment = "default",
}: {
  eyebrow: string;
  title: string;
  body: string;
  side: "left" | "right";
  treatment?: "default" | "mono" | "warm" | "cold";
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const { ref: pref, p } = useScrollProgress<HTMLDivElement>();
  const y = (p - 0.5) * -80;

  const filter =
    treatment === "mono"
      ? "grayscale(1) contrast(1.05) brightness(0.95)"
      : treatment === "warm"
      ? "saturate(1.2) hue-rotate(-10deg) brightness(1.02)"
      : treatment === "cold"
      ? "saturate(0.9) hue-rotate(180deg) brightness(0.9)"
      : "none";

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-32 sm:py-40"
      style={{ background: "#000" }}
    >
      <div
        className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 md:grid-cols-2"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(40px)",
          transition: "opacity 1s cubic-bezier(.16,1,.3,1), transform 1s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div className={side === "right" ? "md:order-2" : ""}>
          <p
            className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{
              background: "linear-gradient(90deg,#ff8a3d,#ff5e9b,#7c5cff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {eyebrow}
          </p>
          <h2
            className="text-white"
            style={{
              fontFamily: "'SF Pro Display', -apple-system, system-ui",
              fontSize: "clamp(38px, 5.4vw, 72px)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              fontWeight: 600,
            }}
          >
            {title}
          </h2>
          <p className="mt-6 max-w-md text-[16px] font-light leading-relaxed text-white/65 sm:text-[18px]">
            {body}
          </p>
        </div>

        <div
          ref={pref}
          className={side === "right" ? "md:order-1" : ""}
        >
          <div
            className="relative aspect-square w-full overflow-hidden rounded-[32px]"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, #1a1a1c 0%, #0a0a0b 70%, #000 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.02)",
            }}
          >
            <img
              src={HERO}
              alt={title}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain p-10 select-none"
              style={{
                transform: `translateY(${y}px) scale(1.04)`,
                filter,
                willChange: "transform",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── marquee strip ───────────────────── */

function GalleryStrip() {
  const items = ["MONO", "WARM", "COLD", "DEFAULT", "MONO", "WARM"];
  const filters: Record<string, string> = {
    MONO: "grayscale(1) contrast(1.05)",
    WARM: "saturate(1.25) hue-rotate(-12deg) brightness(1.03)",
    COLD: "saturate(0.85) hue-rotate(180deg) brightness(0.92)",
    DEFAULT: "none",
  };
  return (
    <section className="overflow-hidden bg-black py-24">
      <div className="mx-auto mb-10 max-w-[1200px] px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
          The Lineup
        </p>
        <h3
          className="mt-3 text-white"
          style={{
            fontFamily: "'SF Pro Display', -apple-system, system-ui",
            fontSize: "clamp(28px, 4vw, 48px)",
            letterSpacing: "-0.03em",
            fontWeight: 600,
          }}
        >
          Six finishes. One philosophy.
        </h3>
      </div>
      <div className="flex gap-6 overflow-x-auto px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((k, i) => (
          <div
            key={i}
            className="relative shrink-0 overflow-hidden rounded-[28px]"
            style={{
              width: "min(78vw, 420px)",
              aspectRatio: "3/4",
              background:
                "radial-gradient(circle at 50% 30%, #1a1a1c 0%, #0a0a0b 70%, #000 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <img
              src={HERO}
              alt={k}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain p-8 select-none"
              style={{ filter: filters[k] }}
            />
            <div className="absolute bottom-5 left-5 text-[10px] uppercase tracking-[0.3em] text-white/60">
              {k}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────── story / values ───────────────────── */

function Story() {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <section id="story" className="bg-black px-6 py-40">
      <div
        ref={ref}
        className="mx-auto max-w-[900px] text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "all 1s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <p
          className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em]"
          style={{
            background: "linear-gradient(90deg,#ff8a3d,#ff5e9b,#7c5cff,#3dc6ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          The Story
        </p>
        <h2
          className="text-white"
          style={{
            fontFamily: "'SF Pro Display', -apple-system, system-ui",
            fontSize: "clamp(38px, 6vw, 84px)",
            lineHeight: 1.04,
            letterSpacing: "-0.04em",
            fontWeight: 600,
          }}
        >
          A wardrobe of quiet conviction.
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-[18px] font-light leading-relaxed text-white/65 sm:text-[20px]">
          {site.brand} began as a refusal — refusal of trend cycles, of loud
          logos, of disposable seasons. Every piece is engineered to outlast
          the calendar and earn its place in your daily rotation.
        </p>
        <div className="mt-14 grid grid-cols-2 gap-8 text-left sm:grid-cols-4">
          {[
            ["240", "GSM heavyweight cotton"],
            ["07", "Production checkpoints"],
            ["100%", "Organic fibers"],
            ["∞", "Iteration on the details"],
          ].map(([n, l]) => (
            <div key={l}>
              <div
                className="text-white"
                style={{
                  fontFamily: "'SF Pro Display', -apple-system, system-ui",
                  fontSize: "clamp(36px, 4vw, 56px)",
                  letterSpacing: "-0.04em",
                  fontWeight: 600,
                }}
              >
                {n}
              </div>
              <div className="mt-1 text-[12px] uppercase tracking-[0.18em] text-white/45">
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── CTA ───────────────────── */

function CTA() {
  return (
    <section
      className="relative overflow-hidden px-6 py-40 text-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, #1a1a1c 0%, #0a0a0b 60%, #000 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.12), transparent 60%)",
        }}
      />
      <div className="relative">
        <h2
          className="mx-auto max-w-3xl text-white"
          style={{
            fontFamily: "'SF Pro Display', -apple-system, system-ui",
            fontSize: "clamp(40px, 6vw, 84px)",
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            fontWeight: 600,
          }}
        >
          Find your first one.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[16px] font-light leading-relaxed text-white/65 sm:text-[18px]">
          Explore the full collection — every piece built with the same
          obsessive attention to material, construction, and feel.
        </p>
        <Link
          to="/shop"
          className="mt-10 inline-block rounded-full bg-white px-8 py-4 text-[13px] font-semibold tracking-tight text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Shop the collection →
        </Link>
      </div>
    </section>
  );
}

/* ───────────────────── page ───────────────────── */

function About() {
  return (
    <div className="about-page w-full bg-black text-white" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui" }}>
      <ProNav />
      <Hero />
      <FeatureRow
        eyebrow="Design"
        title="Engineered in silence."
        body="No noise. No filler. Every panel, seam, and stitch exists for a reason — and the reasons are visible the moment you hold it."
        side="right"
        treatment="default"
      />
      <FeatureRow
        eyebrow="Material"
        title="240 GSM. Built to last."
        body="Heavyweight combed organic cotton with a tactile hand-feel that softens beautifully wash after wash, without losing its structure."
        side="left"
        treatment="mono"
      />
      <FeatureRow
        eyebrow="Craft"
        title="Detail you can feel."
        body="Reinforced collars, double-needle hems, and a relaxed silhouette designed to drape exactly the way the studio intended."
        side="right"
        treatment="warm"
      />
      <GalleryStrip />
      <Story />
      <CTA />
    </div>
  );
}
