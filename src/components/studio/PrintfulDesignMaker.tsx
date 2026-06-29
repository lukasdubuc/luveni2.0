// ─────────────────────────────────────────────────────────────
//  PrintfulDesignMaker — Printful's Embedded Design Maker (EDM) in a modal.
//  Mints a session nonce server-side (printful-catalog action "edm-nonce"),
//  loads Printful's embed.js, and mounts the EDM. When a design is saved,
//  any returned preview image is handed back so the editor can drop it in as
//  a Konva layer — closing the loop with our own AI/paint canvas (hybrid).
//
//  Requires the "Embedded Designer" extension enabled on the Printful account.
//  If EDM isn't available the modal surfaces the real Printful error instead
//  of blanking.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const EMBED_JS = "https://files.cdn.printful.com/embed/embed.js";
const CONTAINER_ID = "pf-edm-container";

// Load Printful's embed.js once and resolve when the PFDesignMaker global exists.
function loadEmbedScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.PFDesignMaker) return resolve(w.PFDesignMaker);
    const existing = document.querySelector(`script[src="${EMBED_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).PFDesignMaker));
      existing.addEventListener("error", () => reject(new Error("Failed to load Printful embed.js")));
      return;
    }
    const s = document.createElement("script");
    s.src = EMBED_JS;
    s.async = true;
    s.onload = () => {
      const ctor = (window as any).PFDesignMaker;
      ctor ? resolve(ctor) : reject(new Error("embed.js loaded but PFDesignMaker was not found"));
    };
    s.onerror = () => reject(new Error("Failed to load Printful embed.js"));
    document.body.appendChild(s);
  });
}

export default function PrintfulDesignMaker({
  productId,
  onDesign,
  onClose,
}: {
  productId?: number | string;
  onDesign: (imageUrl: string, name: string) => void; // hand a saved design back to the editor
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        // 1) Mint a session nonce server-side (keeps the Printful token private).
        const { data, error: fnErr } = await supabase.functions.invoke("printful-catalog", {
          body: { action: "edm-nonce", productId },
        });
        if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Could not start the Design Maker");
        if (!data?.nonce) throw new Error("Printful did not return a Design Maker nonce — is the Embedded Designer extension enabled on the account?");

        // 2) Load Printful's embed.js and mount the EDM into our container.
        const PFDesignMaker = await loadEmbedScript();
        const dm = new PFDesignMaker({
          elemId: CONTAINER_ID,
          nonce: data.nonce,
          initProductId: productId ? Number(productId) : undefined,
        });

        // 3) Pull the saved design back into our editor. EDM event/payload shapes
        //    vary by version, so accept the common variants defensively.
        const handleSaved = (payload: any) => {
          const url =
            payload?.preview_url || payload?.previewUrl ||
            payload?.image_url || payload?.imageUrl ||
            payload?.mockups?.[0]?.preview_url || null;
          if (url) {
            onDesign(url, "Printful design");
            toast.success("Imported design from Printful Design Maker.");
          } else {
            toast.success("Design saved in Printful.");
          }
        };
        // Support both the .on(event, cb) and config-callback styles.
        if (typeof dm.on === "function") {
          dm.on("template/saved", handleSaved);
          dm.on("template_saved", handleSaved);
          dm.on("save", handleSaved);
        }

        setStatus("ready");
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus("error");
      }
    })();
  }, [productId, onDesign]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Printful Design Maker</span>
        <button onClick={onClose}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-white/20">
          <X size={13} /> Close
        </button>
      </div>

      <div className="relative flex-1">
        {/* EDM mounts here */}
        <div id={CONTAINER_ID} className="absolute inset-0 bg-white" />

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white/60">
            <Loader2 className="animate-spin" />
            <span className="text-[10px] uppercase tracking-widest">Starting Printful Design Maker…</span>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center bg-black/85 text-white/70">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-red-400">Design Maker unavailable</span>
            <span className="max-w-md text-[11px] leading-relaxed">{error}</span>
            <span className="max-w-md text-[10px] text-white/40">
              The Embedded Design Maker requires the “Embedded Designer” extension to be enabled on the Printful account.
              Your own AI + paint tools in the editor are unaffected.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
