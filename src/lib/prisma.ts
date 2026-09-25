import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Runs work inside a single database transaction.
 * Used for every stock mutation so quantities can never drift.
 */
export async function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: { isolationLevel?: "ReadCommitted" | "RepeatableRead" | "Serializable" }
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: options?.isolationLevel ?? "ReadCommitted",
    timeout: 20_000,
    maxWait: 8_000,
  });
}
