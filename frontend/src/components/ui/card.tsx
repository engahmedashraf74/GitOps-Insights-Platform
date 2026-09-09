import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/8 bg-[#111113]/80 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
