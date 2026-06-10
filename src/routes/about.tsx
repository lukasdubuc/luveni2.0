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

// ─── STATIC DATA CONFIGS (LOVABLE WRITER: REPLACE THESE WITH THE STAGED UUID FILENAMES) ───
const DETAILS = [
  {
    img: "/lovable-uploads/input_file_1.png", // [Lovable: Replace with folded shirt mockup filename]
    label: "Construction",
    heading: "Reinforced Collar",
    copy: "Double-needle neck ribbing designed to hold structured form wash after wash.",
  },
  {
    img: "/lovable-uploads/input_file_0.png", // [Lovable: Replace with transparent logo mockup filename]
    label: "Iconography",
    heading: "Kuffiyeh & Butterfly Emblem",
    copy: "Our signature front relief composition, balancing resilience, patience, and growth.",
  },
  {
    img: "/lovable-uploads/input_file_2.png", // [Lovable: Replace with flat front shirt mockup filename]
    label: "Material",
    heading: "240 GSM Combed Cotton",
    copy: "Heavyweight tactile hand-feel that drapes seamlessly for high daily breathability.",
  },
];

const VALUES = [
  { icon: Shield, title: "Quality", desc: "Highest-grade fabrics selected to endure years of wear and wash." },
  { icon: Sparkles, title: "Timeless", desc: "Silhouettes designed to outlast whatever season they drop in." },
  { icon: Eye, title: "Minimal", desc: "Everything superfluous removed. Only the essential remains." },
  { icon: Users, title: "Community", desc: "Built for real people in real fits — not for a runway." },
];

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
      imgRef.current.style.transform = `translateY(${clampedProgress * -50}px) scale(1.10)`;
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
        className="w-full h-full object-cover animate-fade-in"
        style={{ transition: "transform 0.1s linear", willChange: "transform" }}
      />
    </div>
  );
}

