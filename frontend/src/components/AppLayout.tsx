"use client";

import Sidebar from "./Sidebar";
import { Topbar } from "./layout/topbar";
import { CommandPalette } from "./layout/command-palette";
import { NotificationCenter } from "./layout/notification-center";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { completeOnboarding, isOnboardingComplete } from "@/lib/onboarding";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildNotifications } from "@/lib/notifications";

const publicPaths = new Set(["/", "/login", "/register"]);

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const authed = !publicPaths.has(pathname);
  const { applications, snapshot } = useWorkspace(authed);
  const unread = buildNotifications(applications).filter((item) => !item.read)
    .length;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (publicPaths.has(pathname)) return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    if (
      pathname !== "/onboarding" &&
      pathname !== "/settings" &&
      !isOnboardingComplete() &&
      snapshot &&
      snapshot.projects.length === 0 &&
      snapshot.applications.length === 0
    ) {
      router.replace("/onboarding");
    }
    if (snapshot && (snapshot.projects.length > 0 || snapshot.applications.length > 0)) {
      if (!isOnboardingComplete()) completeOnboarding();
    }
  }, [pathname, router, snapshot]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (publicPaths.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar collapsed={collapsed} />
        </div>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/70"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-64">
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onOpenMobile={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadCount={unread}
        />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationCenter
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
}
