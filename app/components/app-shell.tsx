import Link from "next/link";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { HomeIcon, LogOut, Search, ShieldCheck } from "lucide-react";

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
  const sgqAllowed = ["/calibracao", "/equipamentos", "/analises", "/kpis"];
  if (user.role === "SGQ" && !sgqAllowed.some((href) => activeHref === href || activeHref.startsWith(`${href}/`))) {
    redirect("/calibracao");
  }
  const visibleNavigation = user.role === "TICKET"
    ? navigation.filter((item) => item.href === "/tickets")
    : user.role === "SGQ"
    ? navigation.filter((item) => sgqAllowed.includes(item.href))
    : ["ADMIN", "MANAGER"].includes(user.role)
    ? navigation
    : navigation.filter((item) => item.href !== "/ferias");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.10),transparent_25%),#070807]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-3 z-30 flex items-center justify-between gap-3 rounded-lg px-3 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
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

        <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="glass-panel quiet-scrollbar min-w-0 overflow-hidden rounded-lg p-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">Módulos</p>
                <h1 className="text-base font-semibold text-zinc-100">Navegação</h1>
              </div>
              <ShieldCheck size={20} className="text-teal-300" />
            </div>

            <nav className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex min-w-52 items-center gap-3 rounded-lg border p-3 text-left transition lg:min-w-0 ${
                      active
                        ? "border-teal-300/35 bg-teal-300/10"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/80"
                    }`}
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${item.color}`}>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-100">{item.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{item.meta}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">{children}</div>
        </div>
      </div>
    </main>
  );
}
