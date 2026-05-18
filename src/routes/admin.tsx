import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  // We removed the 'throw redirect' from here to stop the loop.
  // This allows the page to load so Supabase can finish the login process.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Owner portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    const verifyAccess = async () => {
      // 1. Give Supabase a moment to find the session from the URL
      const { data: { session } } = await supabase.auth.getSession();

      // 2. If after checking there is definitely no session, send to login
      if (!session) {
        window.location.href = "/login";
        return;
      }

      // 3. If there is a session, check if they are an admin
      try {
        const r = await check();
        setStatus(r.isAdmin ? "ok" : "forbidden");
      } catch (error) {
        console.error("Admin check failed:", error);
        setStatus("forbidden");
      }
    };

    verifyAccess();
  }, [check]);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Checking access…
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't an admin yet. You need to promote your email
            in the Supabase SQL Editor:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-left text-xs">
{`INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'lukasdubuc@gmail.com';`}
          </pre>
          <Link to="/" className="mt-4 inline-block text-sm underline">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}