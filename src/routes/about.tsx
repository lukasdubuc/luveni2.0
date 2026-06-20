import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useRef, useState } from "react";

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

const SHIRT_FLAT   = TSHIRT_1;
const SHIRT_FOLDED = TSHIRT_2;

const HAT_ANGLE_0 = "/classic-dad-hat-black-front-6a28d8da62cc9.png";
const HAT_ANGLE_1 = "/classic-dad-hat-black-left-front-6a28d8da63cca.png";
const HAT_ANGLE_2 = "/classic-dad-hat-black-left-side-6a28d8da636fd.png";
const HAT_ANGLE_3 = "/classic-dad-hat-black-back-6a28d8da63130.png";
const HAT_ANGLE_4 = "/classic-dad-hat-black-right-side-6a28d8da633f3.png";
const HAT_ANGLE_5 = "/classic-dad-hat-black-right-front-6a28d8da639e0.png";

// ─── SHARED CONSTANTS ───
const APPLE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SF_DISPLAY = "'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

// Apple-flavoured smootherstep — perceptually even acceleration / deceleration.
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Theme-aware blueprint grid: reads in both light (multiply) and dark (screen).
const GRID_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
  backgroundSize: "40px 44px",
  mixBlendMode: "var(--grid-blend)" as React.CSSProperties["mixBlendMode"],
};

// Theme-aware product drop-shadow built from --shadow-rgb.
const shadow = (y: number, blur: number, alpha: number) =>
  `drop-shadow(0 ${y}px ${blur}px rgba(var(--shadow-rgb), ${alpha}))`;

