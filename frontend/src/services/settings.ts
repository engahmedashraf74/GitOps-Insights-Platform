import type { UserPreferences } from "@/types";
import { getPreferences, savePreferences } from "@/lib/settings";

export function loadSettings(): UserPreferences {
  return getPreferences();
}

export function updateSettings(
  patch: Partial<UserPreferences>,
): UserPreferences {
  const next = { ...getPreferences(), ...patch };
  savePreferences(next);
  return next;
}
