import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const sqlitePath = process.env.SQLITE_PATH || "./prisma/dev.db";

const sqlite = new Database(sqlitePath, { readonly: true });
const prisma = new PrismaClient();

function tableExists(db, tableName) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1"
    )
    .get(tableName);
  return !!row;
}

function firstExistingTable(db, candidates) {
  for (const name of candidates) {
    if (tableExists(db, name)) return name;
  }
  return null;
}

function allRows(db, tableName) {
  return db.prepare(`SELECT * FROM "${tableName}"`).all();
}

async function migrateUsers(db) {
  const table = firstExistingTable(db, ["User", "user", "users"]);
  if (!table) {
    console.log("No users table found in SQLite. Skipping users.");
    return [];
  }

  const users = allRows(db, table);
  console.log(`Users: ${users.length}`);

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash: user.passwordHash,
        displayName: user.displayName ?? null,
        createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
        updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName ?? null,
        createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
        updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
      },
    });
  }

  return users;
}

async function migrateVideos(db) {
  const table = firstExistingTable(db, ["Video", "video", "videos"]);
  if (!table) {
    console.log("No videos table found in SQLite. Skipping videos.");
    return [];
  }

  const videos = allRows(db, table);
  console.log(`Videos: ${videos.length}`);

  for (const video of videos) {
    await prisma.video.upsert({
      where: { assetId: video.assetId },
      update: {
        userId: video.userId,
        storedFilename: video.storedFilename,
        originalName: video.originalName,
        originalFormat: video.originalFormat,
        playbackUrl: video.playbackUrl,
        thumbnailUrl: video.thumbnailUrl ?? null,
        thumbnailFilename: video.thumbnailFilename ?? null,
        sourceType: video.sourceType,
        fileSize: video.fileSize ?? null,
        durationSec: video.durationSec ?? null,
        createdAt: video.createdAt ? new Date(video.createdAt) : undefined,
        updatedAt: video.updatedAt ? new Date(video.updatedAt) : undefined,
      },
      create: {
        id: video.id,
        userId: video.userId,
        assetId: video.assetId,
        storedFilename: video.storedFilename,
        originalName: video.originalName,
        originalFormat: video.originalFormat,
        playbackUrl: video.playbackUrl,
        thumbnailUrl: video.thumbnailUrl ?? null,
        thumbnailFilename: video.thumbnailFilename ?? null,
        sourceType: video.sourceType,
        fileSize: video.fileSize ?? null,
        durationSec: video.durationSec ?? null,
        createdAt: video.createdAt ? new Date(video.createdAt) : undefined,
        updatedAt: video.updatedAt ? new Date(video.updatedAt) : undefined,
      },
    });
  }

  return videos;
}

async function migrateCuts(db) {
  const table = firstExistingTable(db, ["Cut", "cut", "cuts"]);
  if (!table) {
    console.log("No cuts table found in SQLite. Skipping cuts.");
    return [];
  }

  const cuts = allRows(db, table);
  console.log(`Cuts: ${cuts.length}`);

  for (const cut of cuts) {
    try {
      await prisma.cut.create({
        data: {
          id: cut.id,
          userId: cut.userId,
          videoId: cut.videoId,
          name: cut.name,
          outputFilename: cut.outputFilename,
          outputUrl: cut.outputUrl,
          startTime: Number(cut.startTime),
          endTime: Number(cut.endTime),
          brightness: Number(cut.brightness ?? 0),
          contrast: Number(cut.contrast ?? 0),
          saturation: Number(cut.saturation ?? 0),
          createdAt: cut.createdAt ? new Date(cut.createdAt) : undefined,
        },
      });
    } catch (error) {
      console.warn(`Skip cut ${cut.id}: ${error.message}`);
    }
  }

  return cuts;
}

async function main() {
  console.log(`Reading SQLite from: ${sqlitePath}`);
  await migrateUsers(sqlite);
  await migrateVideos(sqlite);
  await migrateCuts(sqlite);
  console.log("SQLite -> Postgres migration complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });