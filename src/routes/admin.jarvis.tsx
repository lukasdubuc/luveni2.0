import { createFileRoute } from '@tanstack/react-router';
import JarvisHub from '../components/jarvis/JarvisHub';

export const Route = createFileRoute('/admin/jarvis')({
  component: JarvisPage,
});

function JarvisPage() {
  return <JarvisHub geminiApiKey="P00nSEM2W2H1qV0KuvyonA08Ns1tV0hL" />;
}
