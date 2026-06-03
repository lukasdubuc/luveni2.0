import { createFileRoute } from '@tanstack/react-router';
import JarvisHub from '../components/jarvis/JarvisHub';
import { CartProvider } from '@/hooks/use-cart'; // Import the site's CartProvider

// 1. Register the route path
export const Route = createFileRoute('/admin/jarvis')({
  component: JarvisPage,
});

// 2. Define the component
function JarvisPage() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';

  if (!apiKey) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Courier New', monospace", color: 'rgba(255,60,60,0.7)', fontSize: 12, letterSpacing: 4, gap: 16 }}>
        <div>GEMINI API KEY MISSING</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 2 }}>
          Add VITE_GEMINI_API_KEY to your .env file
        </div>
      </div>
    );
  }

  // Wrap JarvisHub in the CartProvider so that internal hooks can query cart state
  return (
    <CartProvider>
      <JarvisHub geminiApiKey={apiKey} />
    </CartProvider>
  );
}
