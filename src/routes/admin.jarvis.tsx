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
    <div style={{ 
      minHeight: '100vh', 
      width: '100vw',
      // Restores the high-definition 4K inspired dark gradient background
      background: 'radial-gradient(circle at 50% 50%, #0a0e14 0%, #020408 100%)',
      color: '#fff', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
      position: 'relative',
      boxSizing: 'border-box'
    }}>
      <JarvisHub autoStart={true} />
    </div>
  ),
});
