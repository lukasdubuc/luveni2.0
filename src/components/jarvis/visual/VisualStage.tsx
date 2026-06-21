// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/visual/VisualStage.tsx
//
//  Desktop-only "Astra's screen": a 4K-clean MacBook that snaps open
//  (lid down → up, fast + smooth) and displays the visual answer —
//  a simulated Google page, an image gallery, or the live shop.
//
//  Purely presentational. The parent mounts it only on desktop and
//  only when a `visual` payload exists; unmounting it plays nothing,
//  so the parent also runs the closing card transition in tandem.
// ─────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import type { VisualPayload } from './types';
import BrowserView from './BrowserView';
import ImageGridView from './ImageGridView';
import SiteView from './SiteView';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Content({ visual }: { visual: VisualPayload }) {
  if (visual.kind === 'images') return <ImageGridView query={visual.query} images={visual.images} />;
  if (visual.kind === 'site')   return <SiteView path={visual.path} />;
  return <BrowserView query={visual.query} results={visual.results} images={visual.images} />;
}

export default function VisualStage({ visual }: { visual: VisualPayload }) {
  const key = `${visual.kind}:${visual.query}`;

  return (
    <div style={S.overlay}>
      {/* soft theatrical wash so the device pops in both themes */}
      <div style={S.wash} />

      <motion.div
        style={S.perspective}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div style={S.device}>
          {/* Screen / lid — hinges up from flat-closed to open */}
          <motion.div
            style={S.screen}
            initial={{ rotateX: -92 }}
            animate={{ rotateX: 0 }}
            transition={{ delay: 0.12, duration: 0.62, ease: EASE }}
          >
            <div style={S.notch} />
            <div style={S.display}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, delay: 0.18 }}
                  style={S.displayInner}
                >
                  <Content visual={visual} />
                </motion.div>
              </AnimatePresence>
              {/* subtle screen glass sheen */}
              <div style={S.sheen} />
            </div>
          </motion.div>

          {/* Base / keyboard deck */}
          <div style={S.deck}>
            <div style={S.hinge} />
            <div style={S.notchOut} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const SCREEN_W = 'min(76vw, 1200px)';

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  wash: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'radial-gradient(circle at 58% 48%, color-mix(in srgb, var(--foreground) 6%, transparent) 0%, transparent 62%)',
  },
  perspective: { perspective: 2000, pointerEvents: 'auto', marginTop: 8 },
  device: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', transformStyle: 'preserve-3d' },

  // Lid — dark aluminium bezel around the display
  screen: {
    width: SCREEN_W,
    aspectRatio: '16 / 10',
    transformOrigin: '50% 100%',
    transformStyle: 'preserve-3d',
    background: '#0b0b0d',
    borderRadius: '22px 22px 6px 6px',
    padding: '14px',
    boxSizing: 'border-box',
    boxShadow: '0 50px 100px rgba(0,0,0,0.5), 0 0 0 2px #1d1d1f, inset 0 0 0 1px rgba(255,255,255,0.05)',
    position: 'relative',
  },
  notch: {
    position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
    width: 150, height: 18, background: '#0b0b0d', borderRadius: '0 0 12px 12px', zIndex: 3,
  },
  display: {
    width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden',
    background: '#fff', position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
  },
  displayInner: { position: 'absolute', inset: 0 },
  sheen: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)',
  },

  // Base — aluminium wedge, SAME width as the lid, with a centred finger-groove
  deck: {
    width: SCREEN_W,
    height: 16,
    marginTop: 0,
    background: 'linear-gradient(180deg, #e3e6ea 0%, #c2c7ce 42%, #969ba3 100%)',
    borderRadius: '2px 2px 13px 13px',
    position: 'relative',
    boxShadow: '0 30px 55px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
  },
  hinge: {
    position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
    width: 'calc(100% - 26px)', height: 4,
    background: 'linear-gradient(180deg, #3a3d42, #1f2125)',
    borderRadius: '0 0 3px 3px',
  },
  notchOut: {
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    width: 130, height: 9, background: '#aeb3bb', borderRadius: '0 0 11px 11px',
  },
};
