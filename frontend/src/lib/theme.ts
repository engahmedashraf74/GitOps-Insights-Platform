import { getPreferences, savePreferences } from "@/lib/settings";
import type { UserPreferences } from "@/types";

export type ThemePreference = UserPreferences["theme"];
export type ResolvedTheme = "dark" | "light";

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function applyTheme(preference: ThemePreference, persist = true): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = resolved;
  }
  if (persist && typeof window !== "undefined") {
    savePreferences({ ...getPreferences(), theme: preference });
  }
  return resolved;
}
