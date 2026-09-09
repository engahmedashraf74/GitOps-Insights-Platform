"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export function SearchInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative block", className)}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
      />
      <input
        className="h-10 w-full rounded-lg border border-white/10 bg-zinc-950/50 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500"
        {...props}
      />
    </label>
  );
}
