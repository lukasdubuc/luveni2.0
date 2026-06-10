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

// ─── STABLE ROOT-RELATIVE DIRECT WORKSPACE ASSETS ───
const TSHIRT_1 = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a4546cf.png";
const TSHIRT_2 = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a454c19.png";
const TSHIRT_3 = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a4550cd.png";
const GRAPHIC_LOGO = "/design-lab-upscaled-6a25d1f65103a2.77471166-1780863478.png";

// Naming Aliases to guarantee 100% backward compatibility and eliminate ReferenceErrors
const SHIRT_FLAT = TSHIRT_1;
const SHIRT_FOLDED = TSHIRT_2;
const SHIRT_MODEL = TSHIRT_3;
const SHIRT_LOGO = GRAPHIC_LOGO;

const HAT_ANGLE_0 = "/classic-dad-hat-black-front-6a28d8da62cc9.png";
const HAT_ANGLE_1 = "/classic-dad-hat-black-left-front-6a28d8da63cca.png";
const HAT_ANGLE_2 = "/classic-dad-hat-black-left-side-6a28d8da636fd.png";
const HAT_ANGLE_3 = "/classic-dad-hat-black-back-6a28d8da63130.png";
const HAT_ANGLE_4 = "/classic-dad-hat-black-right-side-6a28d8da633f3.png";
const HAT_ANGLE_5 = "/classic-dad-hat-black-right-front-6a28d8da639e0.png";

/* ──────────────────────────────────────────────────────────────────────────
    SINGLE, UNIFIED COMPONENT TREE (GUARANTEES 100% ERROR-FREE RUNTIME)
   ────────────────────────────────────────────────────────────────────────── */
