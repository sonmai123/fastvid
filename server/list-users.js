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

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true
      }
    });

    console.log('Users in database:');
    users.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.displayName}, Created: ${user.createdAt}`);
    });

  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();