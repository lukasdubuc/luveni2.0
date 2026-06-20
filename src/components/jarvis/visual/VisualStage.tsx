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

const SCREEN_W = 'min(74vw, 1180px)';

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
  perspective: { perspective: 1700, pointerEvents: 'auto', marginTop: 8 },
  device: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', transformStyle: 'preserve-3d' },
  screen: {
    width: SCREEN_W,
    aspectRatio: '16 / 10',
    transformOrigin: '50% 100%',
    transformStyle: 'preserve-3d',
    background: 'linear-gradient(180deg, #1c1c1e 0%, #0e0e10 100%)',
    borderRadius: '18px 18px 6px 6px',
    padding: 12,
    boxSizing: 'border-box',
    boxShadow: '0 40px 90px rgba(0,0,0,0.45), 0 0 0 2px #2a2a2c, inset 0 0 0 1px rgba(255,255,255,0.04)',
    position: 'relative',
  },
  notch: {
    position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
    width: 120, height: 7, background: '#0a0a0b', borderRadius: '0 0 8px 8px', zIndex: 2,
  },
  display: {
    width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden',
    background: '#fff', position: 'relative',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
  },
  displayInner: { position: 'absolute', inset: 0 },
  sheen: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)',
  },
  deck: {
    width: 'calc(min(74vw, 1180px) + 86px)',
    height: 22,
    marginTop: -2,
    background: 'linear-gradient(180deg, #c8ccd2 0%, #a7adb6 55%, #7e848d 100%)',
    borderRadius: '8px 8px 14px 14px',
    clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)',
    position: 'relative',
    boxShadow: '0 26px 40px rgba(0,0,0,0.32)',
  },
  hinge: {
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    width: 'min(74vw, 1180px)', height: 5,
    background: 'linear-gradient(180deg, #5b5f66, #3a3d42)',
    borderRadius: '0 0 4px 4px',
  },
  notchOut: {
    position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
    width: 110, height: 9, background: 'linear-gradient(180deg,#9aa0a8,#7c828b)', borderRadius: '0 0 9px 9px',
  },
};
