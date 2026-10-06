import { Settings } from "lucide-react";
import { PageShell, type SpecialPageProps } from "@/pages/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SettingsSectionPage(
  props: Pick<
    SpecialPageProps,
    | "flags"
    | "onFlagsChange"
    | "sleepAfterMinutes"
    | "archiveAfterDays"
    | "onSleepAfterMinutesChange"
    | "onArchiveAfterDaysChange"
    | "onOpenInternal"
  >,
) {
  return (
    <PageShell
      icon={Settings}
      title="System"
      description="Manage inactive tabs and browser resources."
    >
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p>Memory saver</p>
              <p className="text-sm text-muted-foreground">
                Unload inactive website tabs. Active, pinned, grouped, media,
                download and edited-form tabs are protected.
              </p>
            </div>
            <Switch
              checked={props.flags.memorySaver}
              onCheckedChange={(value) =>
                props.onFlagsChange({ ...props.flags, memorySaver: value })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="sleep-minutes">
              Sleep after inactivity (minutes)
            </label>
            <Input
              id="sleep-minutes"
              className="h-9 w-24"
              type="number"
              min={1}
              max={1440}
              value={props.sleepAfterMinutes}
              onChange={(event) =>
                props.onSleepAfterMinutesChange(
                  Math.min(1440, Math.max(1, Number(event.target.value) || 1)),
                )
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="archive-days">
                Archive after inactivity (days)
              </label>
              <p className="text-sm text-muted-foreground">
                0 disables automatic archiving. Archived tabs stay in your
                database until you restore or delete them.
              </p>
            </div>
            <Input
              id="archive-days"
              className="h-9 w-24"
              type="number"
              min={0}
              max={365}
              value={props.archiveAfterDays}
              onChange={(event) =>
                props.onArchiveAfterDaysChange(
                  Math.min(365, Math.max(0, Number(event.target.value) || 0)),
                )
              }
            />
          </div>
          <Button
            className="h-9"
            variant="outline"
            onClick={() => props.onOpenInternal("archive")}
          >
            View archived tabs
          </Button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p>Smooth scrolling</p>
              <p className="text-sm text-muted-foreground">
                Changes Chromium's smooth scrolling feature after a full app
                restart.
              </p>
            </div>
            <Switch
              checked={props.flags.smoothScrolling}
              onCheckedChange={(value) =>
                props.onFlagsChange({ ...props.flags, smoothScrolling: value })
              }
            />
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
