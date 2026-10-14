import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { sectionSlugs } from "@/lib/navigation";

export function generateStaticParams() {
  return sectionSlugs.filter((section) => section !== "overview").map((section) => ({ section }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(sectionSlugs as readonly string[]).includes(section)) notFound();
  return <Dashboard section={section} />;
}
