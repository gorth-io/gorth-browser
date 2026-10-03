import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <div className="container mx-auto min-w-0 flex-1 p-6">{children}</div>;
}

export { Wrapper };
