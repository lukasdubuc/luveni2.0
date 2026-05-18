import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // 1. If no session, kick to login
    if (!session) {
      throw redirect({ to: "/login" });
    }

    // 2. SECURITY LOCK: Only allow your specific email to access the Command Vault
    // This prevents random customers from seeing your revenue/products
    if (session.user.email !== "lukasdubuc@gmail.com") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#000] text-white selection:bg-white selection:text-black antialiased">
      <Outlet />
    </div>
  );
}
