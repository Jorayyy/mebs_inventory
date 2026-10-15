import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.argv[2] ?? "admin@mebs.local";
const password = process.argv[3] ?? "admin123";

async function main() {
  const total = await prisma.user.count();
  console.log("total users:", total);

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log(`NO_USER: ${email} does not exist in this database`);
  } else {
    console.log({
      email: user.email,
      status: user.status,
      deletedAt: user.deletedAt,
      failedAttempts: user.failedAttempts,
      lockedUntil: user.lockedUntil,
      matchesTarget: await bcrypt.compare(password, user.passwordHash),
    });

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, failedAttempts: 0, lockedUntil: null, status: "ACTIVE" },
    });
    console.log(`RESET: password set to "${password}", lock cleared, status ACTIVE`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
