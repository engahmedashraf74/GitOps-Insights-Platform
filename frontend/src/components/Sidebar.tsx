"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "▦",
  },
  {
    label: "Projects",
    href: "/projects",
    icon: "◫",
  },
  {
    label: "Applications",
    href: "/applications",
    icon: "▤",
  },
  {
    label: "Deployments",
    href: "/deployments",
    icon: "↗",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "▥",
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: "⊕",
  },
];

const bottomNavigation = [
  {
    label: "Settings",
    href: "/settings",
    icon: "⚙",
  },
];

export default function Sidebar({
  collapsed,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  return (
    <aside
      className={[
        "flex h-full flex-col border-r border-white/10 bg-[#0b0d0f] py-4 transition-all duration-200",
        collapsed ? "w-[76px] px-3" : "w-64 px-4",
      ].join(" ")}
    >
      {/* Brand */}
      <div
        className={[
          "mb-8 flex items-center",
          collapsed ? "justify-center" : "gap-3 px-2",
        ].join(" ")}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-sm font-bold text-cyan-400">
          GI
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              GitOps Insights
            </div>

            <div className="text-xs text-white/40">
              Deployment intelligence
            </div>
          </div>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1">
        {!collapsed && (
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Workspace
          </div>
        )}

        {navigation.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                collapsed ? "justify-center" : "",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center text-base",
                  active
                    ? "text-cyan-400"
                    : "text-white/55",
                ].join(" ")}
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span className="truncate">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
        {bottomNavigation.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                collapsed ? "justify-center" : "",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
                {item.icon}
              </span>

              {!collapsed && (
                <span className="truncate">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onNavigate}
          title={collapsed ? "Account" : undefined}
          className={[
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 transition hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center" : "",
          ].join(" ")}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-white">
            A
          </span>

          {!collapsed && (
            <div className="min-w-0 text-left">
              <div className="truncate text-sm text-white/85">
                Account
              </div>

              <div className="truncate text-xs text-white/35">
                Manage workspace
              </div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