// ─── DUAL-VIEW HERO INTERACTIVE STAGE (FLAT VS MODEL) ────────────────────
function InteractiveHeroStage() {
  const [activeTab, setActiveTab] = useState<"flat" | "model">("flat");
  const containerRef = useRef<HTMLDivElement>(null);
  const flatImgRef = useRef<HTMLImageElement>(null);
  const modelImgRef = useRef<HTMLImageElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, 1 - rect.bottom / (vh + rect.height)));
      
      const scaleVal = 1 + progress * 0.12;
      if (flatImgRef.current) flatImgRef.current.style.transform = `scale(${scaleVal})`;
      if (modelImgRef.current) modelImgRef.current.style.transform = `scale(${scaleVal})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setEntered(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-neutral-50/50 dark:bg-neutral-950/20 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 overflow-hidden flex flex-col justify-between"
      style={{ minHeight: "65vh" }}
    >
      {/* Dynamic spotlight backlighting */}
      <div
        className="absolute inset-0 pointer-events-none rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(120,120,120,0.04) 0%, transparent 65%)",
        }}
      />

      {/* Blueprint background grid lines for a precise CAD aesthetic */}
      <div className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-10" style={{
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 0)",
        backgroundSize: "24px 24px"
      }} />

      <div className="flex-1 w-full relative flex items-center justify-center p-8">
        {/* Frame A: Flat Mockup View */}
        <img
          ref={flatImgRef}
          src="/lovable-uploads/input_file_2.png" // [Lovable: Replace with flat front shirt mockup UUID]
          alt="GZ R-01 tee front layout"
          className="absolute max-h-[82%] max-w-[82%] object-contain select-none transition-all duration-750 ease-out"
          style={{
            opacity: activeTab === "flat" && entered ? 1 : 0,
            visibility: activeTab === "flat" ? "visible" : "hidden",
            filter: "drop-shadow(0 20px 45px rgba(0,0,0,0.08))",
          }}
          draggable={false}
        />

        {/* Frame B: On-Model Lifestyle View */}
        <img
          ref={modelImgRef}
          src="/lovable-uploads/input_file_3.png" // [Lovable: Replace with model wearing GZ R-01 shirt UUID]
          alt="GZ R-01 tee on model"
          className="absolute max-h-[82%] max-w-[82%] object-contain select-none transition-all duration-750 ease-out rounded-2xl"
          style={{
            opacity: activeTab === "model" && entered ? 1 : 0,
            visibility: activeTab === "model" ? "visible" : "hidden",
            filter: "drop-shadow(0 20px 45px rgba(0,0,0,0.12))",
          }}
          draggable={false}
        />
      </div>

      <div className="relative z-20 pb-6 w-full flex flex-col items-center gap-3">
        <div className="flex p-0.5 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 backdrop-blur-sm border border-black/5">
          <button
            onClick={() => setActiveTab("flat")}
            className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${
              activeTab === "flat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Flat Layout
          </button>
          <button
            onClick={() => setActiveTab("model")}
            className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${
              activeTab === "model"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            On Model
          </button>
        </div>
        
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "8.5px",
            letterSpacing: "0.3em",
            color: "var(--color-muted-foreground)",
            textTransform: "uppercase",
          }}
          className="opacity-60"
        >
          Signature GZ R-01 Tee
        </span>
      </div>
    </div>
  );
}

// ─── ROTATABLE 360° ZERO-LAG STACKED ROTATOR (HEART DAD HAT) ──────────────
function SubHighlightRotator() {
  const [angleIndex, setAngleIndex] = useState(0);

  // Stacked arrays mapped using exact compile-directive relative imports
  const hatAngles = [
    { name: "Front Flat View", src: "/lovable-uploads/input_file_9.png" }, // [Lovable: Replace with hat front view UUID]
    { name: "Front Left Tilt", src: "/lovable-uploads/input_file_5.png" }, // [Lovable: Replace with hat front left UUID]
    { name: "Left Profile (Logo Detail)", src: "/lovable-uploads/input_file_4.png" }, // [Lovable: Replace with hat left profile UUID]
    { name: "Back View (Brass Adjuster)", src: "/lovable-uploads/input_file_8.png" }, // [Lovable: Replace with hat back view UUID]
    { name: "Right Profile (Minimal)", src: "/lovable-uploads/input_file_7.png" }, // [Lovable: Replace with hat right profile UUID]
    { name: "Front Right Tilt", src: "/lovable-uploads/input_file_6.png" }, // [Lovable: Replace with hat front right UUID]
    { name: "Top-Down View", src: "/lovable-uploads/input_file_10.png" }, // [Lovable: Replace with hat top down UUID]
  ];

  const handleNext = () => {
    setAngleIndex((prev) => (prev + 1) % hatAngles.length);
  };

  const handlePrev = () => {
    setAngleIndex((prev) => (prev - 1 + hatAngles.length) % hatAngles.length);
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-950/20 rounded-[28px] p-8 md:p-12 border border-black/5 dark:border-white/5 flex flex-col items-center w-full">
      
      {/* 360° Stack Stage - Preloads all images inside absolute layout to guarantee zero lag */}
      <div className="relative w-full aspect-square max-w-[320px] flex items-center justify-center overflow-hidden mb-6">
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(120,120,120,0.06) 0%, transparent 70%)",
          }}
        />
        
        {hatAngles.map((angle, idx) => (
          <img
            key={idx}
            src={angle.src}
            alt={`Heart dad hat angle - ${angle.name}`}
            className="absolute max-h-[85%] max-w-[85%] object-contain select-none transition-all duration-300"
            style={{
              opacity: angleIndex === idx ? 1 : 0,
              visibility: angleIndex === idx ? "visible" : "hidden",
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.12))",
            }}
            draggable={false}
          />
        ))}
      </div>

      {/* Controller Controls */}
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

        {/* Scrub Slider */}
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
        image: "/lovable-uploads/input_file_2.png", // [Lovable: Replace with flat front shirt mockup UUID]
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
      
      {/* Sticky Navigation Subheader */}
      <LocalNav onBuy={handleAddToCart} />

      {/* ══════════════════════════════════════════════════════════════════
          1. CINEMATIC PRODUCT HERO (SHIRT)
          ══════════════════════════════════════════════════════════════════ */}
      <section id="shirt-hero" className="grid grid-cols-1 md:grid-cols-2 border-b border-black/10 dark:border-white/10" style={{ minHeight: "88vh" }}>
        
        {/* LEFT — Seamless Dynamic Spotlight Viewer */}
        <div className="relative">
          <InteractiveHeroStage />
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
              Heavyweight combed organic cotton. Marked by the resilient Kuffiyeh Girl print—a subtle cultural emblem that is balanced, slow, and persistent.
              The GZ R-01 is the piece Luveni was built around — designed for your rotation, not the rack.
            </p>

            {/* Technical Specification Matrix */}
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

            {/* Price Block & Action CTA */}
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
          2. THE CORE GRID — THREE SYSTEM CLOSE-UP TILES (DETAILS)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        id="details"
        ref={zoomRef}
        className="border-b border-black/10 dark:border-white/10 bg-background"
      >
        <div className="px-8 py-12 sm:px-12 border-b border-black/10 dark:border-white/10">
          <FadeUp>
            <p
              className="text-muted-foreground uppercase mb-2"
              style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}
            >
              Structure Detail
            </p>
            <h2
              className="text-foreground tracking-tighter"
              style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 200 }}
            >
              Every thread, considered.
            </h2>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3">
          {DETAILS.map((d, i) => (
            <div
              key={i}
              className="group flex flex-col justify-between"
              style={{
                borderRight: i < 2 ? "1px solid rgba(128,128,128,0.12)" : "none",
                opacity: zoomVisible ? 1 : 0,
                transform: zoomVisible ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 150}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 150}ms`,
              }}
            >
              {/* Detailed Asset Framing */}
              <div
                className="w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center p-6"
                style={{ height: "clamp(280px, 34vw, 440px)" }}
              >
                <img
                  src={d.img}
                  alt={d.heading}
                  className="max-h-[90%] max-w-[90%] object-contain transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  style={{ display: "block" }}
                />
              </div>
              
              <div className="px-8 py-8 border-t border-black/5 dark:border-white/5 bg-background">
                <p
                  className="text-muted-foreground uppercase mb-3"
                  style={{ fontFamily: "monospace", fontSize: "9.5px", letterSpacing: "0.2em" }}
                >
                  {String(i + 1).padStart(2, "0")} / {d.label}
                </p>
                <h3 className="text-foreground text-base font-semibold mb-2">{d.heading}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed font-light">{d.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3. SUB-HIGHLIGHT ROTATOR GALLERY (HAT)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-black/10 dark:border-white/10 py-16 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Seamless 360° Rotator Panel */}
            <SubHighlightRotator />

            {/* Spec Descriptions */}
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

          {/* Left Column: Story Text */}
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
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground font-light font-sans">
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
                <ul className="space-y-3 font-sans">
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

              <div className="mt-10 pt-6 border-t border-black/10 dark:border-white/10 text-xs text-muted-foreground font-light font-mono">
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

          {/* Right Column: Values Grid */}
          <div className="px-8 py-16 sm:px-12 md:px-16 lg:px-24 flex items-center bg-muted/20">
            <FadeUp delay={120}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-10 font-sans">
                {VALUES.map((v, i) => {
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
          5. EDITORIAL CREDITS PANEL (MODEL HERO BANNER)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden border-b border-black/10 dark:border-white/10"
        style={{ height: "clamp(300px, 48vw, 580px)" }}
      >
        <ParallaxImage
          src="/lovable-uploads/input_file_3.png" // [Lovable: Replace with model wearing GZ R-01 shirt UUID]
          alt="Luveni model closeup detail"
        />
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ background: "linear-gradient(rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)" }}
        >
          <FadeUp>
            <p
              className="uppercase mb-3 font-semibold font-mono"
              style={{
                fontSize: "9px",
                letterSpacing: "0.32em",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Luveni Core Systems · {new Date().getFullYear()}
            </p>
            <p
              className="tracking-tighter text-white font-extralight font-sans"
              style={{
                fontSize: "clamp(26px, 4.5vw, 52px)",
                lineHeight: 1.1,
              }}
            >
              Designed for the<br />
              <span className="font-semibold text-white">everyday uniform.</span>
            </p>
          </FadeUp>
        </div>
      </section>

    </div>
  );
}
