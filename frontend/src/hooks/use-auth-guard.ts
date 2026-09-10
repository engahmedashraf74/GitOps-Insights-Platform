"use client";

import { isAuthenticated } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function useAuthGuard(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  return ready;
}
