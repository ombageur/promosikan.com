import { AppLayout } from "@/components/layout/AppLayout";
import { DemoWorkspaceProvider } from "@/contexts/DemoWorkspaceProvider";

/** /demo — halaman workspace yang sama, dengan data demo di memori dan tanpa login. */
export function DemoRoute() {
  return (
    <DemoWorkspaceProvider>
      <AppLayout />
    </DemoWorkspaceProvider>
  );
}
