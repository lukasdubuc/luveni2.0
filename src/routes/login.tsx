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

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if session already exists
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email?.toLowerCase() === "lukasdubuc@gmail.com") {
        navigate({ to: "/admin" });
      }
    };
    checkUser();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin/` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email or sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin" });
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
      // Pass redirect parameters directly into the lovable auth helper
      const result = await lovable.auth.signInWithOAuth("google", {
        redirectTo: `${window.location.origin}/admin`,
      });

      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }

      // Small delay to let the cookie settle before manual navigation
      if (!result.redirected) {
        setTimeout(async () => {
          await supabase.auth.refreshSession();
          navigate({ to: "/admin" });
        }, 500);
      }
    } catch (e: any) {
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
