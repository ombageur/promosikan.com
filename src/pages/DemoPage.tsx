import { useParams } from "react-router";
import { Dashboard } from "@/components/demo/DemoDashboard";
import { sections } from "@/components/demo/sections";
import { NotFoundPage } from "./NotFoundPage";

/** Demo publik tanpa login. Semua data berasal dari fixtures dan diberi label Data Demo. */
export function DemoPage() {
  const { section = "overview" } = useParams();
  if (!sections.some((s) => s.slug === section)) return <NotFoundPage />;
  return <Dashboard section={section} />;
}
