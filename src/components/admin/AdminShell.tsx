import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Users, Package, Settings, LogOut, Menu, X, Wand2, GitCompare, Bot } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Revenue", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/leads", label: "Leads", icon: Users },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/studio", label: "Studio", icon: Wand2 },
  { to: "/admin/compare", label: "Compare", icon: GitCompare },
  { to: "/admin/jarvis", label: "Jarvis", icon: Bot },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

// Helvetica face used by the shop's mobile nav — mirrored here so the admin
// overlay is format-identical to the storefront menu.
const NAV_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-5 text-sm font-semibold">
          Owner portal
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        {/* ── Mobile nav bar — format-identical to the shop Header ── */}
        <header className="sticky top-0 z-50 border-b border-border bg-background text-foreground md:hidden">
          <div className="flex h-14 w-full items-center justify-between px-6">
            {/* Left: burger */}
            <div className="flex flex-1 items-center">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle navigation"
                className="flex items-center text-foreground"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

            {/* Center: title */}
            <span
              className="absolute left-1/2 -translate-x-1/2 text-[13px] font-normal tracking-[0em] text-foreground"
              style={{ fontFamily: NAV_FONT }}
            >
              OWNER
            </span>

            {/* Right: sign out */}
            <div className="flex flex-1 justify-end">
              <button
                onClick={logout}
                aria-label="Sign out"
                className="flex items-center text-foreground transition-opacity hover:opacity-60"
              >
                <LogOut size={18} strokeWidth={1} />
              </button>
            </div>
          </div>

          {/* Fullscreen overlay — structure/typography identical to the shop menu */}
          {open && (
            <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground">
              {/* Menu top bar mirrors the header */}
              <div className="flex h-14 w-full items-center justify-between px-6">
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="flex items-center text-foreground"
                >
                  <X size={18} />
                </button>
                <span
                  className="absolute left-1/2 -translate-x-1/2 text-[13px] font-normal text-foreground"
                  style={{ fontFamily: NAV_FONT }}
                >
                  OWNER
                </span>
              </div>

              {/* Centered, scrollable nav list — every desktop item is present */}
              <nav className="flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-10">
                {nav.map((item) => {
                  const active = item.exact ? path === item.to : path.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={`text-base font-normal uppercase tracking-[0.2em] transition-opacity hover:opacity-60 ${
                        active ? "text-foreground" : "text-foreground/50"
                      }`}
                      style={{ fontFamily: NAV_FONT }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setOpen(false); logout(); }}
                  className="text-base font-normal uppercase tracking-[0.2em] text-foreground/50 transition-opacity hover:opacity-60"
                  style={{ fontFamily: NAV_FONT }}
                >
                  Sign out
                </button>
              </nav>
            </div>
          )}
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
