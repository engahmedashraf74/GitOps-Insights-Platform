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
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [workspace, setWorkspace] = useState("Workspace");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim().toLowerCase();
    if (value.includes("project")) router.push("/projects");
    else if (value.includes("deploy")) router.push("/deployments");
    else if (value.includes("app")) router.push("/applications");
    else router.push("/applications");
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
      <form onSubmit={onSearch} className="hidden max-w-md flex-1 md:block">
        <SearchInput
          placeholder="Search applications, projects, deployments"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <button
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/6"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={18} />
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
