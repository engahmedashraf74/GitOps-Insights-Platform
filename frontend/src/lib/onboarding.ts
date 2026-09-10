const KEY = "goi.onboarding";

export interface OnboardingState {
  completed: boolean;
  workspaceNamed: boolean;
  integrationReviewed: boolean;
}

const defaults: OnboardingState = {
  completed: false,
  workspaceNamed: false,
  integrationReviewed: false,
};

export function getOnboardingState(): OnboardingState {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<OnboardingState>) };
  } catch {
    return defaults;
  }
}

export function saveOnboardingState(state: OnboardingState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function completeOnboarding(): void {
  saveOnboardingState({
    completed: true,
    workspaceNamed: true,
    integrationReviewed: true,
  });
}

export function isOnboardingComplete(): boolean {
  return getOnboardingState().completed;
}
