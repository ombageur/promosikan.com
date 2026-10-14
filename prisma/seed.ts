import { PrismaClient } from "@prisma/client";
import { demoOpportunities, demoServices } from "../src/lib/demo";

const db = new PrismaClient();

async function main() {
  const workspace = await db.workspace.upsert({ where: { slug: "publish-agency-demo" }, update: {}, create: { name: "Publish Agency", slug: "publish-agency-demo", profile: { create: { name: "Publish Agency", description: "Agency digital marketing", industry: "Digital Marketing", location: "Indonesia", language: "id", brandVoice: "Ramah dan konsultatif" } }, settings: { create: {} } } });
  for (const item of demoServices) {
    const existing = await db.service.findFirst({ where: { workspaceId: workspace.id, name: item.name } });
    if (!existing) await db.service.create({ data: { workspaceId: workspace.id, name: item.name, category: item.category, description: item.description, targetCustomer: item.target, problemSolved: item.problem, active: item.active } });
  }
  for (const item of demoOpportunities) {
    await db.socialPost.upsert({ where: { workspaceId_platform_platformPostId: { workspaceId: workspace.id, platform: "THREADS", platformPostId: `demo-${item.id}` } }, update: {}, create: { workspaceId: workspace.id, platform: "THREADS", platformPostId: `demo-${item.id}`, text: item.post, isDemo: true } });
  }
  console.log(`Seeded Publish Agency: ${demoServices.length} services, ${demoOpportunities.length} demo posts.`);
}

main().finally(() => db.$disconnect());
