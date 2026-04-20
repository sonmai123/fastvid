import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing localhost URLs...");

  const videos = await prisma.video.findMany();

  let updatedCount = 0;

  for (const video of videos) {
    let needUpdate = false;

    let playbackUrl = video.playbackUrl;
    let thumbnailUrl = video.thumbnailUrl;

    if (playbackUrl && playbackUrl.includes("https://localhost:5000")) {
      playbackUrl = playbackUrl.replace("https://localhost:5000", "http://localhost:5000");
      needUpdate = true;
    }

    if (thumbnailUrl && thumbnailUrl.includes("https://localhost:5000")) {
      thumbnailUrl = thumbnailUrl.replace("https://localhost:5000", "http://localhost:5000");
      needUpdate = true;
    }

    if (needUpdate) {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          playbackUrl,
          thumbnailUrl,
        },
      });

      updatedCount++;
    }
  }

  console.log(`✅ Updated ${updatedCount} videos`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });