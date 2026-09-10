"use client";

import { SearchInput } from "@/components/ui/search-input";
import { useWorkspace } from "@/hooks/use-workspace";
import { shortRevision } from "@/lib/format";
import type { SearchResult } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const pages: SearchResult[] = [
  { id: "p-overview", title: "Overview", subtitle: "Workspace dashboard", href: "/dashboard", group: "Pages" },
  { id: "p-projects", title: "Projects", subtitle: "Manage delivery projects", href: "/projects", group: "Pages" },
  { id: "p-apps", title: "Applications", subtitle: "GitOps applications", href: "/applications", group: "Pages" },
  { id: "p-deploys", title: "Deployments", subtitle: "Deployment history", href: "/deployments", group: "Pages" },
  { id: "p-analytics", title: "Analytics", subtitle: "Delivery trends", href: "/analytics", group: "Pages" },
  { id: "p-integrations", title: "Integrations", subtitle: "Argo CD and sources", href: "/integrations", group: "Pages" },
  { id: "p-settings", title: "Settings", subtitle: "Profile and preferences", href: "/settings", group: "Pages" },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { snapshot, applications } = useWorkspace(open);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const projectResults: SearchResult[] =
      snapshot?.projects.map((project) => ({
        id: `project-${project.id}`,
        title: project.name,
        subtitle: project.description || "Project",
        href: `/projects/${project.id}`,
        group: "Projects",
      })) ?? [];
    const appResults: SearchResult[] = applications.map((application) => ({
      id: `app-${application.id}`,
      title: application.name,
      subtitle: application.repoUrl || "Application",
      href: `/applications/${application.id}`,
      group: "Applications",
    }));
    const deployResults: SearchResult[] = (snapshot?.deployments ?? [])
      .slice(0, 20)
      .map((deployment, index) => ({
        id: `deploy-${deployment.id ?? index}`,
        title: shortRevision(deployment.revision),
        subtitle: `${deployment.status} · ${deployment.environment || "env"}`,
        href: deployment.applicationId
          ? `/applications/${deployment.applicationId}`
          : "/deployments",
        group: "Deployments",
      }));

    const all = [...pages, ...projectResults, ...appResults, ...deployResults];
    if (!q) return all.slice(0, 12);
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q),
    );
  }, [applications, query, snapshot]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => Math.max(value - 1, 0));
      }
      if (event.key === "Enter" && results[active]) {
        event.preventDefault();
        router.push(results[active].href);
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose, open, results, router]);

  if (!open) return null;

  const groups = ["Pages", "Projects", "Applications", "Deployments"] as const;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <button className="absolute inset-0 bg-black/70" aria-label="Close search" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Global search"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-[#111113] shadow-2xl"
      >
        <div className="border-b border-white/8 p-3">
          <SearchInput
            autoFocus
            placeholder="Search projects, applications, deployments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="mt-2 text-[11px] text-zinc-500">
            Ctrl/⌘ K · Esc to close
          </p>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">
              No matches for that query.
            </p>
          ) : (
            groups.map((group) => {
              const items = results.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {group}
                  </p>
                  {items.map((item) => {
                    const index = results.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        className={`flex w-full flex-col rounded-lg px-3 py-2 text-left ${
                          index === active ? "bg-white/8" : "hover:bg-white/5"
                        }`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => {
                          router.push(item.href);
                          onClose();
                        }}
                      >
                        <span className="text-sm text-zinc-100">{item.title}</span>
                        <span className="text-xs text-zinc-500">{item.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
