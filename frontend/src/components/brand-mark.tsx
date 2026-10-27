export function BrandMark({ className = "h-8 w-auto max-w-14" }: { className?: string }) {
  return (
    <img
      src="/gitops-insights-mark.png"
      alt=""
      width={341}
      height={192}
      decoding="async"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
