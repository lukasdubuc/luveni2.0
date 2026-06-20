// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/visual/SiteView.tsx
//
//  "How's the shop looking?" → a live iframe of our OWN site (same
//  origin, so embedding is allowed) wrapped in a browser chrome so it
//  reads as Astra pulling the store up on screen.
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react';

export default function SiteView({ path = '/shop' }: { path?: string }) {
  const url = useMemo(() => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }, [path]);

  const display = url.replace(/^https?:\/\//, '');

  return (
    <div style={S.wrap}>
      <div style={S.chrome}>
        <span style={{ ...S.dot, background: '#ff5f57' }} />
        <span style={{ ...S.dot, background: '#febc2e' }} />
        <span style={{ ...S.dot, background: '#28c840' }} />
        <div style={S.addr}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="#6b7280" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#6b7280" strokeWidth="2" />
          </svg>
          <span style={S.addrText}>{display}</span>
        </div>
      </div>
      <iframe
        src={url}
        title="Luveni store"
        style={S.frame}
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden', textTransform: 'none' },
  chrome: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f2f3f5', borderBottom: '1px solid #e3e5e8', flexShrink: 0 },
  dot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  addr: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginLeft: 10, height: 30, background: '#fff', border: '1px solid #e3e5e8', borderRadius: 16, padding: '0 14px' },
  addrText: { fontSize: 13, color: '#3c4043', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  frame: { flex: 1, width: '100%', border: 'none', background: '#fff' },
};
