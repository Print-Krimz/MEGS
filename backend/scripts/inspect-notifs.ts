import "dotenv/config";
import prisma from "../src/utils/prisma.js";

async function main() {
  const notifs = await prisma.notification.findMany({
    where: { title: { contains: "Manpower Request" } },
    take: 20,
    orderBy: { createdAt: "desc" }
  });
  console.log("=== MRF NOTIFICATIONS IN DB ===");
  for (const n of notifs) {
    console.log(`ID: ${n.id} | User: ${n.userId} | Link: ${n.link} | Msg: ${n.message}`);
  }
  const mrfs = await prisma.manpowerRequest.findMany();
  console.log("\n=== MRFS IN DB ===");
  for (const m of mrfs) {
    console.log(`MRF ID: ${m.id} | Title: ${m.title}`);
  }
}

main().then(() => prisma.$disconnect()).catch(console.error);
