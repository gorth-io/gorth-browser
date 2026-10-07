import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useQuery } from "@tanstack/react-query";
import {
  RouterProvider,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { createInternalRouter } from "@/lib/browser/router";
import { DataTable, dataTableFeatures } from "@/components/custom/data-table";
import { Ranger } from "@/components/custom/ranger";
import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/providers/query";
import { useTRPC } from "@/lib/rpc/client";

interface Item {
  id: string;
  name: string;
  value: number;
}
const data: Item[] = Array.from({ length: 500 }, (_, index) => ({
  id: String(index),
  name: "Item " + (500 - index),
  value: 500 - index,
}));
const columns: ColumnDef<typeof dataTableFeatures, Item>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];
const searchText = (item: Item) => item.name;
function TestPage() {
  const [value, setValue] = useState(6);
  const rpc = useTRPC();
  const snapshot = useQuery(rpc.session.load.queryOptions());
  const router = useRouter();
  const location = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className="space-y-3 p-6">
      <p data-rpc-state>
        {snapshot.isSuccess ? "ready" : (snapshot.error?.message ?? "loading")}
      </p>
      <p data-location>{location}</p>
      <Button
        className="h-9"
        onClick={() => void router.navigate({ to: "/settings/help" })}
      >
        Go to help
      </Button>
      <Button className="h-9" onClick={() => router.history.back()}>
        Back
      </Button>
      <Button className="h-9" onClick={() => router.history.forward()}>
        Forward
      </Button>
      <Button
        className="h-9"
        onClick={() => void router.navigate({ to: "/history" })}
      >
        Go home
      </Button>
      <Ranger
        id="test-ranger"
        label="Memory"
        min={1}
        max={16}
        value={value}
        onValueChange={setValue}
      />
      <output data-ranger-value>{value}</output>
      <DataTable
        data={data}
        columns={columns}
        getSearchText={searchText}
        searchLabel="Search items"
        emptyLabel="No items"
      />
    </div>
  );
}
const router = createInternalRouter("history", TestPage);
const errors: string[] = [];
window.addEventListener("unhandledrejection", (event) =>
  errors.push(String(event.reason)),
);
Object.assign(window, { desktopPackagesTest: { errors } });
createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => errors.push(String(error)),
}).render(
  <QueryProvider>
    <RouterProvider router={router} />
  </QueryProvider>,
);
