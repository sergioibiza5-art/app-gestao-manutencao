import type { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

type Permission =
  | "users:create"
  | "users:update"
  | "users:delete"
  | "equipment:create"
  | "equipment:update"
  | "equipment:delete"
  | "maintenance:create"
  | "maintenance:update"
  | "maintenance:delete"
  | "expenses:create"
  | "expenses:update"
  | "expenses:delete"
  | "documents:create"
  | "documents:update"
  | "documents:delete"
  | "sgq:create"
  | "sgq:update"
  | "sgq:approve"
  | "sgq:delete"
  | "vehicles:create"
  | "vehicles:update"
  | "vehicles:delete";

const permissions: Record<Permission, UserRole[]> = {
  "users:create": ["ADMIN"],
  "users:update": ["ADMIN"],
  "users:delete": ["ADMIN"],

  "equipment:create": ["ADMIN", "MANAGER", "SGQ"],
  "equipment:update": ["ADMIN", "MANAGER", "SGQ"],
  "equipment:delete": ["ADMIN"],

  "maintenance:create": ["ADMIN", "MANAGER", "USER"],
  "maintenance:update": ["ADMIN", "MANAGER"],
  "maintenance:delete": ["ADMIN"],

  "expenses:create": ["ADMIN", "MANAGER", "USER"],
  "expenses:update": ["ADMIN", "MANAGER"],
  "expenses:delete": ["ADMIN"],

  "documents:create": ["ADMIN", "MANAGER", "USER"],
  "documents:update": ["ADMIN", "MANAGER"],
  "documents:delete": ["ADMIN"],

  "sgq:create": ["ADMIN", "MANAGER", "SGQ"],
  "sgq:update": ["ADMIN", "MANAGER", "SGQ"],
  "sgq:approve": ["ADMIN", "MANAGER"],
  "sgq:delete": ["ADMIN"],

  "vehicles:create": ["ADMIN", "MANAGER"],
  "vehicles:update": ["ADMIN", "MANAGER"],
  "vehicles:delete": ["ADMIN"],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return permissions[permission].includes(role);
}

export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Precisas de iniciar sessão.");
  }

  if (!hasPermission(user.role, permission)) {
    throw new Error("Sem permissões para executar esta ação.");
  }

  return user;
}
