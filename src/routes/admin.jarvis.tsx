// ─────────────────────────────────────────────────────────────
//  src/routes/admin.jarvis.tsx
// ─────────────────────────────────────────────────────────────
import { createFileRoute } from '@tanstack/react-router';
import JarvisHub from '../components/jarvis/JarvisHub';

export const Route = createFileRoute('/admin/jarvis')({
  component: () => (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#020408', 
      color: '#fff', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      fontFamily: 'monospace'
    }}>
      <JarvisHub 
        geminiApiKey="P00nSEM2W2H1qV0KuvyonA08Ns1tV0hL" 
        autoStart={true} 
      />
    </div>
  ),
});
