import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin";
  const password = "admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("[seed] Admin user already exists, skipping.");
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, password: hashed },
  });

  console.log("[seed] Admin user created: admin / admin");
}

main()
  .catch((e) => {
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
