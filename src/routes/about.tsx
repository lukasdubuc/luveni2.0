import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useRef, useState } from "react";
import { Shield, Sparkles, Eye, Users, ChevronLeft, ChevronRight } from "lucide-react";
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

// ─── APPLE STICKY LOCAL NAVIGATION ────────────────────────────────────────
function LocalNav({ onBuy }: { onBuy: () => void }) {
  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/80 border-b border-black/5 dark:border-white/5 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-tight text-foreground flex items-center gap-1.5">
          {site.brand} <span className="text-muted-foreground font-normal">Hardware Design</span>
        </span>
        <div className="flex items-center gap-6">
          <a href="#shirt-hero" className="text-[10px] font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors uppercase hidden sm:inline-block">GZ R-01</a>
          <a href="#details" className="text-[10px] font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors uppercase hidden sm:inline-block">Sub-Highlight</a>
          <a href="#story" className="text-[10px] font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors uppercase hidden sm:inline-block">Philosophy</a>
          <button
            onClick={onBuy}
            className="bg-foreground text-background text-[10px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full hover:opacity-90 active:scale-[0.97] transition-all"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FADE UP ENTRY EFFECT ─────────────────────────────────────────────────
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
      { threshold: 0.05, rootMargin: "0px 0px -60px 0px" }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── ROTATABLE 360° SUB-HIGHLIGHT (HEART DAD HAT) ─────────────────────────
function SubHighlightRotator() {
  const [angleIndex, setAngleIndex] = useState(0);

  // Array of hat angles mapped to your uploaded dad hat mockups
  const hatAngles = [
    { name: "Front View", src: "input_file_9.png" },       // Angle 0: Front flat
    { name: "Front Left", src: "input_file_5.png" },      // Angle 1: Front left tilt
    { name: "Left Profile", src: "input_file_4.png" },    // Angle 2: Left side showing embroidered heart
    { name: "Back View", src: "input_file_8.png" },       // Angle 3: Back adjuster buckle
    { name: "Right Profile", src: "input_file_7.png" },   // Angle 4: Right plain profile
    { name: "Front Right", src: "input_file_6.png" },     // Angle 5: Front right tilt
    { name: "Top-Down Angle", src: "input_file_10.png" }, // Angle 6: Top-down profile
  ];

  const handleNext = () => {
    setAngleIndex((prev) => (prev + 1) % hatAngles.length);
  };

  const handlePrev = () => {
    setAngleIndex((prev) => (prev - 1 + hatAngles.length) % hatAngles.length);
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-950/20 rounded-[28px] p-8 md:p-12 border border-black/5 dark:border-white/5 flex flex-col items-center">
      
      {/* Dynamic hardware visualization panel */}
      <div className="relative w-full aspect-square max-w-[320px] flex items-center justify-center overflow-hidden mb-6">
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(120,120,120,0.06) 0%, transparent 70%)",
          }}
        />
        <img
          src={hatAngles[angleIndex].src}
          alt={`Heart dad hat - ${hatAngles[angleIndex].name}`}
          className="max-h-[85%] max-w-[85%] object-contain select-none transition-all duration-300"
          style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.15))" }}
          draggable={false}
        />
      </div>

      {/* Manual angle timeline scrubbing system */}
      <div className="w-full max-w-xs space-y-4">
        <div className="flex items-center justify-between text-center">
          <button
            onClick={handlePrev}
            className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase block">Perspective</span>
            <span className="text-xs font-semibold text-foreground">{hatAngles[angleIndex].name}</span>
          </div>

          <button
            onClick={handleNext}
            className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Dynamic scrub bar slider */}
        <div className="relative pt-2">
          <input
            type="range"
            min="0"
            max={hatAngles.length - 1}
            value={angleIndex}
            onChange={(e) => setAngleIndex(Number(e.target.value))}
            className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-foreground"
          />
          <div className="flex justify-between text-[8px] font-mono text-muted-foreground mt-2 px-1">
            <span>0° FRONT</span>
            <span>180° REAR</span>
            <span>360° LOOP</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────
