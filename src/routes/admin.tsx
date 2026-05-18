import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session exists, send to login
    if (!session) {
      throw redirect({ to: "/login" });
    }

    // AUTH LOCK: Ensure only you can see the money
    if (session.user.email !== "lukasdubuc@gmail.com") {
      console.warn("Unauthorized access attempt by:", session.user.email);
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <div className="min-h-screen bg-black">
      <Outlet />
    </div>
  ),
});
