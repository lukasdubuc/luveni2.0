import { createFileRoute } from '@tanstack/react-router';
import JarvisHub from '../components/jarvis/JarvisHub';

export const Route = createFileRoute('/admin/jarvis')({
  component: () => <JarvisHub geminiApiKey="P00nSEM2W2H1qV0KuvyonA08Ns1tV0hL" autoStart />,
});
