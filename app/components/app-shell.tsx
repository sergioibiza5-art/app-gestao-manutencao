import { isQualityRole } from "@/lib/quality-roles";
import Link from "next/link";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ChevronDown, HomeIcon, LogOut, Menu, Search, ShieldCheck } from "lucide-react";

import { logoutUser } from "@/app/actions";
import { PushNotificationToggle } from "@/app/components/push-notification-toggle";
import { requireUser } from "@/lib/auth";
import { navigation } from "@/lib/navigation";

type AppShellProps = {
  activeHref?: string;
  children: ReactNode;
};

export async function AppShell({ activeHref = "/", children }: AppShellProps) {
  const user = await requireUser();
  if (user.role === "TICKET" && activeHref !== "/tickets") {
    redirect("/tickets");
  }
  const qualityAllowed = ["/ambiental", "/calibracao", "/equipamentos", "/analises", "/kpis"];
  if (user.role === "HSA") qualityAllowed.push("/inventario");
  if (isQualityRole(user.role) && !qualityAllowed.some((href) => activeHref === href || activeHref.startsWith(`${href}/`))) {
    redirect("/calibracao");
  }
  const userAllowedNavigation = ["/plano", "/tickets", "/manutencao", "/equipamentos", "/localizacoes", "/checklists"];
  if (user.role === "USER" && !userAllowedNavigation.some((href) => activeHref === href || activeHref.startsWith(`${href}/`))) {
    redirect("/plano");
  }
  const visibleNavigation = user.role === "TICKET"
    ? navigation.filter((item) => item.href === "/tickets")
    : isQualityRole(user.role)
    ? navigation.filter((item) => qualityAllowed.includes(item.href))
    : user.role === "USER"
    ? navigation.filter((item) => userAllowedNavigation.includes(item.href))
    : ["ADMIN", "MANAGER"].includes(user.role)
    ? navigation
    : navigation.filter((item) => item.href !== "/ferias");
  const homeHref = user.role === "USER" ? "/plano" : "/";
  const activeModule = visibleNavigation.find((item) => item.href === activeHref);
  const moduleLinks = visibleNavigation.map((item) => {
    const Icon = item.icon;
    const active = item.href === activeHref;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-12 min-w-0 items-center gap-3 rounded-lg border p-2 text-left transition ${
          active
            ? "border-teal-300/35 bg-teal-300/10"
            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/80"
        }`}
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${item.color}`}>
          <Icon size={18} />
        </span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-semibold text-zinc-100">{item.name}</span>
          <span className="block break-words text-xs text-zinc-400">{item.meta}</span>
        </span>
      </Link>
    );
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.10),transparent_25%),#070807]">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-3 px-3 py-3 sm:px-5 2xl:px-6">
        <header className="glass-panel sticky top-3 z-30 flex items-center justify-between gap-2 rounded-lg px-2 py-2 sm:px-3">
          <Link href={homeHref} className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-400 text-zinc-950">
              <HomeIcon size={22} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold text-zinc-50 sm:text-2xl">Gestão de manutenção</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold text-zinc-100">{user.name}</p>
              <p className="text-xs text-zinc-500">{user.role}</p>
            </div>
            {user.role !== "TICKET" ? (
              <PushNotificationToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
            ) : null}
            <button className="grid size-11 place-items-center rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-200 transition hover:border-teal-300/50 hover:text-teal-200" aria-label="Pesquisa e filtros">
              <Search size={20} />
            </button>
            <form action={logoutUser}>
              <button className="grid size-11 place-items-center rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-200 transition hover:border-rose-300/50 hover:text-rose-200" aria-label="Sair">
                <LogOut size={19} />
              </button>
            </form>
          </div>
        </header>

        <div className="grid min-w-0 gap-3 xl:pointer-fine:grid-cols-[216px_minmax(0,1fr)] 2xl:pointer-fine:grid-cols-[232px_minmax(0,1fr)]">
          <details key={activeHref} className="glass-panel group min-w-0 rounded-lg xl:pointer-fine:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 font-semibold text-zinc-100 [&::-webkit-details-marker]:hidden">
              <Menu size={20} className="shrink-0 text-teal-300" aria-hidden="true" />
              <span>Módulos</span>
              {activeModule && <span className="min-w-0 truncate text-sm font-normal text-zinc-400">{activeModule.name}</span>}
              <ChevronDown size={18} className="ml-auto shrink-0 text-zinc-400 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <nav aria-label="Módulos" className="grid max-h-[50dvh] gap-2 overflow-y-auto overscroll-contain p-2 sm:grid-cols-2 lg:grid-cols-3">
              {moduleLinks}
            </nav>
          </details>
          <aside className="glass-panel quiet-scrollbar sticky top-24 hidden max-h-[calc(100dvh-7rem)] min-w-0 self-start overflow-auto rounded-lg p-2 xl:pointer-fine:block">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">Módulos</p>
                <h1 className="text-base font-semibold text-zinc-100">Navegação</h1>
              </div>
              <ShieldCheck size={20} className="text-teal-300" />
            </div>

            <nav aria-label="Módulos" className="grid gap-1.5">
              {moduleLinks}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">{children}</div>
        </div>
      </div>
    </main>
  );
}
