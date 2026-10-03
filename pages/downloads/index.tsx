import { Download } from "lucide-react";
import { PageShell, EmptyState } from "@/pages/shared";
export function DownloadsPage() {
  return (
    <PageShell
      icon={Download}
      title="Downloads"
      description="Manage files downloaded from websites."
    >
      <EmptyState icon={Download} title="No downloads yet">
        Downloaded files will appear here.
      </EmptyState>
    </PageShell>
  );
}