function About() {
  // ─── COMPONENT REFS (DECLARED ON MAIN SCOPE) ───
  const heroRef = useRef<HTMLDivElement>(null);
  const rotatorContainerRef = useRef<HTMLDivElement>(null);
  const editorialRef = useRef<HTMLDivElement>(null);
  
  const trigger0 = useRef<HTMLDivElement>(null);
  const trigger1 = useRef<HTMLDivElement>(null);
  const trigger2 = useRef<HTMLDivElement>(null);
  const trigger3 = useRef<HTMLDivElement>(null);
  const trigger4 = useRef<HTMLDivElement>(null);
  const trigger5 = useRef<HTMLDivElement>(null);

  const featRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  // ─── STATE HOOKS ───
  const [heroScrollP, setHeroScrollP] = useState(0);
  const [editorialScrollP, setEditorialScrollP] = useState(0);
  const [heroActiveTab, setHeroActiveTab] = useState<"flat" | "model">("flat");
  const [heroEntered, setHeroEntered] = useState(false);
  const [editorialEntered, setEditorialEntered] = useState(false);
  const [hatAngleIndex, setHatAngleIndex] = useState(0);
  const [featVisible, setFeatVisible] = useState([false, false, false]);
  const [featScrollP, setFeatScrollP] = useState([0, 0, 0]);

  // ─── CONSOLIDATED SCROLL PERFORMANCE ENGINE ───
  useEffect(() => {
    const onScroll = () => {
      // Hero viewport calculations
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const progress = 1 - rect.bottom / (vh + rect.height);
        setHeroScrollP(Math.max(0, Math.min(1, progress)));
      }

      // Editorial closing band calculations
      if (editorialRef.current) {
        const rect = editorialRef.current.getBoundingClientRect();
        const start = rect.top - window.innerHeight;
        const total = rect.height + window.innerHeight;
        setEditorialScrollP(Math.max(0, Math.min(1, -start / total)));
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ─── STATIC REVEAL INTERSECTION OBSERVER ENGINE (FADE-UP NO COMPONENT) ───
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );

    const targets = document.querySelectorAll(".reveal-on-scroll");
    targets.forEach((t) => observer.observe(t));

    // Entry triggers for Hero and Editorial stages
    const heroObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHeroEntered(true); heroObs.disconnect(); } }, { threshold: 0.05 });
    if (heroRef.current) heroObs.observe(heroRef.current);

    const edObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setEditorialEntered(true); edObs.disconnect(); } }, { threshold: 0.05 });
    if (editorialRef.current) edObs.observe(editorialRef.current);

    return () => {
      observer.disconnect();
      heroObs.disconnect();
      edObs.disconnect();
    };
  }, []);

  // ─── SUB-HIGHLIGHT PERSPECTIVES ROTATOR STATE & SCROLL TRIGGERS ───
  useEffect(() => {
    const triggers = [trigger0, trigger1, trigger2, trigger3, trigger4, trigger5];
    const observers = triggers.map((ref, idx) => {
      const o = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setHatAngleIndex(idx); },
        { threshold: 0.5, rootMargin: "-10% 0px -10% 0px" }
      );
      if (ref.current) o.observe(ref.current);
      return o;
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // ─── ANATOMY DETAIL ROWS INVIEW & SCROLL REVEALS ───
  useEffect(() => {
    const observers = featRefs.map((ref, idx) => {
      const o = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          setFeatVisible(prev => {
            const next = [...prev];
            next[idx] = true;
            return next;
          });
          o.disconnect();
        }
      }, { threshold: 0.1 });
      if (ref.current) o.observe(ref.current);
      return o;
    });

    const handleFeatScroll = () => {
      featRefs.forEach((ref, idx) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const start = r.top - vh;
        const total = r.height + vh;
        setFeatScrollP(prev => {
          const next = [...prev];
          next[idx] = Math.max(0, Math.min(1, -start / total));
          return next;
        });
      });
    };

    window.addEventListener("scroll", handleFeatScroll, { passive: true });
    handleFeatScroll();

    return () => {
      observers.forEach(o => o.disconnect());
      window.removeEventListener("scroll", handleFeatScroll);
    };
  }, []);

  // ─── CONFIGURATION STRUCTS ───
  const FEATURES = [
    { eyebrow: "Anatomy", title: "Engineered in silence.", body: "No noise. No filler. Every panel, seam, and stitch exists for a reason — and the reasons are visible the moment you hold it.", src: TSHIRT_1, side: "right" as const },
    { eyebrow: "Iconography", title: "A subtle relief print.", body: "Marked with the high-resolution transparent butterfly logo. Patience and steady growth rendered in clean lines.", src: GRAPHIC_LOGO, side: "left" as const },
    { eyebrow: "Weight", title: "240 GSM. Built to last.", body: "Heavyweight combed organic cotton with a tactile hand-feel that softens beautifully wash after wash, without losing its structure.", src: TSHIRT_2, side: "right" as const }
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

  return (
    <div className="about-page w-full bg-black text-white selection:bg-neutral-800 transition-colors duration-300" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui" }}>
      
      {/* ───────────────────────────────────────────────────────────────────
          A. STICKY NAV BAR (INLINED)
          ─────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-2xl" style={{ background: "rgba(0,0,0,0.72)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto flex h-11 max-w-[1200px] items-center justify-between px-6">
          <span className="text-[13px] font-medium tracking-tight text-white/90">{site.brand}</span>
          <div className="hidden items-center gap-7 text-[11px] text-white/60 sm:flex">
            <a href="#overview" className="transition-colors hover:text-white">Overview</a>
            <a href="#anatomy" className="transition-colors hover:text-white">Anatomy</a>
            <a href="#rotator" className="transition-colors hover:text-white">Perspectives</a>
            <a href="#story" className="transition-colors hover:text-white">Story</a>
          </div>
          <Link to="/shop" className="rounded-full bg-white px-3.5 py-1 text-[11px] font-medium text-black transition-opacity hover:opacity-90">Shop</Link>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          B. PRODUCT HERO SECTION (SHIRT EXPLODED STAGE)
          ─────────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} id="shirt-hero" className="grid grid-cols-1 md:grid-cols-2 border-b border-white/5" style={{ minHeight: "88vh" }}>
        
        {/* LEFT — Seamless Stage Visualizer */}
        <div className="relative w-full h-full bg-neutral-950 overflow-hidden flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5" style={{ minHeight: "65vh" }}>
          {/* Blueprint Grid pattern rendered inlined directly */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0" style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 44px"
          }} />
          
          <div className="absolute inset-0 pointer-events-none rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 65%)" }} />

          <div className="flex-1 w-full relative flex items-center justify-center p-8">
            {/* Flat front shirt mockup */}
            <img
              src={SHIRT_FLAT}
              alt="GZ R-01 tee front layout"
              className="absolute max-h-[82%] max-w-[82%] object-contain select-none transition-all duration-750 ease-out"
              style={{
                opacity: heroActiveTab === "flat" && heroEntered ? 1 : 0,
                visibility: heroActiveTab === "flat" ? "visible" : "hidden",
                transform: `scale(${1 + heroScrollP * 0.12})`,
                filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))",
                willChange: "transform",
              }}
              draggable={false}
            />

            {/* Model wearing the shirt */}
            <img
              src={SHIRT_MODEL}
              alt="GZ R-01 tee on model"
              className="absolute max-h-[82%] max-w-[82%] object-contain select-none transition-all duration-750 ease-out rounded-2xl"
              style={{
                opacity: heroActiveTab === "model" && heroEntered ? 1 : 0,
                visibility: heroActiveTab === "model" ? "visible" : "hidden",
                transform: `scale(${1 + heroScrollP * 0.12})`,
                filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))",
                willChange: "transform",
              }}
              draggable={false}
            />
          </div>

          <div className="relative z-20 pb-6 w-full flex flex-col items-center gap-3">
            <div className="flex p-0.5 rounded-full bg-neutral-900 border border-white/5 backdrop-blur-sm">
              <button onClick={() => setHeroActiveTab("flat")} className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${heroActiveTab === "flat" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-white"}`}>Flat Layout</button>
              <button onClick={() => setHeroActiveTab("model")} className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${heroActiveTab === "model" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-white"}`}>On Model</button>
            </div>
            
            <span style={{ fontFamily: "monospace", fontSize: "8.5px", letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Signature GZ R-01 Tee</span>
          </div>
        </div>

        {/* RIGHT — Technical Specs Column (with CSS Reveal) */}
        <div className="flex flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-24">
          <div className="reveal-on-scroll transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
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
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          3. THE DETAILS BLUEPRINTS GRID (INLINED FEATURES LOOP)
          ─────────────────────────────────────────────────────────────────── */}
      <div id="anatomy">
        {FEATURES.map((feat, idx) => {
          const isVisible = featVisible[idx];
          const yOffset = (featScrollP[idx] - 0.5) * -60;

          return (
            <section key={idx} ref={featRefs[idx]} className="relative overflow-hidden py-24 sm:py-36 border-b border-white/5 bg-black">
              <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 md:grid-cols-2" style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(32px)", transition: "opacity 0.9s cubic-bezier(.16,1,.3,1), transform 0.9s cubic-bezier(.16,1,.3,1)" }}>
                <div className={feat.side === "right" ? "md:order-2" : ""}>
                  <p className="mb-4 text-[10px] font-mono tracking-[0.24em] text-neutral-500 uppercase">{feat.eyebrow}</p>
                  <h2 className="text-white tracking-tighter" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui", fontSize: "clamp(34px, 4.8vw, 64px)", lineHeight: 1.04, fontWeight: 200 }}>{feat.title}</h2>
                  <p className="mt-5 max-w-md text-[14px] font-light leading-relaxed text-neutral-400 font-sans">{feat.body}</p>
                </div>

                <div className={feat.side === "right" ? "md:order-1" : ""}>
                  <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-neutral-950 flex items-center justify-center p-8" style={{ border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 25px 60px rgba(0,0,0,0.8)" }}>
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0" style={{
                      backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
                      backgroundSize: "40px 44px"
                    }} />
                    <img src={feat.src} alt={feat.title} draggable={false} className="max-h-[85%] max-w-[85%] object-contain select-none transition-transform duration-100" style={{ transform: `translateY(${yOffset}px) scale(1.02)`, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.5))", willChange: "transform" }} />
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          4. THE 360° SCROLL ROTATOR (HAT PORTRAIT - INLINED TRIGGERS)
          ─────────────────────────────────────────────────────────────────── */}
      <section id="rotator" ref={rotatorContainerRef} className="relative bg-black border-b border-white/5" style={{ height: "240vh" }}>
        
        {/* Transparent triggers inside container for asynchronous, low-lag rendering */}
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none flex flex-col justify-between">
          <div ref={trigger0} className="h-10 w-full" />
          <div ref={trigger1} className="h-10 w-full" />
          <div ref={trigger2} className="h-10 w-full" />
          <div ref={trigger3} className="h-10 w-full" />
          <div ref={trigger4} className="h-10 w-full" />
          <div ref={trigger5} className="h-10 w-full" />
        </div>

        <div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden">
          {/* Subtle grid background directly rendered inline */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0" style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 44px"
          }} />
          
          <div className="pt-20 px-6 text-center z-20">
            <p className="text-[10px] font-mono tracking-[0.3em] text-neutral-500 uppercase mb-2">Sub-Highlight Piece</p>
            <h2 className="text-white tracking-tighter text-3xl sm:text-5xl font-extralight font-sans">
              Embroidered Dad Hat.<br />
              <span className="font-semibold text-white">Rotatable perspective.</span>
            </h2>
          </div>

          {/* Canvas Stacking Rotator - pre-loads all angles inside absolute layout to guarantee zero lag */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-[340px] flex items-center justify-center">
              <div className="absolute inset-0 pointer-events-none rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.035) 0%, transparent 65%)" }} />
              {hatAngles.map((angle, idx) => (
                <img key={idx} src={angle.src} alt={`Hat angle - ${angle.name}`} className="absolute max-h-[85%] max-w-[85%] object-contain select-none transition-opacity duration-300" style={{ opacity: hatAngleIndex === idx ? 1 : 0, visibility: hatAngleIndex === idx ? "visible" : "hidden", filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.85))" }} draggable={false} />
              ))}
            </div>
          </div>

          {/* Floating dynamic captions */}
          <div className="absolute bottom-28 left-6 right-6 flex justify-center text-center z-20">
            <div className="max-w-xs relative h-10 w-full">
              {[
                "01 / Low-profile unstructured 6-panel design.",
                "02 / Formed cleanly in durable chino twill.",
                "03 / Front heart relief rendered in high-density thread.",
                "04 / Completed with a custom brass buckle closure.",
                "05 / Subtle ventilation eyelets on every panel.",
                "06 / Curved visor structured for standard daily rotation."
              ].map((text, idx) => (
                <p key={idx} className="absolute inset-x-0 top-0 text-xs text-neutral-400 font-light transition-all duration-500 leading-relaxed font-sans" style={{ opacity: hatAngleIndex === idx ? 0.95 : 0, transform: hatAngleIndex === idx ? "translateY(0)" : "translateY(12px)" }}>
                  {text}
                </p>
              ))}
            </div>
          </div>

          <div className="pb-16 flex flex-col items-center gap-3 z-20">
            <span className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">{hatAngles[hatAngleIndex]?.name || "Perspective"}</span>
            <div className="flex gap-1.5">
              {hatAngles.map((_, idx) => (
                <button key={idx} onClick={() => {
                  const triggers = [trigger0, trigger1, trigger2, trigger3, trigger4, trigger5];
                  if (triggers[idx].current) {
                    triggers[idx].current.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }} className={`h-1.5 rounded-full transition-all duration-500 ${hatAngleIndex === idx ? "w-5 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          5. PHILOSOPHY CONVICTION DECK
          ─────────────────────────────────────────────────────────────────── */}
      <section id="story" className="bg-black px-6 py-40 border-b border-white/5">
        <div className="mx-auto max-w-[900px] text-center transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0 reveal-on-scroll">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ background: "linear-gradient(90deg,#ff8a3d,#ff5e9b,#7c5cff,#3dc6ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            The Story
          </p>
          <h2 className="text-white tracking-tighter" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui", fontSize: "clamp(38px, 6vw, 84px)", lineHeight: 1.04, fontWeight: 200 }}>
            A wardrobe of quiet conviction.
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-[18px] font-light leading-relaxed text-neutral-400 sm:text-[20px] font-sans">
            {site.brand} began as a refusal — refusal of trend cycles, of loud logos, of disposable seasons. Every piece is engineered to outlast the calendar and earn its place in your daily rotation.
          </p>
          <div className="mt-16 grid grid-cols-2 gap-8 text-left sm:grid-cols-4 border-t border-white/5 pt-12">
            {[
              ["240", "GSM heavyweight cotton"],
              ["07", "Production checkpoints"],
              ["100%", "Organic fibers"],
              ["∞", "Iteration on the details"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-white tracking-tighter" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 200 }}>{n}</div>
                <div className="mt-1 text-[11px] font-mono tracking-[0.18em] text-neutral-500 uppercase">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          6. EDITORIAL FOOTER PARALLAX CARD
          ─────────────────────────────────────────────────────────────────── */}
      <section ref={editorialRef} id="editorial-parallax" className="relative overflow-hidden border-b border-white/5" style={{ height: "clamp(340px, 48vw, 620px)" }}>
        <div className="w-full h-full overflow-hidden">
          <img src={TSHIRT_3} alt="Luveni organic lineup closeup" className="w-full h-full object-cover animate-fade-in" style={{ transform: `translateY(${editorialScrollP * -50}px) scale(1.10)`, transition: "transform 0.1s linear, opacity 0.5s ease-out", willChange: "transform", opacity: editorialEntered ? 1 : 0 }} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ background: "linear-gradient(rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)" }}>
          <div className="motion-reduce:opacity-100 motion-reduce:transform-none transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0 reveal-on-scroll">
            <p className="uppercase mb-3 font-semibold font-mono" style={{ fontSize: "9px", letterSpacing: "0.32em", color: "rgba(255,255,255,0.7)" }}>Luveni Core Systems · {new Date().getFullYear()}</p>
            <p className="tracking-tighter text-white font-extralight font-sans" style={{ fontSize: "clamp(26px, 4.5vw, 52px)", lineHeight: 1.1 }}>Designed for the<br /><span className="font-semibold text-white">everyday uniform.</span></p>
          </div>
        </div>
      </section>

    </div>
  );
}
