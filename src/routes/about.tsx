import { createFileRoute, Link } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useRef, useState } from "react";
import { Shield, Sparkles, Eye, Users, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About ${site.brand}` },
      { name: "description", content: `Discover the story and craft behind ${site.brand}.` },
    ],
  }),
  component: About,
});

// ─── STABLE ROOT-RELATIVE STATIC ASSETS (DIRECT FROM YOUR PUBLIC FOLDER) ───
const SHIRT_FLAT = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a4546cf.png";
const SHIRT_FOLDED = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a454c19.png";
const SHIRT_MODEL = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a4550cd.png";
const SHIRT_LOGO = "/design-lab-upscaled-6a25d1f65103a2.77471166-1780863478.png";

const HAT_ANGLE_0 = "/classic-dad-hat-black-front-6a28d8da62cc9.png";
const HAT_ANGLE_1 = "/classic-dad-hat-black-left-front-6a28d8da63cca.png";
const HAT_ANGLE_2 = "/classic-dad-hat-black-left-side-6a28d8da636fd.png";
const HAT_ANGLE_3 = "/classic-dad-hat-black-back-6a28d8da63130.png";
const HAT_ANGLE_4 = "/classic-dad-hat-black-right-side-6a28d8da633f3.png";
const HAT_ANGLE_5 = "/classic-dad-hat-black-right-front-6a28d8da639e0.png";

// ─── HOVER/SCROLL GRID BLUEPRINT ──────────────────────────────────────────
function BlueprintGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0" style={{
      backgroundImage: `
        linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)
      `,
      backgroundSize: "40px 44px"
    }} />
  );
}

// ─── APPLE LOCAL SUB-NAV ──────────────────────────────────────────────────
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
          <a href="#anatomy" className="transition-colors hover:text-white">Anatomy</a>
          <a href="#rotator" className="transition-colors hover:text-white">Perspectives</a>
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

// ─── MOTION ENTRY EFFECT (INTERSECTION DRIVEN) ───────────────────────────
function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
      className="motion-reduce:opacity-100 motion-reduce:transform-none"
    >
      {children}
    </div>
  );
}

// ─── HEROBAND PARALLAX LAYER ──────────────────────────────────────────────
function ParallaxImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onScroll = () => {
      if (!ref.current || !imgRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - (rect.bottom / (vh + rect.height));
      imgRef.current.style.transform = `translateY(${Math.max(0, Math.min(1, progress)) * -50}px) scale(1.10)`;
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
        style={{ transition: "transform 0.1s linear, opacity 0.5s ease-out", willChange: "transform" }}
      />
    </div>
  );
}

// ─── DUAL-VIEW HERO INTERACTIVE STAGE (FLAT VS MODEL) ────────────────────
interface HeroStageProps {
  shirtFlat: string;
  shirtModel: string;
  shirtLogo: string;
}

function InteractiveHeroStage({ shirtFlat, shirtModel, shirtLogo }: HeroStageProps) {
  const [activeTab, setActiveTab] = useState<"flat" | "model">("flat");
  const containerRef = useRef<HTMLDivElement>(null);
  const flatImgRef = useRef<HTMLImageElement>(null);
  const modelImgRef = useRef<HTMLImageElement>(null);
  const [entered, setEntered] = useState(false);
  const [scrollP, setScrollP] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, 1 - rect.bottom / (vh + rect.height)));
      setScrollP(progress);

      const scaleVal = 1 + progress * 0.12;
      if (flatImgRef.current) flatImgRef.current.style.transform = `scale(${scaleVal})`;
      if (modelImgRef.current) modelImgRef.current.style.transform = `scale(${scaleVal})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setEntered(true); obs.disconnect(); } }, { threshold: 0.05 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-neutral-950 overflow-hidden flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5"
      style={{ minHeight: "65vh" }}
    >
      <BlueprintGrid />

      <div
        className="absolute inset-0 pointer-events-none rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 65%)",
        }}
      />

      <div className="flex-1 w-full relative flex items-center justify-center p-8">
        {/* Frame A: Flat Mockup View */}
        <img
          ref={flatImgRef}
          src={shirtFlat}
          alt="GZ R-01 tee front layout"
          className="absolute max-h-[82%] max-w-[82%] object-contain select-none transition-all duration-750 ease-out"
          style={{
            opacity: activeTab === "flat" && entered ? 1 : 0,
            visibility: activeTab === "flat" ? "visible" : "hidden",
            filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))",
          }}
          draggable={false}
        />

        {/* Frame B: On-Model Lifestyle View */}
        <img
          ref={modelImgRef}
          src={shirtModel}
          alt="GZ R-01 tee on model"
          className="absolute max-h-[82%] max-w-[82%] object-contain select-none transition-all duration-750 ease-out rounded-2xl"
          style={{
            opacity: activeTab === "model" && entered ? 1 : 0,
            visibility: activeTab === "model" ? "visible" : "hidden",
            filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))",
          }}
          draggable={false}
        />
      </div>

      <div className="relative z-20 pb-6 w-full flex flex-col items-center gap-3">
        <div className="flex p-0.5 rounded-full bg-neutral-900 border border-white/5 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab("flat")}
            className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${
              activeTab === "flat"
                ? "bg-white text-black shadow-sm"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            Flat Layout
          </button>
          <button
            onClick={() => setActiveTab("model")}
            className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${
              activeTab === "model"
                ? "bg-white text-black shadow-sm"
                : "text-neutral-500 hover:text-white"
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
            color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase",
          }}
        >
          Signature GZ R-01 Tee
        </span>
      </div>
    </div>
  );
}

