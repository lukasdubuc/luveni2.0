import { createFileRoute, Link } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useRef, useState } from "react";
import { Shield, Sparkles, Eye, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About ${site.brand}` },
      { name: "description", content: `Discover the story and vision behind ${site.brand}.` },
    ],
  }),
  component: About,
});

/* ──────────────────────────────────────────────────────────────────────────
    SINGLE, UNIFIED COMPONENT BLOCK (BUILT TO ELIMINATE PARSING ERRORS)
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

  // ─── SECTION 1: HERO SPOTLIGHT (INTERSECTION SCALE) ───
  const heroLeftColRef = useRef<HTMLDivElement>(null);
  const [heroLeftScale, setHeroLeftScale] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHeroLeftScale(true); } }, { threshold: 0.1 });
    if (heroLeftColRef.current) o.observe(heroLeftColRef.current);
    return () => o.disconnect();
  }, []);

  const heroRightColRef = useRef<HTMLDivElement>(null);
  const [heroRightVisible, setHeroRightVisible] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHeroRightVisible(true); } }, { threshold: 0.1 });
    if (heroRightColRef.current) o.observe(heroRightColRef.current);
    return () => o.disconnect();
  }, []);

  // ─── SECTION 2: ZOOM DETAIL STRIP (FADE-UP STAGGER) ───
  const detailStripRef = useRef<HTMLDivElement>(null);
  const [detailStripVisible, setDetailStripVisible] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDetailStripVisible(true); } }, { threshold: 0.1 });
    if (detailStripRef.current) o.observe(detailStripRef.current);
    return () => o.disconnect();
  }, []);

  // ─── SECTION 3: STORY & VALUES (TWO COLUMNS REVEAL) ───
  const storyBlockRef = useRef<HTMLDivElement>(null);
  const [storyBlockVisible, setStoryBlockVisible] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStoryBlockVisible(true); } }, { threshold: 0.05 });
    if (storyBlockRef.current) o.observe(storyBlockRef.current);
    return () => o.disconnect();
  }, []);

  // ─── SECTION 4: HAT 360° SCROLL ROTATOR (INTERSECTION OBSERVER DRIVEN) ───
  const [hatAngleIndex, setHatAngleIndex] = useState(0);
  
  // Frame trigger refs
  const triggerRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null)
  ];

  useEffect(() => {
    const observers = triggerRefs.map((ref, idx) => {
      const o = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          setHatAngleIndex(idx);
        }
      }, { threshold: 0.5, rootMargin: "-10% 0px -10% 0px" });
      if (ref.current) o.observe(ref.current);
      return o;
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  // ─── ARRAYS CONFIGURATION ───
  const hatAngles = [
    { name: "Front Flat View", src: HAT_ANGLE_0 },
    { name: "Front Left Tilt", src: HAT_ANGLE_1 },
    { name: "Left Profile (Logo Detail)", src: HAT_ANGLE_2 },
    { name: "Back View (Brass Adjuster)", src: HAT_ANGLE_3 },
    { name: "Right Profile (Minimal)", src: HAT_ANGLE_4 },
    { name: "Front Right Tilt", src: HAT_ANGLE_5 },
  ];

  const zoomColumns = [
    {
      img: TSHIRT_2,
      label: "Construction",
      heading: "Ribbed collar",
      copy: "Double-needle neck ribbing designed to hold structured form wash after wash."
    },
    {
      img: GRAPHIC_LOGO,
      label: "Signature",
      heading: "Bonsai mark",
      copy: "Marked by the resilient Kuffiyeh Girl print—a subtle cultural emblem that is balanced, slow, and persistent."
    },
    {
      img: TSHIRT_3,
      label: "Sensory",
      heading: "Textured organic cotton",
      copy: "Heavyweight combed cotton providing perfect drape, structural breathability and tactile feel."
    }
  ];

  const brandValues = [
    { icon: Shield, title: "Quality first", desc: "Combed, heavyweight organic cotton crafted to resist distortion and wear over time." },
    { icon: Sparkles, title: "Beyond trends", desc: "Relaxed silhouettes and neutral colorways designed to outlive fast fashion cycles." },
    { icon: Eye, title: "Radical focus", desc: "Deliberate removal of visual noise to bring premium materials and cuts to focus." },
    { icon: Users, title: "Conscious connection", desc: "Connecting small-batch producers with wearers who value intentional craftsmanship." },
  ];

  return (
    <div className="about-page w-full bg-black text-white" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui" }}>
      
      {/* ───────────────────────────────────────────────────────────────────
          A. STICKY PRO NAV BAR
          ─────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-2xl" style={{ background: "rgba(0,0,0,0.72)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto flex h-11 max-w-[1200px] items-center justify-between px-6">
          <span className="text-[13px] font-medium tracking-tight text-white/90">{site.brand}</span>
          <div className="hidden items-center gap-7 text-[11px] text-white/60 sm:flex">
            <a href="#overview" className="transition-colors hover:text-white">Overview</a>
            <a href="#anatomy" className="transition-colors hover:text-white">Anatomy</a>
            <a href="#story" className="transition-colors hover:text-white">Philosophy</a>
            <a href="#rotator" className="transition-colors hover:text-white">Perspectives</a>
          </div>
          <Link to="/shop" className="rounded-full bg-white px-3.5 py-1 text-[11px] font-medium text-black transition-opacity hover:opacity-90">Shop</Link>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          B. PRODUCT HERO SECTION (GZ R-01 CINEMATIC VIEW)
          ─────────────────────────────────────────────────────────────────── */}
      <section id="overview" className="grid grid-cols-1 md:grid-cols-2 border-b border-white/5 min-h-[92vh]">
        
        {/* LEFT — Product image viewport */}
        <div ref={heroLeftColRef} className="relative bg-[#080808] flex items-center justify-center overflow-hidden h-[50vh] md:h-auto min-h-[420px]">
          {/* Subtle blueprint grid coordinates background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0" style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 44px"
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 65%)" }} />
          
          <img
            src={TSHIRT_1}
            alt="GZ R-01 front view"
            className="max-h-[82%] max-w-[82%] object-contain select-none"
            style={{
              transform: heroLeftScale ? "scale(1.12)" : "scale(1.0)",
              transition: "transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            draggable={false}
          />
        </div>

        {/* RIGHT — Technical Specs details */}
        <div ref={heroRightColRef} className="flex flex-col justify-center px-8 py-16 sm:px-12 md:px-16 lg:px-24 bg-black" style={{
          opacity: heroRightVisible ? 1 : 0,
          transform: heroRightVisible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <span className="text-[10px] font-mono tracking-[0.25em] text-neutral-500 uppercase">
            SIGNATURE PIECE · GZ R-01
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tighter text-white mt-3 mb-6">
            The one you<br /><span className="font-semibold text-white">reach for first.</span>
          </h1>
          <p className="text-sm leading-relaxed text-neutral-400 mb-8 max-w-md font-light">
            Heavyweight combed organic cotton. A bespoke kuffiyeh graphic reduced to its most essential form, bringing cultural significance and steady resilience into daily uniform rotation.
          </p>

          {/* Clean specs grid */}
          <div className="grid grid-cols-2 mb-8 border-t border-b border-white/5 py-4 gap-y-4">
            <div>
              <span className="text-[8.5px] font-mono tracking-widest text-neutral-500 uppercase block">Material</span>
              <span className="text-xs font-semibold text-white mt-0.5 block">100% Organic Cotton</span>
            </div>
            <div>
              <span className="text-[8.5px] font-mono tracking-widest text-neutral-500 uppercase block">Fit</span>
              <span className="text-xs font-semibold text-white mt-0.5 block">Relaxed / Boxy</span>
            </div>
            <div>
              <span className="text-[8.5px] font-mono tracking-widest text-neutral-500 uppercase block">Weight</span>
              <span className="text-xs font-semibold text-white mt-0.5 block">Heavyweight 240 GSM</span>
            </div>
            <div>
              <span className="text-[8.5px] font-mono tracking-widest text-neutral-500 uppercase block">Care</span>
              <span className="text-xs font-semibold text-white mt-0.5 block">Machine Wash Cold</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase">Hardware Price</span>
            <span className="text-3xl font-light tracking-tighter text-white ml-2">$28</span>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          C. SECTION 2: ZOOM DETAIL STRIP (STAGGER REVEAL)
          ─────────────────────────────────────────────────────────────────── */}
      <section id="anatomy" ref={detailStripRef} className="border-b border-white/5 bg-black py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="max-w-lg">
            <span className="text-[9px] font-mono tracking-[0.25em] text-neutral-500 uppercase block mb-2">Structure detail</span>
            <h2 className="text-3xl font-light tracking-tighter text-white">Every stitch, systematically resolved.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {zoomColumns.map((col, idx) => (
              <div
                key={idx}
                className="group flex flex-col pointer-events-auto"
                style={{
                  opacity: detailStripVisible ? 1 : 0,
                  transform: detailStripVisible ? "translateY(0)" : "translateY(24px)",
                  transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: detailStripVisible ? `${idx * 150}ms` : "0ms",
                }}
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-950 flex items-center justify-center p-6 border border-white/5 rounded-[24px]">
                  <img src={col.img} alt={col.heading} className="max-h-[92%] max-w-[92%] object-contain select-none transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="mt-6 space-y-2">
                  <span className="text-[9px] font-mono tracking-[0.2em] text-neutral-500 uppercase block">{col.label}</span>
                  <h3 className="text-lg font-medium text-white">{col.heading}</h3>
                  <p className="text-xs leading-relaxed text-neutral-400 font-light">{col.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          D. SECTION 3: STORY & VALUES (TWO COLUMNS REVEAL)
          ─────────────────────────────────────────────────────────────────── */}
      <section id="story" ref={storyBlockRef} className="border-b border-white/5 bg-black py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24" style={{
          opacity: storyBlockVisible ? 1 : 0,
          transform: storyBlockVisible ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)"
        }}>
          {/* Left: Headline & body */}
          <div className="flex flex-col justify-center">
            <span className="text-neutral-500 uppercase mb-4 text-[9px] font-mono tracking-[0.26em]">The Story</span>
            <h2 className="text-white tracking-tighter text-3xl sm:text-4xl lg:text-5xl font-light leading-tight mb-6">
              Cut through the noise<br />of fast fashion.
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-neutral-400 font-light font-sans">
              <p>
                We believe what you wear should be as functional as it is aesthetic. {site.brand} exists to cut through the noise of fast fashion — offering pieces that prioritize longevity over trends.
              </p>
              <p>
                Every garment is crafted to be a staple in your rotation. Designed to feel better, last longer, and fit seamlessly into your personal style.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 text-xs text-neutral-500 font-light font-mono">
              Inquiries / <a href="mailto:luveni.apparel@gmail.com" className="text-white underline underline-offset-2 hover:opacity-75 transition-opacity">luveni.apparel@gmail.com</a>
            </div>
          </div>

          {/* Right: 2x2 Values */}
          <div className="flex items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              {brandValues.map((v, i) => {
                const Icon = v.icon;
                return (
                  <div key={i} className="space-y-4">
                    <div className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center border border-white/5">
                      <Icon size={14} className="text-white" />
                    </div>
                    <h4 className="text-sm font-semibold text-white tracking-tight">{v.title}</h4>
                    <p className="text-xs leading-relaxed text-neutral-400 font-light">{v.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          E. SECTION 4: ASYNCHRONOUS SCROLL ROTATOR (HAT PRESENTATION)
          ─────────────────────────────────────────────────────────────────── */}
      <section id="rotator" ref={rotatorContainerRef} className="relative bg-black border-b border-white/5" style={{ height: "240vh" }}>
        
        {/* Scroll structural triggers inside container */}
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none flex flex-col justify-between">
          <div ref={triggerRefs[0]} className="h-10 w-full" />
          <div ref={triggerRefs[1]} className="h-10 w-full" />
          <div ref={triggerRefs[2]} className="h-10 w-full" />
          <div ref={triggerRefs[3]} className="h-10 w-full" />
          <div ref={triggerRefs[4]} className="h-10 w-full" />
          <div ref={triggerRefs[5]} className="h-10 w-full" />
        </div>

        <div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden">
          <BlueprintGrid />
          
          <div className="pt-20 px-6 text-center z-20">
            <p className="text-[10px] font-mono tracking-[0.3em] text-neutral-500 uppercase mb-2">Sub-Highlight Piece</p>
            <h2 className="text-white tracking-tighter text-3xl sm:text-5xl font-extralight">
              Embroidered Dad Hat.<br />
              <span className="font-semibold text-white">Rotatable perspective.</span>
            </h2>
          </div>

          {/* 360° Stack Stage - Preloads all images inside absolute layout to guarantee zero lag */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-[340px] flex items-center justify-center">
              <div className="absolute inset-0 pointer-events-none rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.035) 0%, transparent 65%)" }} />
              {hatAngles.map((angle, idx) => (
                <img
                  key={idx}
                  src={angle.src}
                  alt={`Heart dad hat angle - ${angle.name}`}
                  className="absolute max-h-[85%] max-w-[85%] object-contain select-none transition-all duration-300"
                  style={{
                    opacity: hatAngleIndex === idx ? 1 : 0,
                    visibility: hatAngleIndex === idx ? "visible" : "hidden",
                    filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.85))",
                  }}
                  draggable={false}
                />
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
                <button
                  key={idx}
                  onClick={() => {
                    if (triggerRefs[idx].current) {
                      triggerRefs[idx].current.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  className={`h-1.5 rounded-full transition-all duration-500 ${hatAngleIndex === idx ? "w-5 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
