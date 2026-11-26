export const coordinatorModules = ["/funcionario", "/producao", "/tickets"] as const;

export function coordinatorRoutinePath(path: string) {
  return /^\/equipamentos\/[^/]+\/rotina-diaria(?:\/pdf)?\/?$/.test(path);
}

export function coordinatorPathAllowed(path: string) {
  if (["/", "/login", "/alterar-password"].includes(path)) return true;
  if (coordinatorRoutinePath(path)) return true;
  return [...coordinatorModules, "/api/producao"].some(base => path === base || path.startsWith(`${base}/`));
}
