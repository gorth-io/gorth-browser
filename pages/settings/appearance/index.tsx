import { CheckCircle2, PanelLeft, PanelRight, Palette } from "lucide-react";
import { ThemeToggle } from "@/components/element/theme-toggle";
import { ToastSettings } from "@/components/element/toast-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { type SpecialPageProps, PageShell } from "@/pages/shared";
function SettingsPage({
  theme,
  onThemeChange,
  verticalTabs,
  onVerticalTabsChange,
  onSidebarSideChange,
  onShowTitlebarLogoChange,
  sidebarSide,
  showTitlebarLogo,
}: Pick<
  SpecialPageProps,
  | "onSidebarSideChange"
  | "onShowTitlebarLogoChange"
  | "sidebarSide"
  | "showTitlebarLogo"
  | "verticalTabs"
  | "onVerticalTabsChange"
  | "theme"
  | "onThemeChange"
>) {
  return (
    <PageShell
      description="Customize the browser interface."
      icon={Palette}
      title="Appearance"
    >
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Choose the browser interface color mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToastSettings />
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm">Color mode</span>
              <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p id="vertical-tabs-label" className="text-sm font-medium">
                  Vertical tabs
                </p>
                <p className="text-xs text-muted-foreground">
                  Move tabs into a collapsible sidebar.
                </p>
              </div>
              <Switch
                aria-labelledby="vertical-tabs-label"
                checked={verticalTabs}
                onCheckedChange={onVerticalTabsChange}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Titlebar logo</p>
                <p className="text-xs text-muted-foreground">
                  Show the lightning icon beside the tab list.
                </p>
              </div>
              <Switch
                checked={showTitlebarLogo}
                onCheckedChange={onShowTitlebarLogoChange}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sidebar position</CardTitle>
            <CardDescription>
              Place the bookmarks sidebar on the left or right of the window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => onSidebarSideChange("left")}
              variant={sidebarSide === "left" ? "default" : "outline"}
            >
              <PanelLeft /> Left
            </Button>
            <Button
              onClick={() => onSidebarSideChange("right")}
              variant={sidebarSide === "right" ? "default" : "outline"}
            >
              <PanelRight /> Right
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Startup page</CardTitle>
            <CardDescription>
              New tabs open the Gorth home page with a centered search box.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              <CheckCircle2 /> Using the New Tab page
            </Badge>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
export { SettingsPage };
