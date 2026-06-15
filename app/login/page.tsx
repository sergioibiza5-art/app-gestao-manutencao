import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import { loginUser } from "@/app/actions";
import { buttonClass, inputClass } from "@/app/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);

  if (user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.12),transparent_24%),#070807] px-4 py-6 text-zinc-100">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center">
        <div className="glass-panel w-full rounded-lg p-5 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-lg bg-teal-400 text-zinc-950">
              <ShieldCheck size={24} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300">Casa SGQ</p>
              <h1 className="text-2xl font-semibold text-zinc-50">Entrar na app</h1>
            </div>
          </div>

          <form action={loginUser} className="mt-6 space-y-3">
            <input name="credential" required className={inputClass} placeholder="Email ou utilizador" autoComplete="username" />
            <input name="password" type="password" required className={inputClass} placeholder="Palavra-passe" autoComplete="current-password" />
            {params.erro && (
              <p className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                Utilizador/email ou palavra-passe incorretos.
              </p>
            )}
            <button className={`${buttonClass} w-full`}>
              <LockKeyhole size={17} />
              Entrar
            </button>
          </form>

          <p className="mt-4 text-sm leading-6 text-zinc-500">
            Para postos de ticket usa o utilizador do posto e a palavra-passe definida nos acessos.
          </p>
        </div>
      </section>
    </main>
  );
}
