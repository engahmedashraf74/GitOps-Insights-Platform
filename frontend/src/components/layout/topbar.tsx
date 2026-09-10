"use client";

import { SearchInput } from "@/components/ui/search-input";
import { clearToken, getSessionUser } from "@/lib/auth";
import { getPreferences, getWorkspace } from "@/lib/settings";
import { Bell, ChevronsLeft, ChevronsRight, Menu, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function Topbar({
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
  onOpenSearch,
  onOpenNotifications,
  unreadCount,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [workspace, setWorkspace] = useState("Workspace");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const session = getSessionUser();
    const prefs = getPreferences();
    setEmail(session?.email ?? "");
    setUsername(prefs.username);
    setWorkspace(getWorkspace().name);
  }, []);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <header className="flex h-16 items-center gap-3 border-b border-white/8 bg-[#0c0c0e]/90 px-4 backdrop-blur">
      <button
        className="rounded-lg p-2 text-zinc-400 hover:bg-white/6 lg:hidden"
        onClick={onOpenMobile}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>
      <button
        className="hidden rounded-lg p-2 text-zinc-400 hover:bg-white/6 lg:inline-flex"
        onClick={onToggleCollapsed}
        aria-label="Collapse sidebar"
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden max-w-md flex-1 text-left md:block"
        aria-label="Open search"
      >
        <div className="pointer-events-none">
          <SearchInput
            readOnly
            placeholder="Search applications, projects, deployments"
          />
        </div>
        <span className="sr-only">Open global search</span>
      </button>
      <button
        type="button"
        className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-500 md:hidden"
        onClick={onOpenSearch}
      >
        Search
      </button>
      <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500 lg:inline">
        Ctrl K
      </kbd>
      <div className="ml-auto flex items-center gap-2">
        <button
          className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/6"
          aria-label="Notifications"
          onClick={onOpenNotifications}
        >
          <Bell size={18} />
          {unreadCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-teal-400" />
          ) : null}
        </button>
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-left hover:bg-white/5"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/8">
              <UserRound size={14} />
            </span>
            <span className="hidden sm:block">
              <span className="block text-xs text-zinc-400">{workspace}</span>
              <span className="block max-w-[160px] truncate text-sm">
                {username || email || "Account"}
              </span>
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-white/10 bg-[#111113] p-1 shadow-xl">
              <button
                className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/6"
                onClick={() => router.push("/settings")}
              >
                Settings
              </button>
              <button
                className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/6"
                onClick={() => router.push("/onboarding")}
              >
                Onboarding
              </button>
              <button
                className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/6"
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