// ─── ROTATABLE 360° ZERO-LAG STACKED ROTATOR (HEART DAD HAT) ──────────────
interface RotatorProps {
  hatAngles: Array<{ name: string; src: string }>;
}

function ScrollRotator({ hatAngles }: RotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [angleIndex, setAngleIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = -rect.top / (rect.height - vh);
      const clamped = Math.max(0, Math.min(0.99, progress));
      setAngleIndex(Math.floor(clamped * 6));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      className="bg-neutral-950 rounded-[28px] p-8 md:p-12 border border-white/5 flex flex-col items-center w-full relative"
      style={{ minHeight: "220vh" }}
    >
      <BlueprintGrid />
      
      {/* 360° Stack Stage - Preloads all images inside absolute layout to guarantee zero lag */}
      <div className="sticky top-1/4 w-full aspect-square max-w-[320px] flex items-center justify-center overflow-hidden mb-6 z-10">
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.035) 0%, transparent 70%)",
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
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.85))",
            }}
            draggable={false}
          />
        ))}
      </div>

      {/* Controller Controls */}
      <div className="sticky bottom-10 w-full max-w-xs space-y-4 z-10">
        <div className="flex items-center justify-between text-center">
          <button
            onClick={handlePrev}
            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-all active:scale-90"
          >
            <ChevronLeft size={14} />
          </button>
          
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase block">Perspective</span>
            <span className="text-[11px] font-medium text-white">{hatAngles[angleIndex]?.name || "Perspective"}</span>
          </div>

          <button
            onClick={handleNext}
            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-all active:scale-90"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex justify-center items-center gap-1.5 pt-2">
          {hatAngles.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setAngleIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                angleIndex === idx ? "w-4 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );

  function handleNext() { setAngleIndex((prev) => (prev + 1) % hatAngles.length); }
  function handlePrev() { setAngleIndex((prev) => (prev - 1 + hatAngles.length) % hatAngles.length); }
}

// ─── ANATOMY DETAIL ROWS (DETAILS LOOP) ───────────────────────────────────
interface FeatureRowProps {
  eyebrow: string;
  title: string;
  body: string;
  side: "left" | "right";
  src: string;
}

