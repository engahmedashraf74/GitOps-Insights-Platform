"use client";

import { cn } from "@/lib/cn";
import {
  Activity,
  BarChart3,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  Plug,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/applications", label: "Applications", icon: Boxes },
  { href: "/deployments", label: "Deployments", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-white/8 bg-[#0c0c0e] py-4 transition-[width]",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15 text-sm font-semibold text-teal-300">
          GI
        </span>
        {collapsed ? null : (
          <span className="text-sm font-semibold tracking-tight">
            GitOps Insights
          </span>
        )}
      </Link>
      <nav className="flex-1 space-y-1 px-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-teal-400/10 text-teal-200"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon size={18} />
              {collapsed ? null : item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
