import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  Check,
  Eye,
  Folder,
  Pencil,
  Plus,
  Columns2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabIcon } from "@/components/element/tab-icon";
import type { BrowserTabItem } from "@/components/element/browser-tabs";
import type {
  PersistedTabGroup,
  TabGroupMode,
} from "@/lib/browser/persistence";

export interface TabGroupsProps {
  groups: PersistedTabGroup[];
  tabs: BrowserTabItem[];
  onSaveGroup: (group: PersistedTabGroup) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onOpenGroup: (id: string) => void;
}

const groupModes = [
  { mode: "normal", label: "Normal", icon: Folder },
  { mode: "split", label: "Split", icon: Columns2 },
  { mode: "glance", label: "Glance", icon: Eye },
] as const;

export function TabGroups({
  groups,
  tabs,
  onSaveGroup,
  onDeleteGroup,
  onOpenGroup,
}: TabGroupsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const form = useForm({
    defaultValues: {
      name: "",
      mode: "normal" as TabGroupMode,
      tabIds: [] as string[],
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (!name || name.length > 80) {
        setError("Enter a group name (1–80 characters).");
        return;
      }
      if (
        !value.tabIds.length ||
        (value.mode !== "normal" && value.tabIds.length !== 2)
      ) {
        setError(
          value.mode === "normal"
            ? "Select at least one tab."
            : "Select exactly two website tabs.",
        );
        return;
      }
      if (
        value.mode !== "normal" &&
        value.tabIds.some(
          (id) => tabs.find((tab) => tab.id === id)?.internalPage !== null,
        )
      ) {
        setError("Split and glance require website tabs, not internal pages.");
        return;
      }
      try {
        await onSaveGroup({
          ...value,
          name,
          id: editingId ?? crypto.randomUUID(),
        });
        setIsEditing(false);
        setError("");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to save this group.",
        );
      }
    },
  });
  const edit = (group?: PersistedTabGroup) => {
    setEditingId(group?.id ?? null);
    form.reset({
      name: group?.name ?? "",
      mode: group?.mode ?? "normal",
      tabIds: group?.tabIds ?? [],
    });
    setError("");
    setIsEditing(true);
  };
  const remove = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDeleteGroup(id);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete this group.",
      );
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <section aria-label="Tab groups" className="mb-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Tab groups</h2>
        <Button className="h-9" onClick={() => edit()}>
          <Plus className="size-4" />
          New group
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit group" : "Create group"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Field name="name">
                {(field) => (
                  <Input
                    aria-label="Group name"
                    placeholder="Group name"
                    maxLength={80}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
              <form.Field name="mode">
                {(field) => (
                  <div aria-label="Group mode" className="flex gap-2">
                    {groupModes.map(({ mode, label, icon: Icon }) => (
                      <Button
                        key={mode}
                        type="button"
                        className="h-9"
                        aria-pressed={field.state.value === mode}
                        variant={
                          field.state.value === mode ? "default" : "outline"
                        }
                        onClick={() => field.handleChange(mode)}
                      >
                        <Icon className="size-4" />
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
              </form.Field>
              <p className="text-sm text-muted-foreground">
                Normal groups open one tab at a time. Split and glance use two
                website tabs.
              </p>
              <form.Field name="tabIds">
                {(field) => (
                  <div className="grid max-h-64 gap-2 overflow-y-auto">
                    {tabs.map((tab) => {
                      const owned = groups.some(
                        (group) =>
                          group.id !== editingId &&
                          group.tabIds.includes(tab.id),
                      );
                      const selected = field.state.value.includes(tab.id);
                      return (
                        <Button
                          type="button"
                          key={tab.id}
                          disabled={owned}
                          aria-pressed={selected}
                          className="h-9 justify-start"
                          variant="outline"
                          onClick={() =>
                            field.handleChange(
                              selected
                                ? field.state.value.filter(
                                    (id) => id !== tab.id,
                                  )
                                : [...field.state.value, tab.id],
                            )
                          }
                        >
                          <TabIcon {...tab} />
                          <span className="min-w-0 flex-1 truncate text-left">
                            {tab.title}
                          </span>
                          {selected && <Check className="size-4" />}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </form.Field>
              <div className="flex gap-2">
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(busy) => (
                    <Button className="h-9" type="submit" disabled={busy}>
                      {busy ? "Saving…" : "Save group"}
                    </Button>
                  )}
                </form.Subscribe>
                <Button
                  className="h-9"
                  variant="outline"
                  type="button"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {!groups.length && (
        <p className="text-sm text-muted-foreground">
          No tab groups yet. Create one from your open tabs.
        </p>
      )}
      <div className="grid gap-3">
        {groups.map((group) => {
          const Icon =
            groupModes.find((item) => item.mode === group.mode)?.icon ?? Folder;
          return (
            <Card key={group.id}>
              <CardContent className="flex flex-wrap items-center gap-2 p-4">
                <Button
                  className="h-9 min-w-0 max-w-full justify-start bg-foreground text-background hover:bg-foreground/90"
                  onClick={() => onOpenGroup(group.id)}
                >
                  <Icon className="size-4" />
                  <span className="truncate">{group.name}</span>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {group.mode} · {group.tabIds.length} tabs
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${group.name}`}
                    onClick={() => edit(group)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDeleting}
                    aria-label={`Delete ${group.name}`}
                    onClick={() => void remove(group.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex w-full flex-wrap gap-2">
                  {group.tabIds.map((id) => {
                    const tab = tabs.find((item) => item.id === id);
                    return (
                      tab && (
                        <span
                          key={id}
                          className="max-w-[180px] truncate text-xs text-muted-foreground"
                        >
                          {tab.title}
                        </span>
                      )
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
