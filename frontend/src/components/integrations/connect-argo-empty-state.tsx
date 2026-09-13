"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Plug } from "lucide-react";
import Link from "next/link";

export function ConnectArgoEmptyState({
  description = "Projects and applications are imported from Argo CD. Manual create is disabled.",
}: {
  description?: string;
}) {
  return (
    <EmptyState
      icon={<Plug size={22} />}
      title="Connect Argo CD and sync applications"
      description={description}
      action={
        <Link href="/integrations">
          <Button>Connect Argo CD</Button>
        </Link>
      }
    />
  );
}
