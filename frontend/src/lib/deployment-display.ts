/** A blank snapshot was never stored. A real Argo value, including Unknown, is shown as stored. */
export function shownSnapshot(value?: string | null): string {
  const text = value?.trim();
  return text || "Not recorded";
}

export function shownResult(value?: string | null): string {
  const text = value?.trim();
  return text || "Not recorded";
}
