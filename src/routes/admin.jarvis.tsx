// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | src/routes/admin.jarvis.tsx
// ─────────────────────────────────────────────────────────────
import { createFileRoute } from '@tanstack/react-router';
import JarvisHub from '@/components/jarvis/JarvisHub';
import { requireAdmin } from '@/lib/admin-guard';

export const Route = createFileRoute('/admin/jarvis')({
  ssr: false,
  beforeLoad: requireAdmin,
  component: () => (
    // Theme-aware shell — the surface palette comes from the site's CSS
    // variable system (light/dark), no longer hardcoded dark.
    <div
      className="admin-page"
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'var(--background)',
        color: 'var(--foreground)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <JarvisHub autoStart={true} />
    </div>
  ),
});