function FeatureRow({ eyebrow, title, body, side, src }: FeatureRowProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const { ref: pref, p } = useScrollProgress<HTMLDivElement>();
  const y = (p - 0.5) * -60;

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-24 sm:py-36 border-b border-white/5 bg-black"
    >
      <div
        className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 md:grid-cols-2"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.9s cubic-bezier(.16,1,.3,1), transform 0.9s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div className={side === "right" ? "md:order-2" : ""}>
          <p className="mb-4 text-[10px] font-mono tracking-[0.24em] text-neutral-500 uppercase">{eyebrow}</p>
          <h2 className="text-white tracking-tighter" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui", fontSize: "clamp(34px, 4.8vw, 64px)", lineHeight: 1.04, fontWeight: 200 }}>{title}</h2>
          <p className="mt-5 max-w-md text-[14px] font-light leading-relaxed text-neutral-400 font-sans">{body}</p>
        </div>

        <div ref={pref} className={side === "right" ? "md:order-1" : ""}>
          <div
            className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-neutral-950 flex items-center justify-center p-8"
            style={{ border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 25px 60px rgba(0,0,0,0.8)" }}
          >
            <BlueprintGrid />
            <img
              src={src}
              alt={title}
              draggable={false}
              className="max-h-[85%] max-w-[85%] object-contain select-none transition-transform duration-100"
              style={{ transform: `translateY(${y}px) scale(1.02)`, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.5))", willChange: "transform" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────
function About() {
  const zoomRef = useRef<HTMLDivElement>(null);
  const [zoomVisible, setZoomVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setZoomVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    if (zoomRef.current) obs.observe(zoomRef.current);
    return () => obs.disconnect();
  }, []);

  const DETAILS = [
    {
      img: SHIRT_FOLDED,
      label: "Construction",
      heading: "Reinforced Collar",
      copy: "Double-needle neck ribbing designed to hold structured form wash after wash.",
    },
    {
      img: SHIRT_LOGO,
      label: "Iconography",
      heading: "Kuffiyeh & Butterfly Emblem",
      copy: "Our signature front relief composition, balancing resilience, patience, and growth.",
    },
    {
      img: SHIRT_FLAT,
      label: "Material",
      heading: "240 GSM Combed Cotton",
      copy: "Heavyweight tactile hand-feel that drapes seamlessly for high daily breathability.",
    },
  ];

  const VALUES = [
    { icon: Shield, title: "Quality first", desc: "Combed, heavyweight organic cotton crafted to resist distortion and wear over time." },
    { icon: Sparkles, title: "Beyond trends", desc: "Relaxed silhouettes and neutral colorways designed to outlive fast fashion cycles." },
    { icon: Eye, title: "Radical focus", desc: "Deliberate removal of visual noise to bring premium materials and cuts to focus." },
    { icon: Users, title: "Conscious connection", desc: "Connecting small-batch producers with wearers who value intentional craftsmanship." },
  ];

  const hatAngles = [
    { name: "Front Flat View", src: HAT_ANGLE_0 },
    { name: "Front Left Tilt", src: HAT_ANGLE_1 },
    { name: "Left Profile (Logo Detail)", src: HAT_ANGLE_2 },
    { name: "Back View (Brass Adjuster)", src: HAT_ANGLE_3 },
    { name: "Right Profile (Minimal)", src: HAT_ANGLE_4 },
    { name: "Front Right Tilt", src: HAT_ANGLE_5 },
  ];

  return (
    <div className="about-page w-full bg-black text-white selection:bg-neutral-800 transition-colors duration-300" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui" }}>
      
      <ProNav />

      {/* 2. CINEMATIC PRODUCT HERO */}
      <section id="shirt-hero" className="grid grid-cols-1 md:grid-cols-2 border-b border-white/5" style={{ minHeight: "88vh" }}>
        <div className="relative">
          <InteractiveHeroStage shirtFlat={SHIRT_FLAT} shirtModel={SHIRT_MODEL} shirtLogo={SHIRT_LOGO} />
        </div>

        <div className="flex flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-24">
          <FadeUp>
            <p className="text-neutral-500 uppercase mb-4" style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.28em" }}>The Signature Silhouette</p>
            <h1 className="tracking-tighter text-white mb-6" style={{ fontSize: "clamp(34px, 5vw, 62px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.035em" }}>
              The one you<br />
              <span className="font-semibold text-white">reach for first.</span>
            </h1>
            <p className="text-sm leading-relaxed text-neutral-400 mb-10 max-w-md font-light font-sans">
              Heavyweight combed organic cotton. Marked by the resilient Kuffiyeh Girl print—a subtle cultural emblem that is balanced, slow, and persistent.
              The GZ R-01 is the piece Luveni was built around — designed for your rotation, not the rack.
            </p>

            <div className="grid grid-cols-2 mb-10 border-t border-b border-white/5">
              {[
                ["Material", "100% Organic Cotton"],
                ["Fit", "Relaxed / Boxy"],
                ["Weight", "Heavyweight 240 GSM"],
                ["Care", "Machine Wash Cold"],
              ].map(([label, val], i) => (
                <div key={i} className="py-4 pr-6" style={{ borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.05)" : "none", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <span className="text-neutral-500 uppercase block mb-1" style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.18em" }}>{label}</span>
                  <span className="text-white text-xs font-semibold">{val}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">Hardware Price</span>
              <span className="text-3xl font-light tracking-tighter text-white ml-2">$28</span>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* 3. CORE BLUEPRINT GRID */}
      <section id="anatomy" ref={zoomRef} className="border-b border-white/5 bg-black">
        <div className="px-8 py-12 sm:px-12 border-b border-white/5">
          <FadeUp>
            <p className="text-neutral-500 uppercase mb-2" style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}>Structure Detail</p>
            <h2 className="text-white tracking-tighter" style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 200 }}>Every thread, considered.</h2>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3">
          {DETAILS.map((d, i) => (
            <div key={i} className="group flex flex-col justify-between" style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none", opacity: zoomVisible ? 1 : 0, transform: zoomVisible ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 150}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 150}ms` }}>
              <div className="w-full overflow-hidden bg-neutral-950 flex items-center justify-center p-6 border-b border-white/5" style={{ height: "clamp(280px, 34vw, 440px)" }}>
                <img src={d.img} alt={d.heading} className="max-h-[90%] max-w-[90%] object-contain transition-transform duration-700 ease-out group-hover:scale-[1.04]" style={{ display: "block" }} />
              </div>
              <div className="px-8 py-8 bg-black">
                <p className="text-neutral-500 uppercase mb-3" style={{ fontFamily: "monospace", fontSize: "9.5px", letterSpacing: "0.2em" }}>{String(i + 1).padStart(2, "0")} / {d.label}</p>
                <h3 className="text-white text-base font-semibold mb-2">{d.heading}</h3>
                <p className="text-neutral-400 text-xs leading-relaxed font-light font-sans">{d.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. HIGH-RESOLUTION ROTATIVE SUB-HIGHLIGHT */}
      <section id="rotator" className="border-b border-white/5 bg-black py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <ScrollRotator hatAngles={hatAngles} />
            <div className="space-y-6">
              <span className="text-[10px] font-mono tracking-[0.25em] text-neutral-500 uppercase block">Sub-Highlight Piece</span>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tighter text-white leading-none">Embroidered Dad Hat.<br /><span className="font-semibold">Zero visual lag.</span></h2>
              <p className="text-sm leading-relaxed text-neutral-400 font-light font-sans max-w-md">A classic low-profile structure embroidered with our signature heart mark. Built with premium heavy chino cotton, a customized adjustable brass buckle closure, and layered visual angles designed for consistent, high-contrast style.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BRAND STORY */}
      <section id="story" className="border-b border-white/5 bg-neutral-950">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="px-8 py-16 sm:px-12 md:px-16 lg:px-24 border-b md:border-b-0 md:border-r border-white/5">
            <FadeUp>
              <p className="text-neutral-500 uppercase mb-5" style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.26em" }}>Our philosophy</p>
              <h2 className="text-white mb-8 tracking-tighter" style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 200, lineHeight: 1.15 }}>Cut through the noise<br />of fast fashion.</h2>
              <div className="space-y-4 text-sm leading-relaxed text-neutral-400 font-light font-sans">
                <p>We believe what you wear should be as functional as it is aesthetic. {site.brand} exists to cut through the noise of fast fashion — offering pieces that prioritize longevity over trends.</p>
                <p>Every garment is crafted to be a staple in your rotation. Designed to feel better, last longer, and fit seamlessly into your personal style.</p>
              </div>
              <div className="mt-10 pt-8 border-t border-white/5">
                <p className="text-neutral-500 uppercase mb-4" style={{ fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.22em" }}>Strict Design Standards</p>
                <ul className="space-y-3 font-sans">
                  {["Quality through simplicity.", "Minimalist design, maximum impact.", "Pieces made to be worn, not just owned.", "Commitment to timeless, elevated essentials."].map((s, i) => (
                    <li key={i} className="text-xs text-neutral-400 flex items-start gap-2 font-light"><span className="mt-[6.5px] w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />{s}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 pt-6 border-t border-white/5 text-xs text-neutral-400 font-light font-mono">Support inquiries / <a href="mailto:luveni.apparel@gmail.com" className="text-white underline underline-offset-2 hover:opacity-70 transition-opacity">luveni.apparel@gmail.com</a></div>
            </FadeUp>
          </div>
          <div className="px-8 py-16 sm:px-12 md:px-16 lg:px-24 flex items-center bg-neutral-900/40">
            <FadeUp delay={120}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-10 font-sans">
                {VALUES.map((v, i) => {
                  const Icon = v.icon;
                  return (
                    <div key={i} className="space-y-4">
                      <div className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center border border-white/5 shadow-sm"><Icon size={14} className="text-white" /></div>
                      <h4 className="text-sm font-semibold text-white tracking-tight">{v.title}</h4>
                      <p className="text-xs leading-relaxed text-neutral-400 font-light">{v.desc}</p>
                    </div>
                  );
                })}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* 6. EDITORIAL FOOTER PARALLAX CARD */}
      <FeatureRow
        eyebrow="Weight"
        title="240 GSM. Built to last."
        body="Heavyweight combed organic cotton with a tactile hand-feel that softens beautifully wash after wash, without losing its structure."
        side="right"
        src={SHIRT_MODEL}
      />

    </div>
  );
}
