import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Guards admin routes. Verifies (a) a Supabase session exists and
 * (b) the user has the 'admin' role via the has_role RPC.
 * Redirects to /login otherwise.
 *
 * Dev-only bypass: on localhost or DEV builds, a `dev_guest=1` flag
 * in localStorage skips the check (mirrors prior behavior; DB RLS still applies).
 */
export async function requireAdmin() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isDev =
      host === "localhost" ||
      host === "127.0.0.1" ||
      (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV);
    if (isDev && localStorage.getItem("dev_guest") === "1") return;
  } else {
    // SSR: defer the check to the client.
    return;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    throw redirect({ to: "/login" });
  }

  const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });

  if (roleErr || !isAdmin) {
    await supabase.auth.signOut();
    throw redirect({ to: "/login" });
  }
}