function About() {
  const heroRef      = useRef<HTMLDivElement>(null);
  const editorialRef = useRef<HTMLDivElement>(null);

  const trigger0 = useRef<HTMLDivElement>(null);
  const trigger1 = useRef<HTMLDivElement>(null);
  const trigger2 = useRef<HTMLDivElement>(null);
  const trigger3 = useRef<HTMLDivElement>(null);
  const trigger4 = useRef<HTMLDivElement>(null);
  const trigger5 = useRef<HTMLDivElement>(null);

  const featRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const [heroScrollP,      setHeroScrollP]      = useState(0);
  const [editorialScrollP, setEditorialScrollP] = useState(0);
  const [heroEntered,      setHeroEntered]      = useState(false);
  const [editorialEntered, setEditorialEntered] = useState(false);
  const [hatAngleIndex,    setHatAngleIndex]    = useState(0);
  const [featVisible,      setFeatVisible]      = useState([false, false, false]);
  const [featScrollP,      setFeatScrollP]      = useState([0, 0, 0]);

  // ─── APPLE-STYLE CROSSFADE: 0 = flat, 1 = folded ───
  // Slow breathe with held end-states so the swap feels intentional, not jittery.
  const [crossfadeP, setCrossfadeP] = useState(0);
  useEffect(() => {
    // Respect reduced-motion: hold the flat hero, no looping animation.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const FADE_DURATION = 4000;
    const HOLD_DURATION = 2000;
    const TOTAL = FADE_DURATION * 2 + HOLD_DURATION * 2;
    let startTime: number | null = null;
    let raf = 0;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = (now - startTime) % TOTAL;

      let p = 0;
      if (elapsed < HOLD_DURATION) {
        p = 0;
      } else if (elapsed < HOLD_DURATION + FADE_DURATION) {
        p = smoother((elapsed - HOLD_DURATION) / FADE_DURATION);
      } else if (elapsed < HOLD_DURATION * 2 + FADE_DURATION) {
        p = 1;
      } else {
        p = 1 - smoother((elapsed - HOLD_DURATION * 2 - FADE_DURATION) / FADE_DURATION);
      }

      setCrossfadeP(p);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─── SCROLL ENGINE (rAF-throttled for a buttery 60fps) ───
  useEffect(() => {
    let ticking = false;
    const compute = () => {
      ticking = false;
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const progress = 1 - rect.bottom / (vh + rect.height);
        setHeroScrollP(Math.max(0, Math.min(1, progress)));
      }
      if (editorialRef.current) {
        const rect = editorialRef.current.getBoundingClientRect();
        const start = rect.top - window.innerHeight;
        const total = rect.height + window.innerHeight;
        setEditorialScrollP(Math.max(0, Math.min(1, -start / total)));
      }
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(compute); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // ─── INTERSECTION OBSERVERS (reveal-on-scroll + hero / editorial entrance) ───
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
    document.querySelectorAll(".reveal-on-scroll").forEach((t) => observer.observe(t));

    const heroObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHeroEntered(true); heroObs.disconnect(); } }, { threshold: 0.05 });
    if (heroRef.current) heroObs.observe(heroRef.current);

    const edObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setEditorialEntered(true); edObs.disconnect(); } }, { threshold: 0.05 });
    if (editorialRef.current) edObs.observe(editorialRef.current);

    return () => { observer.disconnect(); heroObs.disconnect(); edObs.disconnect(); };
  }, []);

  // ─── HAT ROTATOR TRIGGERS ───
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

  // ─── FEATURE ROWS (entrance + parallax) ───
  useEffect(() => {
    const observers = featRefs.map((ref, idx) => {
      const o = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          setFeatVisible(prev => { const next = [...prev]; next[idx] = true; return next; });
          o.disconnect();
        }
      }, { threshold: 0.1 });
      if (ref.current) o.observe(ref.current);
      return o;
    });

    let ticking = false;
    const compute = () => {
      ticking = false;
      featRefs.forEach((ref, idx) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const start = r.top - vh;
        const total = r.height + vh;
        setFeatScrollP(prev => { const next = [...prev]; next[idx] = Math.max(0, Math.min(1, -start / total)); return next; });
      });
    };
    const handleFeatScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(compute); }
    };

    window.addEventListener("scroll", handleFeatScroll, { passive: true });
    window.addEventListener("resize", handleFeatScroll, { passive: true });
    compute();
    return () => {
      observers.forEach(o => o.disconnect());
      window.removeEventListener("scroll", handleFeatScroll);
      window.removeEventListener("resize", handleFeatScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const FEATURES = [
    { eyebrow: "Anatomy",     title: "Engineered in silence.",   body: "No noise. No filler. Every panel, seam, and stitch exists for a reason — and the reasons are visible the moment you hold it.",     src: TSHIRT_1,      side: "right" as const },
    { eyebrow: "Iconography", title: "A subtle relief print.",   body: "Marked with the high-resolution transparent butterfly logo. Patience and steady growth rendered in clean lines.",                    src: GRAPHIC_LOGO, side: "left"  as const },
    { eyebrow: "Weight",      title: "240 GSM. Built to last.",  body: "Heavyweight combed organic cotton with a tactile hand-feel that softens beautifully wash after wash, without losing its structure.", src: TSHIRT_2,      side: "right" as const },
  ];

  const hatAngles = [
    { name: "Front Flat View",            src: HAT_ANGLE_0 },
    { name: "Front Left Tilt",            src: HAT_ANGLE_1 },
    { name: "Left Profile (Logo Detail)", src: HAT_ANGLE_2 },
    { name: "Back View (Brass Adjuster)", src: HAT_ANGLE_3 },
    { name: "Right Profile (Minimal)",    src: HAT_ANGLE_4 },
    { name: "Front Right Tilt",           src: HAT_ANGLE_5 },
  ];

  const hatTriggers = [trigger0, trigger1, trigger2, trigger3, trigger4, trigger5];

  return (
    <div
      className="about-page w-full bg-background text-foreground selection:bg-foreground/15"
      style={{ fontFamily: SF_DISPLAY }}
    >

      {/* ═══════════════════════════════════════════════════════════════
          1. CINEMATIC HERO — Apple-style crossfade
         ═══════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        id="shirt-hero"
        className="grid grid-cols-1 md:grid-cols-2 border-b border-border min-h-[88vh]"
      >
        {/* LEFT — Cinematic crossfade stage */}
        <div
          className="relative w-full h-full bg-muted/40 overflow-hidden flex flex-col justify-between border-b md:border-b-0 md:border-r border-border"
          style={{ minHeight: "65vh" }}
        >
          {/* Blueprint grid */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={GRID_STYLE} />
          {/* Soft center light */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 45%, var(--border) 0%, transparent 60%)" }}
          />

          {/* Image stage — both images share the same absolute space, crossfade via opacity */}
          <div className="flex-1 w-full relative flex items-center justify-center p-8">
            <img
              src={SHIRT_FLAT}
              alt="GZ R-01 tee flat layout"
              width={1200}
              height={1200}
              draggable={false}
              fetchPriority="high"
              decoding="async"
              className="absolute select-none"
              style={{
                maxHeight: "82%", maxWidth: "82%", objectFit: "contain",
                opacity: heroEntered ? (1 - crossfadeP) : 0,
                transform: `scale(${1 + heroScrollP * 0.08})`,
                filter: shadow(30, 60, 0.18),
                transition: "opacity 0.08s linear",
                willChange: "opacity, transform",
                imageRendering: "high-quality" as React.CSSProperties["imageRendering"],
              }}
            />
            <img
              src={SHIRT_FOLDED}
              alt="GZ R-01 tee styled on model"
              width={1200}
              height={1200}
              draggable={false}
              fetchPriority="high"
              decoding="async"
              className="absolute select-none"
              style={{
                maxHeight: "82%", maxWidth: "82%", objectFit: "contain",
                opacity: heroEntered ? crossfadeP : 0,
                transform: `scale(${1 + heroScrollP * 0.08})`,
                filter: shadow(30, 60, 0.22),
                transition: "opacity 0.08s linear",
                willChange: "opacity, transform",
                imageRendering: "high-quality" as React.CSSProperties["imageRendering"],
              }}
            />
          </div>

          <div className="relative z-20 pb-6 w-full flex flex-col items-center gap-2">
            <span
              className="font-mono uppercase text-subtle"
              style={{ fontSize: "8.5px", letterSpacing: "0.3em" }}
            >
              Signature GZ R-01 Tee
            </span>
          </div>
        </div>

        {/* RIGHT — Technical specs */}
        <div className="flex flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-24">
          <div className="reveal-on-scroll transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <p className="text-subtle uppercase mb-4 font-mono" style={{ fontSize: "9px", letterSpacing: "0.28em" }}>
              The Signature Silhouette
            </p>
            <h1
              className="tracking-tighter text-foreground mb-6"
              style={{ fontSize: "clamp(34px, 5vw, 62px)", fontWeight: 200, lineHeight: 1.04, letterSpacing: "-0.035em" }}
            >
              The one you<br />
              <span className="font-semibold text-foreground">reach for first.</span>
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground mb-10 max-w-md font-light font-sans">
              Heavyweight combed organic cotton. Marked by the resilient Kuffiyeh Girl print — a subtle cultural emblem that is balanced, slow, and persistent.
              The GZ R-01 is the piece Luveni was built around — designed for your rotation, not the rack.
            </p>

            <div className="grid grid-cols-2 mb-10 border-t border-b border-border py-4">
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
                    borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
                    borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span className="text-subtle uppercase block mb-1 font-mono" style={{ fontSize: "9px", letterSpacing: "0.18em" }}>{label}</span>
                  <span className="text-foreground text-xs font-semibold">{val}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-subtle uppercase">Hardware Price</span>
              <span className="text-3xl font-light tracking-tighter text-foreground ml-2">$28</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. DETAILS BLUEPRINTS GRID
         ═══════════════════════════════════════════════════════════════ */}
      <div id="anatomy">
        {FEATURES.map((feat, idx) => {
          const isVisible = featVisible[idx];
          const yOffset   = (featScrollP[idx] - 0.5) * -60;

          return (
            <section key={idx} ref={featRefs[idx]} className="relative overflow-hidden py-24 sm:py-36 border-b border-border bg-background">
              <div
                className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 md:grid-cols-2"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(32px)",
                  transition: `opacity 0.9s ${APPLE_EASE}, transform 0.9s ${APPLE_EASE}`,
                }}
              >
                <div className={feat.side === "right" ? "md:order-2" : ""}>
                  <p className="mb-4 text-[10px] font-mono tracking-[0.24em] text-subtle uppercase">{feat.eyebrow}</p>
                  <h2
                    className="text-foreground tracking-tighter"
                    style={{ fontFamily: SF_DISPLAY, fontSize: "clamp(34px, 4.8vw, 64px)", lineHeight: 1.04, fontWeight: 200 }}
                  >{feat.title}</h2>
                  <p className="mt-5 max-w-md text-[14px] font-light leading-relaxed text-muted-foreground font-sans">{feat.body}</p>
                </div>

                <div className={feat.side === "right" ? "md:order-1" : ""}>
                  <div className="relative flex items-center justify-center w-full min-h-[300px] md:min-h-[440px] p-6 z-10">
                    {/* Soft pedestal glow keeps the cut-out grounded in both themes */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "radial-gradient(circle at 50% 55%, var(--border) 0%, transparent 60%)" }}
                    />
                    <img
                      src={feat.src}
                      alt={feat.title}
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      className="max-h-[92%] max-w-[92%] object-contain select-none relative"
                      style={{
                        transform: `translateY(${yOffset}px) scale(1.02)`,
                        filter: shadow(20, 40, 0.14),
                        transition: "transform 0.1s linear",
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. 360° SCROLL ROTATOR
         ═══════════════════════════════════════════════════════════════ */}
      <section id="rotator" className="relative bg-background border-b border-border" style={{ height: "240vh" }}>
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none flex flex-col justify-between">
          <div ref={trigger0} className="h-10 w-full" />
          <div ref={trigger1} className="h-10 w-full" />
          <div ref={trigger2} className="h-10 w-full" />
          <div ref={trigger3} className="h-10 w-full" />
          <div ref={trigger4} className="h-10 w-full" />
          <div ref={trigger5} className="h-10 w-full" />
        </div>

        <div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={GRID_STYLE} />

          <div className="pt-20 px-6 text-center z-20">
            <p className="text-[10px] font-mono tracking-[0.3em] text-subtle uppercase mb-2">Sub-Highlight Piece</p>
            <h2 className="text-foreground tracking-tighter text-3xl sm:text-5xl font-extralight font-sans">
              Embroidered Dad Hat.<br />
              <span className="font-semibold text-foreground">Rotatable perspective.</span>
            </h2>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-[340px] flex items-center justify-center">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, var(--border) 0%, transparent 65%)" }} />
              {hatAngles.map((angle, idx) => (
                <img
                  key={idx}
                  src={angle.src}
                  alt={`Hat angle - ${angle.name}`}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute max-h-[85%] max-w-[85%] object-contain select-none"
                  style={{
                    opacity: hatAngleIndex === idx ? 1 : 0,
                    transform: `scale(${hatAngleIndex === idx ? 1 : 0.97})`,
                    transition: `opacity 0.5s ${APPLE_EASE}, transform 0.6s ${APPLE_EASE}`,
                    filter: shadow(30, 60, 0.15),
                  }}
                  draggable={false}
                />
              ))}
            </div>
          </div>

          <div className="absolute bottom-28 left-6 right-6 flex justify-center text-center z-20">
            <div className="max-w-xs relative h-10 w-full">
              {[
                "01 / Low-profile unstructured 6-panel design.",
                "02 / Formed cleanly in durable chino twill.",
                "03 / Front heart relief rendered in high-density thread.",
                "04 / Completed with a custom brass buckle closure.",
                "05 / Subtle ventilation eyelets on every panel.",
                "06 / Curved visor structured for standard daily rotation.",
              ].map((text, idx) => (
                <p
                  key={idx}
                  className="absolute inset-x-0 top-0 text-xs text-muted-foreground font-light leading-relaxed font-sans"
                  style={{
                    opacity: hatAngleIndex === idx ? 0.95 : 0,
                    transform: hatAngleIndex === idx ? "translateY(0)" : "translateY(12px)",
                    transition: `opacity 0.5s ${APPLE_EASE}, transform 0.5s ${APPLE_EASE}`,
                  }}
                >
                  {text}
                </p>
              ))}
            </div>
          </div>

          <div className="pb-16 flex flex-col items-center gap-3 z-20">
            <span className="text-[9px] font-mono text-subtle tracking-widest uppercase">{hatAngles[hatAngleIndex]?.name || "Perspective"}</span>
            <div className="flex gap-1.5">
              {hatAngles.map((angle, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`View ${angle.name}`}
                  aria-pressed={hatAngleIndex === idx}
                  onClick={() => hatTriggers[idx].current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className={`h-1.5 rounded-full transition-all duration-500 ${hatAngleIndex === idx ? "w-5 bg-foreground" : "w-1.5 bg-foreground/25 hover:bg-foreground/50"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. THE STUDIO
         ═══════════════════════════════════════════════════════════════ */}
      <section id="story" className="relative py-24 sm:py-36 border-b border-border bg-background">
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={GRID_STYLE} />
        <div className="mx-auto max-w-[1200px] px-6 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 relative">
          <div className="reveal-on-scroll transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <p className="text-[10px] font-mono tracking-[0.24em] text-subtle uppercase mb-4">The Studio</p>
            <h2
              className="text-foreground tracking-tighter"
              style={{ fontFamily: SF_DISPLAY, fontSize: "clamp(34px, 4.8vw, 64px)", lineHeight: 1.04, fontWeight: 200 }}
            >
              Formed in quiet conviction.<br />
              <span className="font-semibold">Built by hands who notice.</span>
            </h2>
          </div>
          <div className="reveal-on-scroll transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0 flex flex-col justify-center space-y-6 text-sm leading-relaxed text-muted-foreground font-light font-sans">
            <p>
              Luveni was established as an independent design collective seeking to restore intent to everyday garments.
              We believe clothing should carry weight — both in its physical hand-feel and its design discipline. We exist
              to serve those who look closely, appreciate structural gravity, and value the quiet details of construction.
            </p>
            <p>
              Our team oversees every stage of development, from initial silhouette sketching in our studio to final-checkpoint inspections.
              We do not manufacture for mass shelves or trend-driven clearance cycles. Instead, we iterate exhaustively on a single
              uniform block until it satisfies our standard for physical longevity and uncompromised drape.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          5. PHILOSOPHY CONVICTION DECK
         ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-background px-6 py-40 border-b border-border">
        <div className="mx-auto max-w-[900px] text-center transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0 reveal-on-scroll">
          <p
            className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em]"
            style={{ background: "linear-gradient(90deg,#ff8a3d,#ff5e9b,#7c5cff,#3dc6ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            The Story
          </p>
          <h2
            className="text-foreground tracking-tighter"
            style={{ fontFamily: SF_DISPLAY, fontSize: "clamp(38px, 6vw, 84px)", lineHeight: 1.04, fontWeight: 200 }}
          >
            A wardrobe of quiet conviction.
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-[18px] font-light leading-relaxed text-muted-foreground sm:text-[20px] font-sans">
            {site.brand} began as a refusal — refusal of trend cycles, of loud logos, of disposable seasons. Every piece is engineered to outlast the calendar and earn its place in your daily rotation.
          </p>
          <div className="mt-16 grid grid-cols-2 gap-8 text-left sm:grid-cols-4 border-t border-border pt-12">
            {[
              ["240", "GSM heavyweight cotton"],
              ["07",  "Production checkpoints"],
              ["100%","Organic fibers"],
              ["∞",   "Iteration on the details"],
            ].map(([n, l]) => (
              <div key={l}>
                <div
                  className="text-foreground tracking-tighter"
                  style={{ fontFamily: SF_DISPLAY, fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 200 }}
                >{n}</div>
                <div className="mt-1 text-[11px] font-mono tracking-[0.18em] text-subtle uppercase">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          6. EDITORIAL FOOTER PARALLAX
         ═══════════════════════════════════════════════════════════════ */}
      <section
        ref={editorialRef}
        id="editorial-parallax"
        className="relative overflow-hidden border-b border-border"
        style={{ height: "clamp(340px, 48vw, 620px)" }}
      >
        <div className="w-full h-full overflow-hidden">
          <img
            src={TSHIRT_3}
            alt="Luveni organic lineup closeup"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            style={{
              transform: `translateY(${editorialScrollP * -50}px) scale(1.10)`,
              transition: "transform 0.1s linear, opacity 0.6s ease-out",
              opacity: editorialEntered ? 1 : 0,
            }}
          />
        </div>
        {/* Overlay always sits on a photographic image, so a dark scrim + white type
            reads correctly in both light and dark site themes. */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ background: "linear-gradient(rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.50) 100%)" }}
        >
          <div className="transition-all duration-[900ms] ease-out opacity-0 translate-y-6 [&.revealed]:opacity-100 [&.revealed]:translate-y-0 reveal-on-scroll">
            <p className="uppercase mb-3 font-semibold font-mono" style={{ fontSize: "9px", letterSpacing: "0.32em", color: "rgba(255,255,255,0.85)" }}>
              Luveni Core Systems · {new Date().getFullYear()}
            </p>
            <p className="tracking-tighter text-white font-extralight font-sans" style={{ fontSize: "clamp(26px, 4.5vw, 52px)", lineHeight: 1.1 }}>
              Designed for the<br /><span className="font-semibold text-white">everyday uniform.</span>
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
