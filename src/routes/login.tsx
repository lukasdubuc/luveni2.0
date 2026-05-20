import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email?.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase()) {
        navigate({ to: "/admin", replace: true });
      }
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
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

        if (data.user?.email?.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
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

  async function onGoogle() {
    setLoading(true);
    try {
      sessionStorage.setItem("active_login_intent", "1");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        sessionStorage.removeItem("active_login_intent");
        toast.error(error.message ?? "Google sign-in failed");
        setLoading(false);
      }
      // If no error, browser is redirecting — leave loading=true intentionally
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
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-xl font-black uppercase tracking-widest">
            {mode === "signin" ? "Terminal_Login" : "Create_Access"}
          </h1>
          <p className="mt-2 text-[10px] uppercase opacity-50 tracking-tighter">
            Secure connection required // Root Access only.
          </p>
        </div>

        <button
          onClick={onGoogle}
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-none border border-black bg-white text-black px-3 text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-30"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authorize with Google"}
        </button>

        {/* Dev-only guest login: visible only on localhost or dev mode */}
        {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV) && (
          <button
            onClick={() => {
              localStorage.setItem('dev_guest', '1');
              navigate({ to: '/admin', replace: true });
            }}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-none border border-white/10 bg-white/5 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
            title="Dev-only: bypass admin auth on localhost"
          >
            Dev Guest Login
          </button>
        )}

        <div className="my-8 flex items-center gap-4 text-[10px] font-black uppercase opacity-20">
          <div className="h-px flex-1 bg-current" />
          <span>OR</span>
          <div className="h-px flex-1 bg-current" />
        </div>

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
            {loading && mode !== "signin" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Initialize_Session" : "Register_Identity"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-8 w-full text-center text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
        >
          {mode === "signin" ? "[ Request_New_Credentials ]" : "[ Return_to_Portal ]"}
        </button>
      </div>
    </section>
  );
}

export default LoginPage;
