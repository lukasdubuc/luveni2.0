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

/* ──────────────────────────────────────────────────────────────────────────
    SINGLE, UNIFIED COMPONENT CLOSURE (PREVENTS ACCIDENTAL EDITOR DELETIONS)
   ────────────────────────────────────────────────────────────────────────── */
function About() {
  // ─── STABLE ROOT-RELATIVE DIRECT WORKSPACE ASSETS ───
  const TSHIRT_1 = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a4546cf.png";
  const TSHIRT_2 = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a454c19.png";
  const TSHIRT_3 = "/unisex-organic-mid-light-crafter-t-shirt-black-front-6a28f7a4550cd.png";
  const GRAPHIC_LOGO = "/design-lab-upscaled-6a25d1f65103a2.77471166-1780863478.png";

  const HAT_ANGLE_0 = "/classic-dad-hat-black-front-6a28d8da62cc9.png";
  const HAT_ANGLE_1 = "/classic-dad-hat-black-left-front-6a28d8da63cca.png";
  const HAT_ANGLE_2 = "/classic-dad-hat-black-left-side-6a28d8da636fd.png";
  const HAT_ANGLE_3 = "/classic-dad-hat-black-back-6a28d8da63130.png";
  const HAT_ANGLE_4 = "/classic-dad-hat-black-right-side-6a28d8da633f3.png";
  const HAT_ANGLE_5 = "/classic-dad-hat-black-right-front-6a28d8da639e0.png";

  // ─── HERO SCROLL ENGINE ───
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroScrollP, setHeroScrollP] = useState(0);
  const [heroEntered, setHeroEntered] = useState(false);
  const [heroActiveTab, setHeroActiveTab] = useState<"flat" | "model">("flat");

  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return;
      const r = heroRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - r.bottom / (vh + r.height);
      setHeroScrollP(Math.max(0, Math.min(1, progress)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHeroEntered(true); obs.disconnect(); } }, { threshold: 0.05 });
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  // ─── ANATOMY SECTIONS INVIEW ENGINE ───
  const featRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const [featVisible, setFeatVisible] = useState([false, false, false]);
  const [featScrollP, setFeatScrollP] = useState([0, 0, 0]);

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

  // ─── ROTATOR SCROLL ENGINE (HAT VIEWPORT) ───
  const hatSectionRef = useRef<HTMLDivElement>(null);
  const [hatAngleIndex, setHatAngleIndex] = useState(0);

  useEffect(() => {
    const handleRotatorScroll = () => {
      if (!hatSectionRef.current) return;
      const rect = hatSectionRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = -rect.top / (rect.height - vh);
      const clamped = Math.max(0, Math.min(0.99, progress));
      setHatAngleIndex(Math.floor(clamped * 6));
    };
    window.addEventListener("scroll", handleRotatorScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleRotatorScroll);
  }, []);

  // ─── STORY MODULE REVEAL ───
  const storyRef = useRef<HTMLDivElement>(null);
  const [storyVisible, setStoryVisible] = useState(false);
  useEffect(() => {
    if (!storyRef.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStoryVisible(true); o.disconnect(); } }, { threshold: 0.1 });
    o.observe(storyRef.current);
    return () => o.disconnect();
  }, []);

  // ─── EDITORIAL CLOSING CARD PARALLAX HOOKS ───
  const editorialRef = useRef<HTMLDivElement>(null);
  const [editorialScrollP, setEditorialScrollP] = useState(0);
  const [editorialEntered, setEditorialEntered] = useState(false);

  useEffect(() => {
    const handleEditorialScroll = () => {
      if (!editorialRef.current) return;
      const r = editorialRef.current.getBoundingClientRect();
      const start = r.top - window.innerHeight;
      const total = r.height + window.innerHeight;
      setEditorialScrollP(Math.max(0, Math.min(1, -start / total)));
    };
    window.addEventListener("scroll", handleEditorialScroll, { passive: true });
    handleEditorialScroll();
    return () => window.removeEventListener("scroll", handleEditorialScroll);
  }, []);

  useEffect(() => {
    if (!editorialRef.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setEditorialEntered(true); o.disconnect(); } }, { threshold: 0.05 });
    o.observe(editorialRef.current);
    return () => o.disconnect();
  }, []);

  // ─── DESIGN DATAS ───
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

  return (
    <div className="about-page w-full bg-black text-white selection:bg-neutral-800 transition-colors duration-300" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui" }}>
      
      {/* ───────────────────────────────────────────────────────────────────
          1. STICKY NAV BAR (INLINED)
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
          2. THE PRODUCT HERO (SHIRT EXPLODED VIEW)
          ─────────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} id="overview" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
        
        {/* Subtle grid background directly rendered inline */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0" style={{
          backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 44px"
        }} />
        
        <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "radial-gradient(circle at 50% 60%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 50%)" }} />

        <div className="relative z-20 mx-auto flex max-w-[1200px] flex-col items-center px-6 pt-24 text-center">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ background: "linear-gradient(90deg,#ff8a3d,#ff5e9b,#7c5cff,#3dc6ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", opacity: 1 - heroScrollP * 1.5 }}>
            {site.brand} — Studio Edition
          </p>

          <h1 className="text-balance text-white font-sans" style={{ fontWeight: 600, fontSize: "clamp(54px, 8.5vw, 114px)", lineHeight: 0.98, letterSpacing: "-0.04em", opacity: 1 - heroScrollP * 1.5 }}>
            Built for those<br />who notice.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-[16px] font-light leading-relaxed text-white/70 sm:text-[19px] font-sans" style={{ opacity: 1 - heroScrollP * 1.5 }}>
            Heavyweight organic cotton, silent structural seams, and a detailed profile you appreciate the moment it drapes.
          </p>
        </div>

        {/* Dynamic scroll stage */}
        <div className="absolute inset-x-0 bottom-0 z-0 h-[65vh] flex items-end justify-center pointer-events-none" style={{ transform: `translateY(${heroScrollP * -80}px)`, transformOrigin: "50% 100%" }}>
          <div className="relative w-full h-full flex items-center justify-center max-w-[1200px] px-6">
            
            <img src={TSHIRT_2} alt="Anatomy detail Left" className="absolute left-[5%] bottom-10 w-[24vw] max-w-[280px] object-contain select-none transition-all duration-300" style={{ transform: `translateX(${-heroScrollP * 120}px) scale(0.95)`, opacity: heroScrollP > 0.05 ? 0.35 : 0, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" }} draggable={false} />

            <div className="relative w-[52vw] max-w-[580px] h-full flex items-center justify-center" style={{ transform: `scale(${1 + heroScrollP * 0.12})`, transition: "transform 0.1s linear" }}>
              <img src={SHIRT_FLAT} alt="Flat shirt front" className="absolute inset-0 w-full h-full object-contain select-none transition-opacity duration-700" style={{ opacity: heroActiveTab === "flat" && heroEntered ? 1 : 0, visibility: heroActiveTab === "flat" ? "visible" : "hidden", filter: "drop-shadow(0 40px 90px rgba(0,0,0,0.85))" }} draggable={false} />
              <img src={SHIRT_MODEL} alt="Shirt on model" className="absolute inset-0 w-full h-full object-contain select-none transition-opacity duration-700 rounded-2xl" style={{ opacity: heroActiveTab === "model" && heroEntered ? 1 : 0, visibility: heroActiveTab === "model" ? "visible" : "hidden", filter: "drop-shadow(0 40px 90px rgba(0,0,0,0.85))" }} draggable={false} />
            </div>

            <img src={TSHIRT_3} alt="Anatomy detail Right" className="absolute right-[5%] bottom-10 w-[24vw] max-w-[280px] object-contain select-none transition-all duration-300" style={{ transform: `translateX(${heroScrollP * 120}px) scale(0.95)`, opacity: heroScrollP > 0.05 ? 0.35 : 0, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" }} draggable={false} />

            {/* Hover floating upscaled graphic tag */}
            <div className="absolute z-20 w-[18vw] max-w-[190px] aspect-square flex items-center justify-center rounded-full bg-black/40 border border-white/5 backdrop-blur-md" style={{ top: "22%", transform: `scale(${0.8 + heroScrollP * 0.25})`, opacity: heroScrollP > 0.05 ? 0.9 : 0, transition: "opacity 0.6s ease-out" }}>
              <img src={SHIRT_LOGO} alt="Custom graphic" className="w-[78%] h-[78%] object-contain" />
            </div>
            
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="absolute bottom-6 left-6 right-6 z-30 flex flex-col items-center gap-3">
          <div className="flex p-0.5 rounded-full bg-neutral-900 border border-white/5 backdrop-blur-sm">
            <button onClick={() => setHeroActiveTab("flat")} className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${heroActiveTab === "flat" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-white"}`}>Flat Layout</button>
            <button onClick={() => setHeroActiveTab("model")} className={`px-4 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-full transition-all duration-300 ${heroActiveTab === "model" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-white"}`}>On Model</button>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          3. THE DETAILS BLUEPRINTS GRID (INLINED)
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
          4. THE 360° SCROLL ROTATOR (HAT PORTRAIT - NO CLUNKY UI TEXT)
          ─────────────────────────────────────────────────────────────────── */}
      <section id="rotator" ref={hatSectionRef} className="relative bg-black border-b border-white/5" style={{ height: "240vh" }}>
        
        {/* Transparent triggers inside container for asynchronous, low-lag rendering */}
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none flex flex-col justify-between">
          <div ref={triggerRefs[0]} className="h-10 w-full" />
          <div ref={triggerRefs[1]} className="h-10 w-full" />
          <div ref={triggerRefs[2]} className="h-10 w-full" />
          <div ref={triggerRefs[3]} className="h-10 w-full" />
          <div ref={triggerRefs[4]} className="h-10 w-full" />
          <div ref={triggerRefs[5]} className="h-10 w-full" />
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

          {/* Canvas Stacking Rotator - pre-loads all angles inside absolute layer to guarantee zero lag */}
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
                  if (triggerRefs[idx].current) {
                    triggerRefs[idx].current.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }} className={`h-1.5 rounded-full transition-all duration-500 ${hatAngleIndex === idx ? "w-5 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          5. PHILOSOPHY / BRAND STORY
          ─────────────────────────────────────────────────────────────────── */}
      <section id="story" className="bg-black px-6 py-40 border-b border-white/5">
        <div ref={storyRef} className="mx-auto max-w-[900px] text-center" style={{ opacity: storyVisible ? 1 : 0, transform: storyVisible ? "translateY(0)" : "translateY(30px)", transition: "all 1s cubic-bezier(.16,1,.3,1)" }}>
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
          6. EDITORIAL CARD (MODEL PARALLAX CLOSE-UP)
          ─────────────────────────────────────────────────────────────────── */}
      <section ref={editorialRef} className="relative overflow-hidden border-b border-white/5" style={{ height: "clamp(340px, 48vw, 620px)" }}>
        <div className="w-full h-full overflow-hidden">
          <img src={TSHIRT_3} alt="Luveni organic lineup closeup" className="w-full h-full object-cover" style={{ transform: `translateY(${editorialScrollP * -50}px) scale(1.10)`, transition: "transform 0.1s linear, opacity 0.5s ease-out", willChange: "transform", opacity: editorialEntered ? 1 : 0 }} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ background: "linear-gradient(rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)" }}>
          <div style={{ opacity: editorialEntered ? 1 : 0, transform: editorialEntered ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.8s cubic-bezier(0.16,1,0.3,1) 100ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) 100ms" }} className="motion-reduce:opacity-100 motion-reduce:transform-none">
            <p className="uppercase mb-3 font-semibold font-mono" style={{ fontSize: "9px", letterSpacing: "0.32em", color: "rgba(255,255,255,0.7)" }}>Luveni Core Systems · {new Date().getFullYear()}</p>
            <p className="tracking-tighter text-white font-extralight font-sans" style={{ fontSize: "clamp(26px, 4.5vw, 52px)", lineHeight: 1.1 }}>Designed for the<br /><span className="font-semibold text-white">everyday uniform.</span></p>
          </div>
        </div>
      </section>

    </div>
  );
}
