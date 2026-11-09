import type { UserRole } from "@prisma/client";

export function isQualityRole(role: UserRole) {
  return role === "SGQ" || role === "HSA";
}
