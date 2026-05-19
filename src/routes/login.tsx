import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Owner portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const AUTHORIZED_EMAIL = "lukasdubuc@gmail.com";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Auto-redirect if a valid admin session already exists ────────────────
  // This fires on mount so that refreshing /login when already authenticated
  // brings the admin straight back to the dashboard without re-entering creds.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (
        session?.user?.email?.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase()
      ) {
        navigate({ to: "/admin", replace: true });
      }
    });
  }, [navigate]);

  // ── Email / password submit ──────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/admin`,
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email or sign in.");
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Strict email gate — sign out any non-admin who somehow has an account
        if (
          data.user?.email?.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()
        ) {
          await supabase.auth.signOut();
          toast.error("Access restricted to authorised personnel only.");
          return;
        }

        navigate({ to: "/admin", replace: true });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────
  // IMPORTANT: We set the sessionStorage intent flag HERE, before the OAuth
  // redirect fires. The homepage (/) will read this flag after Lovable's proxy
  // drops the user back on "/" and redirect them to /admin if authorised.
  async function onGoogle() {
    setLoading(true);

    try {
      // Plant the intent flag so the homepage redirect intercept activates
      // after the OAuth callback lands on "/".
      sessionStorage.setItem("active_login_intent", "1");

      const result = await lovable.auth.signInWithOAuth("google", {
        redirectTo: `${window.location.origin}/`,
      });

      if (result.error) {
        // If OAuth setup itself fails, remove the flag so the homepage
        // doesn't trigger a spurious redirect for a normal visitor later.
        sessionStorage.removeItem("active_login_intent");
        toast.error(result.error.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }

      // If the provider didn't trigger a browser redirect (e.g. popup mode),
      // fall back to a manual session check and navigate.
      if (!result.redirected) {
        sessionStorage.removeItem("active_login_intent");
        await supabase.auth.refreshSession();
        const { data: { session } } = await supabase.auth.getSession();

        if (
          session?.user?.email?.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()
        ) {
          await supabase.auth.signOut();
          toast.error("Access restricted to authorised personnel only.");
          setLoading(false);
          return;
        }

        navigate({ to: "/admin", replace: true });
      }
      // If result.redirected === true, the browser is navigating away.
      // The sessionStorage flag survives the redirect and will be read
      // by the homepage useEffect. Loading state intentionally stays true
      // because the page is leaving.
    } catch (e: any) {
      sessionStorage.removeItem("active_login_intent");
      console.error("Google Auth Error:", e);
      toast.error(e?.message ?? "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <section className="bg-muted/40 min-h-screen flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md rounded-none border border-border bg-card p-8 shadow-sm">
        {/* Header */}
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-xl font-black uppercase tracking-widest">
            {mode === "signin" ? "Terminal_Login" : "Create_Access"}
          </h1>
          <p className="mt-2 text-[10px] uppercase opacity-50 tracking-tighter">
            Secure connection required // Root Access only.
          </p>
        </div>

        {/* Google OAuth button */}
        <button
          onClick={onGoogle}
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-none border border-black bg-white text-black px-3 text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-30"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Authorize with Google"
          )}
        </button>

        {/* Divider */}
        <div className="my-8 flex items-center gap-4 text-[10px] font-black uppercase opacity-20">
          <div className="h-px flex-1 bg-current" />
          <span>OR</span>
          <div className="h-px flex-1 bg-current" />
        </div>

        {/* Email / password form */}
        <form onSubmit={onSubmit} className="space-y-6">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="EMAIL_ADDRESS"
            className="h-12 w-full rounded-none border border-border bg-muted/20 px-4 text-xs font-bold outline-none focus:border-black transition-all"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ACCESS_KEY"
            className="h-12 w-full rounded-none border border-border bg-muted/20 px-4 text-xs font-bold outline-none focus:border-black transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-none bg-black text-white px-3 text-xs font-black uppercase tracking-widest hover:opacity-80 transition-all disabled:opacity-30"
          >
            {loading && mode !== "signin" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {mode === "signin" ? "Initialize_Session" : "Register_Identity"}
          </button>
        </form>

        {/* Toggle mode */}
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-8 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
        >
          {mode === "signin"
            ? "[ Request_New_Credentials ]"
            : "[ Return_to_Portal ]"}
        </button>
      </div>
    </section>
  );
}

export default LoginPage;
