// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/visual/ImageGridView.tsx
//
//  Clean "here's a picture of X" gallery: a hero image + a staggered
//  thumbnail grid. Rendered inside the MacBook screen.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function ImageGridView({ query, images }: { query: string; images: string[] }) {
  const [hero, setHero] = useState(0);
  const list = images.length ? images : [];

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <span style={S.eyebrow}>Showing</span>
        <span style={S.title}>{query}</span>
      </div>

      {list.length === 0 ? (
        <div style={S.empty}>No images found, sir.</div>
      ) : (
        <div style={S.layout}>
          <motion.div
            key={hero}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={S.heroWrap}
          >
            <img src={list[hero]} alt={query} referrerPolicy="no-referrer" style={S.hero} />
          </motion.div>

          <div style={S.thumbs}>
            {list.slice(0, 9).map((src, i) => (
              <motion.button
                key={src + i}
                onClick={() => setHero(i)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.05, duration: 0.3 }}
                style={{ ...S.thumb, outline: i === hero ? '3px solid #6aa6ff' : '1px solid rgba(0,0,0,0.08)' }}
              >
                <img src={src} alt="" referrerPolicy="no-referrer" style={S.thumbImg} />
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', height: '100%', background: '#0b0b0c', color: '#fff', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', textTransform: 'none', overflow: 'hidden' },
  head: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16, flexShrink: 0 },
  eyebrow: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' },
  title: { fontSize: 22, fontWeight: 600, textTransform: 'capitalize' },
  layout: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, flex: 1, minHeight: 0 },
  heroWrap: { borderRadius: 14, overflow: 'hidden', background: '#161617', minHeight: 0 },
  hero: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbs: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridAutoRows: 'min-content', gap: 8, overflowY: 'auto', alignContent: 'start' },
  thumb: { aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', padding: 0, border: 'none', background: '#161617', cursor: 'pointer' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' },
};
