import { Wallet } from "lucide-react";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
export function SettingsSectionPage() {
  return (
    <PageShell
      icon={Wallet}
      title="Web3"
      description="Manage decentralized web integrations."
    >
      <Card>
        <CardHeader>
          <CardTitle>Web3</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
