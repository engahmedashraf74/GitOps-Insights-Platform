"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

function Icon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const navigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </Icon>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: (
      <Icon>
        <path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 7.5V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2.5" />
      </Icon>
    ),
  },
  {
    label: "Applications",
    href: "/applications",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </Icon>
    ),
  },
  {
    label: "Deployments",
    href: "/deployments",
    icon: (
      <Icon>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </Icon>
    ),
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: (
      <Icon>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19V3" />
      </Icon>
    ),
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: (
      <Icon>
        <path d="M8 12h8" />
        <path d="M12 8v8" />
        <rect x="3" y="3" width="18" height="18" rx="4" />
      </Icon>
    ),
  },
];

const bottomNavigation: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L5.3 8.6 7 6.9l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 .4 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.4h-.2a1.7 1.7 0 0 0-1.4.7Z" />
      </Icon>
    ),
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

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderItem = (item: NavItem) => {
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
            "flex shrink-0 items-center justify-center",
            active ? "text-cyan-400" : "text-white/55",
          ].join(" ")}
        >
          {item.icon}
        </span>

        {!collapsed ? (
          <span className="truncate">{item.label}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className={[
        "flex h-full flex-col border-r border-white/10 bg-[#0b0d0f] py-4 transition-all duration-200",
        collapsed ? "w-[76px] px-3" : "w-64 px-4",
      ].join(" ")}
    >
      <div
        className={[
          "mb-8 flex items-center",
          collapsed ? "justify-center" : "gap-3 px-2",
        ].join(" ")}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-sm font-bold text-cyan-400">
          GI
        </div>

        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              GitOps Insights
            </div>
            <div className="text-xs text-white/40">
              Deployment intelligence
            </div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1">
        {!collapsed ? (
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Workspace
          </div>
        ) : null}

        {navigation.map(renderItem)}
      </nav>

      <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
        {bottomNavigation.map(renderItem)}

        <button
          type="button"
          onClick={onNavigate}
          title={collapsed ? "Account" : undefined}
          className={[
            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 transition hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center" : "",
          ].join(" ")}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-white">
            A
          </span>

          {!collapsed ? (
            <div className="min-w-0 text-left">
              <div className="truncate text-sm text-white/85">
                Account
              </div>
              <div className="truncate text-xs text-white/35">
                Manage workspace
              </div>
            </div>
          ) : null}
        </button>
      </div>
    </aside>
  );
}