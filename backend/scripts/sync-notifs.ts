import "dotenv/config";
import prisma from "../src/utils/prisma.js";

async function main() {
  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMINISTRATOR" },
    select: { id: true, email: true }
  });
  console.log("Admin users:", adminUsers);

  const adminUserIds = adminUsers.map(u => u.id);
  const oldTaMRFNotifs = await prisma.notification.findMany({
    where: {
      userId: { in: adminUserIds },
      link: { startsWith: "/ta/mrfs/" }
    }
  });

  console.log(`Found ${oldTaMRFNotifs.length} legacy notifications for Admins pointing to /ta/mrfs/*`);
  for (const notif of oldTaMRFNotifs) {
    if (notif.link) {
      const newLink = notif.link.replace("/ta/mrfs/", "/admin/mrfs/");
      await prisma.notification.update({
        where: { id: notif.id },
        data: { link: newLink }
      });
      console.log(`Migrated notif ${notif.id}: ${notif.link} -> ${newLink}`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(console.error);
