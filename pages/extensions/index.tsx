import { Puzzle } from "lucide-react";
import { PageShell, EmptyState } from "@/pages/shared";
export function ExtensionsPage() {
  return (
    <PageShell
      icon={Puzzle}
      title="Extensions"
      description="Manage extensions installed in Gorth Browser."
    >
      <EmptyState icon={Puzzle} title="No extensions installed">
        Extension installation and management will be available here.
      </EmptyState>
    </PageShell>
  );
}
