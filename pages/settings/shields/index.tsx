import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  normalizeSite,
  type ShieldStatus,
  type ShieldPreferences,
} from "@/lib/browser/shields";
export function SettingsSectionPage() {
  const [status, setStatus] = useState<ShieldStatus | null>(null);
  const [site, setSite] = useState("");
  const [filters, setFilters] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void window.electronAPI.shields
      .status()
      .then((value) => {
        setStatus(value);
        setFilters(value.preferences.customFilters);
      })
      .catch(() => setError("Unable to load Shields."));
    return window.electronAPI.shields.onChanged(setStatus);
  }, []);
  const save = async (patch: Partial<ShieldPreferences>) => {
    if (!status || saving) return;
    setSaving(true);
    try {
      setStatus(
        await window.electronAPI.shields.save({
          ...status.preferences,
          ...patch,
        }),
      );
      setError("");
    } catch {
      setError(
        "Unable to save Shields preferences. Check your hostname or filter rules.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <PageShell
      icon={ShieldCheck}
      title="Shields"
      description="Configure protection from trackers and unwanted content."
    >
      <Card>
        <CardHeader>
          <CardTitle>Shields</CardTitle>
          <CardDescription>
            Ghostery's full filter engine: ads, trackers, cosmetic filtering and
            scriptlets. Cached locally and available offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(error || status?.error) && (
            <p role="alert" className="text-sm text-destructive">
              {error || status?.error}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p>Block ads and trackers</p>
              <p className="text-sm text-muted-foreground">
                Changes apply to new requests. Reload websites to apply cosmetic
                changes.
              </p>
            </div>
            <Switch
              disabled={!status || saving}
              checked={status?.preferences.enabled ?? false}
              onCheckedChange={(enabled) => void save({ enabled })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <p>Automatically update filter lists</p>
            <Switch
              disabled={!status || saving}
              checked={status?.preferences.automaticUpdates ?? false}
              onCheckedChange={(automaticUpdates) =>
                void save({ automaticUpdates })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {status?.ready
                ? "Filter engine ready"
                : "Filter engine unavailable"}
              {status?.updatedAt
                ? ` · Updated ${new Date(status.updatedAt).toLocaleString()}`
                : " · Bundled filters"}
            </p>
            <Button
              className="h-9"
              variant="outline"
              disabled={!status || status.updating}
              onClick={() =>
                void window.electronAPI.shields
                  .update()
                  .then(setStatus)
                  .catch(() => setError("Unable to update filters."))
              }
            >
              {status?.updating ? "Updating…" : "Update filters"}
            </Button>
          </div>
          <p className="text-sm">
            Blocked requests this session: {status?.blockedRequests ?? 0}
          </p>
          <div className="space-y-2">
            <p>Allow ads and trackers on these sites</p>
            <div className="flex gap-2">
              <Input
                className="h-9"
                aria-label="Allowed website hostname"
                placeholder="example.com"
                value={site}
                onChange={(event) => setSite(event.target.value)}
              />
              <Button
                className="h-9"
                disabled={!site.trim() || !status || saving}
                onClick={() => {
                  try {
                    void save({
                      disabledSites: [
                        ...status!.preferences.disabledSites,
                        normalizeSite(site),
                      ],
                    });
                    setSite("");
                  } catch {
                    setError("Enter a valid HTTP(S) website hostname.");
                  }
                }}
              >
                Add
              </Button>
            </div>
            {status?.preferences.disabledSites.map((hostname) => (
              <div
                key={hostname}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">{hostname}</span>
                <Button
                  className="h-9"
                  variant="ghost"
                  disabled={saving}
                  onClick={() =>
                    void save({
                      disabledSites: status.preferences.disabledSites.filter(
                        (value) => value !== hostname,
                      ),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label htmlFor="custom-shield-filters">
              Custom filters (uBlock/EasyList syntax)
            </label>
            <Textarea
              id="custom-shield-filters"
              className="min-h-32 font-mono text-xs"
              maxLength={100000}
              value={filters}
              onChange={(event) => setFilters(event.target.value)}
              placeholder={"||example.com/ads^\nexample.com##.advertisement"}
            />
            <Button
              className="h-9"
              variant="outline"
              disabled={
                !status ||
                saving ||
                filters === status.preferences.customFilters
              }
              onClick={() => void save({ customFilters: filters })}
            >
              Save custom filters
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
