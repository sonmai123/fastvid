import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

// Build DATABASE_URL from separate MongoDB env vars when provided.
if (!process.env.DATABASE_URL) {
  const { MONGO_USER, MONGO_PASS, MONGO_HOST, MONGO_DB } = process.env;
  if (MONGO_USER && MONGO_PASS && MONGO_HOST && MONGO_DB) {
    process.env.DATABASE_URL = `mongodb+srv://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}@${MONGO_HOST}/${MONGO_DB}?retryWrites=true&w=majority`;
  }
}

console.log("Environment variables:");
console.log("MONGO_USER:", process.env.MONGO_USER ? "✅ Set" : "❌ Not set");
console.log("MONGO_PASS:", process.env.MONGO_PASS ? "✅ Set" : "❌ Not set");
console.log("MONGO_HOST:", process.env.MONGO_HOST ? "✅ Set" : "❌ Not set");
console.log("MONGO_DB:", process.env.MONGO_DB ? "✅ Set" : "❌ Not set");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✅ Set" : "❌ Not set");

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL preview:", process.env.DATABASE_URL.substring(0, 50) + "...");
}

const prisma = new PrismaClient({ log: ["error", "warn"] });

async function testConnection() {
  try {
    console.log("\nTesting MongoDB connection...");
    await prisma.$connect();
    console.log("✅ MongoDB connected successfully");

    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`✅ Database query successful. Users count: ${userCount}`);

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("Full error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();