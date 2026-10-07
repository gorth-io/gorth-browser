import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type {
  BrowserSnapshot,
  PersistedTabGroup,
} from "@/lib/browser/persistence";
import { tabGroupSchema } from "@/lib/browser/session-schema";
export interface DesktopContext {
  load: () => BrowserSnapshot;
  listGroups: () => PersistedTabGroup[];
  saveGroup: (group: PersistedTabGroup) => PersistedTabGroup[];
  deleteGroup: (id: string) => PersistedTabGroup[];
}
const t = initTRPC.context<DesktopContext>().create({
  errorFormatter: ({ shape }) => ({
    ...shape,
    message:
      shape.data.code === "INTERNAL_SERVER_ERROR"
        ? "Desktop operation failed."
        : shape.message,
    data: { ...shape.data, stack: undefined },
  }),
});
export const desktopRouter = t.router({
  session: t.router({
    load: t.procedure.input(z.void()).query(({ ctx }) => ctx.load()),
  }),
  groups: t.router({
    list: t.procedure.input(z.void()).query(({ ctx }) => ctx.listGroups()),
    save: t.procedure
      .input(tabGroupSchema)
      .mutation(({ ctx, input }) => ctx.saveGroup(input)),
    delete: t.procedure
      .input(z.string().min(1).max(128))
      .mutation(({ ctx, input }) => ctx.deleteGroup(input)),
  }),
});
export type DesktopRouter = typeof desktopRouter;
