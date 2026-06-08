import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Owner portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  return !error && data === true;
}

// Simple pulsing LED indicator for connection status and hardware modes
function LedIndicator({ color, active = true }: { color: "green" | "yellow" | "red" | "cyan" | "neutral"; active?: boolean }) {
  const colorMap = {
    green: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    yellow: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
    red: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
    cyan: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]",
    neutral: "bg-neutral-400 shadow-[0_0_6px_rgba(163,163,163,0.5)]",
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full transition-all duration-300 ${colorMap[color]} ${active ? "animate-pulse" : ""}`} />
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Read dark mode state from root layout/localstorage to avoid theme mismatch flashes
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  // Live DNS connection status to diagnose errors like ERR_NAME_NOT_RESOLVED
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    // Pings the Supabase endpoint to verify the DNS resolves successfully
    const probeSupabaseDNS = async () => {
      try {
        const url = supabase.supabaseUrl;
        await fetch(`${url}/auth/v1/health`, { method: "HEAD", mode: "no-cors" });
        setConnectionStatus("online");
      } catch (e) {
        setConnectionStatus("offline");
      }
    };
    probeSupabaseDNS();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user && (await isAdminUser(user.id))) {
        navigate({ to: "/admin", replace: true } as any);
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

        if (!data.user || !(await isAdminUser(data.user.id))) {
          await supabase.auth.signOut();
          toast.error("Access restricted to authorised personnel only.");
          return;
        }

        navigate({ to: "/admin", replace: true } as any);
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
          redirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) {
        sessionStorage.removeItem("active_login_intent");
        toast.error(error.message ?? "Google sign-in failed");
        setLoading(false);
      }
    } catch (e: any) {
      sessionStorage.removeItem("active_login_intent");
      console.error("Google Auth Error:", e);
      toast.error(e?.message ?? "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <section className={`min-h-screen flex items-center justify-center p-4 font-mono relative transition-colors duration-300 ${
      isDark ? "bg-black text-white" : "bg-neutral-50 text-black"
    }`}>
      {/* Background Matrix Dotted Grid */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04] z-0"
        style={{
          backgroundImage: `radial-gradient(${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
          backgroundSize: '16px 16px'
        }}
      />

      <div className={`w-full max-w-md border p-8 rounded relative z-10 shadow-sm transition-all ${
        isDark ? "bg-neutral-950/40 border-neutral-850" : "bg-white border-neutral-200"
      }`}>
        {/* Connection Diagnostics Overlay */}
        <div className="absolute -top-4 left-6 flex items-center gap-2 px-3 py-1 text-[8px] font-mono font-bold tracking-widest border rounded uppercase transition-colors z-20 shadow-sm bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-850">
          {connectionStatus === "checking" && (
            <>
              <LedIndicator color="yellow" />
              <span className="text-neutral-500">PROBING_HOST_DNS...</span>
            </>
          )}
          {connectionStatus === "online" && (
            <>
              <LedIndicator color="green" />
              <span className="text-emerald-500">HOST_ONLINE</span>
            </>
          )}
          {connectionStatus === "offline" && (
            <>
              <LedIndicator color="red" />
              <span className="text-rose-500">HOST_UNREACHABLE // CHECK_SUPABASE</span>
            </>
          )}
        </div>

        <div className="mb-8 border-b pb-6 dark:border-neutral-900 border-neutral-150">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className={isDark ? "text-neutral-400" : "text-neutral-600"} />
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">
              {mode === "signin" ? "TERMINAL_LOGIN" : "CREATE_ACCESS"}
            </h1>
          </div>
          <p className={`mt-2 text-[10px] uppercase font-mono tracking-tighter ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            Secure credential authentication required.
          </p>
        </div>

        <button
          onClick={onGoogle}
          disabled={loading}
          className={`inline-flex h-12 w-full items-center justify-center gap-3 rounded border text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-30 ${
            isDark 
              ? "bg-neutral-900/40 border-neutral-800 text-white hover:bg-white hover:text-black" 
              : "bg-white border-neutral-250 text-black hover:bg-black hover:text-white shadow-sm"
          }`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authorize with Google"}
        </button>

        {/* Dev-only guest bypass trigger */}
        {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV) && (
          <button
            onClick={() => {
              localStorage.setItem('dev_guest', '1');
              navigate({ to: '/admin', replace: true } as any);
            }}
            className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded border text-xs font-bold uppercase tracking-widest transition-all ${
              isDark 
                ? "bg-neutral-900/10 border-neutral-850 text-neutral-400 hover:bg-neutral-900/40" 
                : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
            title="Dev-only: bypass admin auth on localhost"
          >
            Dev Guest Bypass
          </button>
        )}

        <div className="my-8 flex items-center gap-4 text-[10px] font-black uppercase opacity-20">
          <div className="h-px flex-1 bg-current" />
          <span>OR</span>
          <div className="h-px flex-1 bg-current" />
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className={`text-[8px] font-mono tracking-widest uppercase font-semibold ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>IDENTITY_EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="EMAIL_ADDRESS"
              className={`h-11 w-full rounded border px-4 text-xs font-mono outline-none transition-all ${
                isDark 
                  ? "border-neutral-850 bg-neutral-950/20 text-white focus:border-white focus:ring-1 focus:ring-white/10" 
                  : "border-neutral-200 bg-neutral-50/50 text-black focus:border-black focus:ring-1 focus:ring-black/5"
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`text-[8px] font-mono tracking-widest uppercase font-semibold ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>KEY_CIPHER</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ACCESS_KEY"
              className={`h-11 w-full rounded border px-4 text-xs font-mono outline-none transition-all ${
                isDark 
                  ? "border-neutral-850 bg-neutral-950/20 text-white focus:border-white focus:ring-1 focus:ring-white/10" 
                  : "border-neutral-200 bg-neutral-50/50 text-black focus:border-black focus:ring-1 focus:ring-black/5"
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-30 ${
              isDark 
                ? "bg-white text-black hover:bg-neutral-200" 
                : "bg-black text-white hover:opacity-90 shadow-md"
            }`}
          >
            {loading && mode !== "signin" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Initialize_Session" : "Register_Identity"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-8 w-full text-center text-[9px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
        >
          {mode === "signin" ? "[ Request_New_Credentials ]" : "[ Return_to_Portal ]"}
        </button>
      </div>
    </section>
  );
}

export default LoginPage;
