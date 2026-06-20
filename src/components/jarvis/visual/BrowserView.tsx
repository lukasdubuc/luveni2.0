// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/visual/BrowserView.tsx
//
//  A convincing, self-rendered "Chrome → Google results" page. Not a
//  real iframe (cross-origin sites block embedding) — a controlled
//  simulation populated from live Tavily data. Always light (it's a
//  browser), regardless of app theme.
// ─────────────────────────────────────────────────────────────

import { motion } from 'framer-motion';
import type { VisualResult } from './types';

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function crumbOf(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean).slice(0, 2);
    return [u.hostname.replace(/^www\./, ''), ...parts].join(' › ');
  } catch { return url; }
}
const favicon = (url: string) =>
  `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostOf(url))}`;

export default function BrowserView({
  query, results, images,
}: { query: string; results: VisualResult[]; images: string[] }) {
  return (
    <div style={S.page}>
      {/* Google-style header */}
      <div style={S.header}>
        <span style={S.logo}>
          <span style={{ color: '#4285F4' }}>G</span>
          <span style={{ color: '#EA4335' }}>o</span>
          <span style={{ color: '#FBBC05' }}>o</span>
          <span style={{ color: '#4285F4' }}>g</span>
          <span style={{ color: '#34A853' }}>l</span>
          <span style={{ color: '#EA4335' }}>e</span>
        </span>
        <div style={S.searchPill}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="#9aa0a6" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={S.queryText}>{query}</span>
        </div>
      </div>

      <div style={S.tabs}>
        {['All', 'Images', 'News', 'Videos', 'Maps'].map((t, i) => (
          <span key={t} style={{ ...S.tab, ...(i === 0 ? S.tabActive : {}) }}>{t}</span>
        ))}
      </div>

      <div style={S.body}>
        <div style={S.results}>
          <div style={S.statsLine}>About {(results.length * 137).toLocaleString()},000 results (0.42 seconds)</div>
          {results.map((r, i) => (
            <motion.a
              key={r.url + i}
              href={r.url} target="_blank" rel="noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.35 }}
              style={S.result}
            >
              <div style={S.resultTop}>
                <img src={favicon(r.url)} alt="" style={S.fav} />
                <div style={{ minWidth: 0 }}>
                  <div style={S.site}>{hostOf(r.url)}</div>
                  <div style={S.crumb}>{crumbOf(r.url)}</div>
                </div>
              </div>
              <div style={S.title}>{r.title}</div>
              <div style={S.snippet}>{r.snippet}</div>
            </motion.a>
          ))}
          {results.length === 0 && <div style={S.empty}>No results to display.</div>}
        </div>

        {images.length > 0 && (
          <div style={S.sidebar}>
            <div style={S.sideHead}>Images</div>
            <div style={S.imgGrid}>
              {images.slice(0, 6).map((src, i) => (
                <motion.div
                  key={src + i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
                  style={S.imgCell}
                >
                  <img src={src} alt="" referrerPolicy="no-referrer" style={S.img} />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { width: '100%', height: '100%', background: '#fff', color: '#202124', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'arial, sans-serif', textTransform: 'none' },
  header: { display: 'flex', alignItems: 'center', gap: 22, padding: '18px 28px 10px', borderBottom: '1px solid #ebebeb' },
  logo: { fontSize: 26, fontWeight: 500, letterSpacing: '-1px' },
  searchPill: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 560, height: 44, border: '1px solid #dfe1e5', borderRadius: 24, padding: '0 18px', boxShadow: '0 1px 6px rgba(32,33,36,.08)' },
  queryText: { fontSize: 16, color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tabs: { display: 'flex', gap: 26, padding: '0 28px', borderBottom: '1px solid #ebebeb' },
  tab: { fontSize: 13, color: '#5f6368', padding: '12px 0' },
  tabActive: { color: '#1a73e8', borderBottom: '3px solid #1a73e8', fontWeight: 500 },
  body: { display: 'flex', gap: 32, padding: '18px 28px', overflowY: 'auto', flex: 1 },
  results: { flex: 1, minWidth: 0, maxWidth: 620 },
  statsLine: { fontSize: 12, color: '#70757a', marginBottom: 18 },
  result: { display: 'block', marginBottom: 26, textDecoration: 'none', color: 'inherit' },
  resultTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  fav: { width: 26, height: 26, borderRadius: '50%', border: '1px solid #ececec', background: '#f8f8f8' },
  site: { fontSize: 14, color: '#202124', lineHeight: 1.2 },
  crumb: { fontSize: 12, color: '#5f6368', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  title: { fontSize: 20, color: '#1a0dab', lineHeight: 1.3, marginBottom: 3 },
  snippet: { fontSize: 14, color: '#4d5156', lineHeight: 1.58 },
  empty: { fontSize: 14, color: '#70757a' },
  sidebar: { width: 240, flexShrink: 0 },
  sideHead: { fontSize: 13, color: '#5f6368', marginBottom: 10, fontWeight: 500 },
  imgGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  imgCell: { aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: '#f1f3f4' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
};
