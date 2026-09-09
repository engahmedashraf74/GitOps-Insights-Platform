import type { UserPreferences, WorkspaceContext } from "@/types";

const PREFERENCES_KEY = "goi.preferences";
const WORKSPACE_KEY = "goi.workspace";

const defaultPreferences: UserPreferences = {
  username: "",
  theme: "dark",
  timezone: "UTC",
  defaultProjectId: null,
  notifications: {
    email: true,
    deploymentFailures: true,
    weeklySummary: false,
  },
};

const defaultWorkspace: WorkspaceContext = {
  name: "Platform workspace",
};

export function getPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: UserPreferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function getWorkspace(): WorkspaceContext {
  if (typeof window === "undefined") {
    return defaultWorkspace;
  }

  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return defaultWorkspace;
    return { ...defaultWorkspace, ...JSON.parse(raw) };
  } catch {
    return defaultWorkspace;
  }
}

export function saveWorkspace(workspace: WorkspaceContext): void {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
}
