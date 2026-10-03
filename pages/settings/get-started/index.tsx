import { Rocket } from "lucide-react";
import { AccountCard } from "@/components/element/account-card";
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
      icon={Rocket}
      title="Get started"
      description="Choose how you start browsing."
    >
      <AccountCard />
      <Card>
        <CardHeader>
          <CardTitle>Startup</CardTitle>
          <CardDescription>
            Gorth restores your previous tabs and window position. New tabs open
            the Gorth home page.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