function About() {
  const handleAddToCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const item = {
        id: "f3cb47f6-0d11-4b97-9e3b-29d306607819",
        title: "GZ R-01 (organic, unisex)",
        price: 2800,
        image: "input_file_2.png", // Flat shirt mockup
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

  return (
    <div className="about-page w-full bg-background text-foreground selection:bg-neutral-800 transition-colors duration-300">
      
      {/* Local Sticky Nav bar */}
      <LocalNav onBuy={handleAddToCart} />

      {/* ══════════════════════════════════════════════════════════════════
          1. IMMERSIVE PRODUCT HERO (T-SHIRT)
          ══════════════════════════════════════════════════════════════════ */}
      <section id="shirt-hero" className="grid grid-cols-1 md:grid-cols-2 border-b border-black/10 dark:border-white/10" style={{ minHeight: "88vh" }}>
        
        {/* LEFT — Cinematic Stage (Transparent mockup vector on black background) */}
        <div className="relative bg-black flex items-center justify-center overflow-hidden h-[50vh] md:h-auto border-b md:border-b-0 md:border-r border-neutral-900">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 60%)",
            }}
          />
          <img
            src="input_file_2.png" // Image 3: Flat front shirt vector
            alt="GZ R-01 shirt mockup"
            className="max-h-[82%] max-w-[82%] object-contain select-none"
            style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))" }}
            draggable={false}
          />
          
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "8.5px",
                letterSpacing: "0.3em",
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
              }}
            >
              Model No: GZ R-01 · 240 GSM · $28
            </span>
          </div>
        </div>

        {/* RIGHT — Technical Specs Column */}
        <div className="flex flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-24">
          <FadeUp>
            <p
              className="text-muted-foreground uppercase mb-4"
              style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.28em" }}
            >
              The Signature Silhouette
            </p>

            <h1
              className="tracking-tighter text-foreground mb-6"
              style={{ fontSize: "clamp(34px, 5vw, 62px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.035em" }}
            >
              The one you<br />
              <span className="font-semibold text-foreground">reach for first.</span>
            </h1>

            <p className="text-sm leading-relaxed text-muted-foreground mb-10 max-w-md font-light">
              Heavyweight combed organic cotton. A bonsai mark reduced to its most essential form.
              The GZ R-01 is the piece Luveni was built around — designed for your rotation, not the rack.
            </p>

            {/* Structured Specifications Panel */}
            <div className="grid grid-cols-2 mb-10 border-t border-b border-black/10 dark:border-white/10">
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
                    borderRight: i % 2 === 0 ? "1px solid rgba(128,128,128,0.15)" : "none",
                    borderBottom: i < 2 ? "1px solid rgba(128,128,128,0.15)" : "none",
                  }}
                >
                  <span
                    className="text-muted-foreground uppercase block mb-1"
                    style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.18em" }}
                  >
                    {label}
                  </span>
                  <span className="text-foreground text-xs font-semibold">{val}</span>
                </div>
              ))}
            </div>

            {/* Price block and Button */}
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div>
                <span
                  className="text-muted-foreground uppercase block mb-1"
                  style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.18em" }}
                >
                  Retail Price
                </span>
                <span className="text-foreground tracking-tighter" style={{ fontSize: "36px", fontWeight: 200 }}>
                  $28
                </span>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-1 max-w-xs bg-foreground text-background hover:opacity-90 active:scale-[0.97] transition-all py-4 px-8 border-none cursor-pointer rounded-full"
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Add to Cart
              </button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2. DETAILED BENTO GRID (APPLE OS GALLERY)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-black/10 dark:border-white/10 py-16 md:py-24 bg-muted/15">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          
          <FadeUp>
            <div className="max-w-lg">
              <span className="text-[9px] font-mono tracking-[0.25em] text-muted-foreground uppercase block mb-2">Detailed View</span>
              <h2 className="text-3xl font-light tracking-tighter text-foreground mb-4">Every detail, meticulously resolved.</h2>
              <p className="text-xs text-muted-foreground leading-relaxed font-light">
                Combed organic cotton paired with dynamic embroidery. High-fidelity textures built to sit consistently in your wardrobe rotation.
              </p>
            </div>
          </FadeUp>

          {/* Clean Bento Deck */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bento Card 1: Wide lifestyle image */}
            <div className="md:col-span-2 bg-background border border-black/5 dark:border-white/5 rounded-[28px] overflow-hidden flex flex-col justify-between">
              <div className="h-[280px] md:h-[380px] overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                <img
                  src="input_file_3.png" // Image 4: Model wearing the shirt
                  alt="Luveni GZ R-01 model mockup"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">01 / FIT</span>
                <h3 className="text-base font-semibold text-foreground mb-2">Structured Drape</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-light">
                  Tailored to maintain a relaxed, modern profile that sits cleanly across the chest and shoulders.
                </p>
              </div>
            </div>

            {/* Bento Card 2: Stacked technical assets */}
            <div className="space-y-6">
              
              {/* Box 1: Folded shirt asset */}
              <div className="bg-background border border-black/5 dark:border-white/5 rounded-[28px] p-6 flex flex-col justify-between h-[230px] overflow-hidden">
                <div className="h-[100px] flex items-center justify-center overflow-hidden">
                  <img src="input_file_1.png" alt="Folded shirt flatlay" className="max-h-full object-contain" /> {/* Image 2: Folded shirt flatlay */}
                </div>
                <div>
                  <span className="text-[8px] font-mono text-muted-foreground uppercase block">02 / STORAGE</span>
                  <h4 className="text-xs font-semibold text-foreground mt-1">Packable Uniformity</h4>
                </div>
              </div>

              {/* Box 2: Isolated flat logo vector */}
              <div className="bg-background border border-black/5 dark:border-white/5 rounded-[28px] p-6 flex flex-col justify-between h-[230px] overflow-hidden">
                <div className="h-[100px] flex items-center justify-center overflow-hidden">
                  <img src="input_file_0.png" alt="Isolated art logo" className="max-h-full object-contain" /> {/* Image 1: Isolated logo graphic */}
                </div>
                <div>
                  <span className="text-[8px] font-mono text-muted-foreground uppercase block">03 / ICONOGRAPHY</span>
                  <h4 className="text-xs font-semibold text-foreground mt-1">Intricate Emblem</h4>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3. SUB-HIGHLIGHT SECTION (EMBROIDERED HEART DAD HAT)
          ══════════════════════════════════════════════════════════════════ */}
      <section id="details" className="border-b border-black/10 dark:border-white/10 py-16 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Left Column: Interactive rotator widget */}
            <SubHighlightRotator />

            {/* Right Column: Descriptions */}
            <div className="space-y-6">
              <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground uppercase block">The Accessory Hook</span>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tighter text-foreground leading-none">
                Heart dad hat.<br />
                <span className="font-semibold">Pure embroidery.</span>
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground font-light max-w-md">
                A classic structured profile, embroidered with our signature heart graphic. 
                Built with robust Chino Twill, a custom brass strap slider, and ventilation eyelets to combine standard daily durability with high tactile wearability.
              </p>

              {/* Dad Hat Technical Specs */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-black/5 dark:border-white/5">
                <div>
                  <span className="text-[8.5px] font-mono tracking-widest text-muted-foreground uppercase block">Composition</span>
                  <span className="text-xs font-semibold text-foreground mt-1 block">100% Chino Twill Cotton</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-mono tracking-widest text-muted-foreground uppercase block">Profile</span>
                  <span className="text-xs font-semibold text-foreground mt-1 block">Low-profile / 6-panel</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-mono tracking-widest text-muted-foreground uppercase block">Strap Closure</span>
                  <span className="text-xs font-semibold text-foreground mt-1 block">Adjustable buckle slider</span>
                </div>
                <div>
                  <span className="text-[8.5px] font-mono tracking-widest text-muted-foreground uppercase block">Details</span>
                  <span className="text-xs font-semibold text-foreground mt-1 block">Embroidered front relief</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4. BRAND STORY + PHILOSOPHY DECK
          ══════════════════════════════════════════════════════════════════ */}
      <section id="story" className="border-b border-black/10 dark:border-white/10 bg-muted/5">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Left Column: Story text (original prompt context) */}
          <div className="px-8 py-16 sm:px-12 md:px-16 lg:px-24 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10">
            <FadeUp>
              <p
                className="text-muted-foreground uppercase mb-5"
                style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}
              >
                Our philosophy
              </p>
              <h2
                className="text-foreground mb-8 tracking-tighter"
                style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 200, lineHeight: 1.15 }}
              >
                Cut through the noise<br />of fast fashion.
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground font-light">
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

              <div className="mt-10 pt-8 border-t border-black/10 dark:border-white/10">
                <p
                  className="text-muted-foreground uppercase mb-4"
                  style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.22em" }}
                >
                  Strict Design Standards
                </p>
                <ul className="space-y-3">
                  {[
                    "Quality through simplicity.",
                    "Minimalist design, maximum impact.",
                    "Pieces made to be worn, not just owned.",
                    "Commitment to timeless, elevated essentials.",
                  ].map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 font-light">
                      <span className="mt-[6.5px] w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 opacity-65" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10 pt-6 border-t border-black/10 dark:border-white/10 text-xs text-muted-foreground font-light">
                Support inquiries /{" "}
                <a
                  href="mailto:luveni.apparel@gmail.com"
                  className="text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  luveni.apparel@gmail.com
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Right Column: Values grid */}
          <div className="px-8 py-16 sm:px-12 md:px-16 lg:px-24 flex items-center bg-muted/20">
            <FadeUp delay={120}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-10">
                {values.map((v, i) => {
                  const Icon = v.icon;
                  return (
                    <div key={i} className="space-y-4">
                      <div className="w-9 h-9 rounded-full bg-background flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm">
                        <Icon size={14} className="text-foreground" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground tracking-tight">{v.title}</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground font-light">
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
          5. THE EDITORIAL GRID BANNER
          ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden border-b border-black/10 dark:border-white/10"
        style={{ height: "clamp(300px, 48vw, 580px)" }}
      >
        <ParallaxImage
          src="input_file_3.png" // Image 4: Model wearing the shirt
          alt="Luveni fabric closeup"
        />
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ background: "linear-gradient(rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.5) 100%)" }}
        >
          <FadeUp>
            <p
              className="uppercase mb-3"
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                letterSpacing: "0.32em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Luveni Core Systems · {new Date().getFullYear()}
            </p>
            <p
              className="tracking-tighter text-white"
              style={{
                fontSize: "clamp(26px, 4.5vw, 52px)",
                fontWeight: 100,
                lineHeight: 1.1,
              }}
            >
              Designed for the<br />
              <span className="font-medium text-white">everyday uniform.</span>
            </p>
          </FadeUp>
        </div>
      </section>

    </div>
  );
}
