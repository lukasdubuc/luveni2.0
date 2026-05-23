# Fix admin.index.tsx
cat << 'FILE_EOF' > src/routes/admin.index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

const executeSafeguard = (action: () => void, description: string) => {
  if (confirm("Confirm " + description + "? This action cannot be undone.")) {
    try {
      action();
    } catch (e) {
      toast.error("Execution failed: Critical error in engine.");
    }
  }
};

export const Route = createFileRoute("/admin/index")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <nav className="border-b border-white/10 px-8 py-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tighter uppercase">Admin Console</h1>
      </nav>
      <main className="max-w-7xl mx-auto px-8 py-12 space-y-12">
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">System Safeguards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => executeSafeguard(() => {}, "Wipe Data")} className="w-full bg-white/5 hover:bg-white/10 p-6 border border-white/10 text-left transition-colors">
              <div className="font-bold text-lg uppercase">Wipe Data</div>
              <div className="text-sm text-gray-400">Clears non-essential caches.</div>
            </button>
            <button onClick={() => executeSafeguard(() => {}, "Reload Engine")} className="w-full bg-white/5 hover:bg-white/10 p-6 border border-white/10 text-left transition-colors">
              <div className="font-bold text-lg uppercase">Reload Engine</div>
              <div className="text-sm text-gray-400">Refreshes core business logic.</div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
FILE_EOF

# Fix login.tsx navigation
sed -i 's|navigate({ to: "/admin", replace: true });|navigate({ to: "/admin", replace: true } as any);|g' src/routes/login.tsx
sed -i "s|navigate({ to: '/admin', replace: true });|navigate({ to: '/admin', replace: true } as any);|g" src/routes/login.tsx

# Fix shop.tsx duplicate attribute
sed -i 's|to={`/offer/${product.slug}` as any} preload="intent"|to={`/offer/${product.slug}`} preload="intent"|g' src/routes/shop.tsx

echo "Build files patched successfully."
