import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  if (!globalForPrisma.prisma) {
    const requiresSsl =
      process.env.DATABASE_URL.includes("sslmode=require") ||
      process.env.DATABASE_URL.includes("sslmode=verify-full") ||
      process.env.DATABASE_URL.includes("neon.tech");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

export async function readDb<T>(
  callback: (prisma: PrismaClient) => Promise<T>,
  fallback: T
) {
  try {
    return await callback(getPrisma());
  } catch {
    return fallback;
  }
}
