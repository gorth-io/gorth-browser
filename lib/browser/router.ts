import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type RouteComponent,
} from "@tanstack/react-router";
import {
  internalPageDefinitions,
  type BrowserInternalPage,
} from "./internal-pages";

export function createInternalRouter(
  page: Exclude<BrowserInternalPage, "new-tab">,
  component: RouteComponent,
) {
  const root = createRootRoute();
  const routes = Object.keys(internalPageDefinitions).map((path) =>
    createRoute({ getParentRoute: () => root, path: "/" + path, component }),
  );
  return createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/" + page] }),
    defaultPendingMinMs: 0,
  });
}
