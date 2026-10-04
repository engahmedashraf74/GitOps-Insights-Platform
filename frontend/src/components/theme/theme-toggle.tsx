"use client";

import { applyTheme, resolveTheme } from "@/lib/theme";
import { getPreferences } from "@/lib/settings";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setResolved(resolveTheme(getPreferences().theme));
  }, []);

  function toggle() {
    const next = resolved === "light" ? "dark" : "light";
    applyTheme(next);
    setResolved(next);
  }

  const label = resolved === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--elevated)]"
    >
      {resolved === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

export function ThemeSync() {
  useEffect(() => {
    const preference = getPreferences().theme;
    applyTheme(preference, false);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system", false);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
