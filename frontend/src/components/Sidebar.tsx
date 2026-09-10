"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  Plug,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

type SidebarProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Applications", href: "/applications", icon: Boxes },
  { label: "Deployments", href: "/deployments", icon: Activity },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Integrations", href: "/integrations", icon: Plug },
];

const bottomNavigation = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-white/10 bg-[#0b0d0f] py-4 transition-all duration-200",
        collapsed ? "w-[76px] px-3" : "w-64 px-4",
      )}
    >
      <Link
        href="/dashboard"
        className={cn(
          "mb-8 flex items-center",
          collapsed ? "justify-center" : "gap-3 px-2",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-sm font-bold text-teal-300">
          GI
        </div>
        {collapsed ? null : (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              GitOps Insights
            </div>
            <div className="text-xs text-white/40">Delivery intelligence</div>
          </div>
        )}
      </Link>

      <nav className="flex-1 space-y-1">
        {collapsed ? null : (
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Workspace
          </div>
        )}
        {navigation.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                collapsed && "justify-center",
                active
                  ? "bg-teal-400/10 text-teal-100"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={18} className={active ? "text-teal-300" : ""} />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
        {bottomNavigation.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                collapsed && "justify-center",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={18} />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
