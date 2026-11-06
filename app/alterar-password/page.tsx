import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { setOwnPassword, logoutUser } from "@/app/actions";
import { buttonClass, inputClass } from "@/app/components/ui";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");
  const params = await searchParams;
  return <main className="fixed inset-0 flex items-center justify-center bg-black/90 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="password-title" className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-6">
      <h1 id="password-title" className="text-xl font-semibold">Alterar a palavra-passe</h1>
      <p className="mt-2 text-sm text-zinc-400">Olá, {user.name}. Define a tua palavra-passe pessoal para continuar. Usa pelo menos 10 caracteres e uma palavra-passe diferente da temporária.</p>
      {params.erro && <p role="alert" className="mt-3 text-rose-300">Confirma que as palavras-passe coincidem, têm entre 10 e 128 caracteres e são diferentes da atual.</p>}
      <form action={setOwnPassword} className="mt-4 grid gap-3">
        <label>Nova palavra-passe<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} /></label>
        <label>Confirmar palavra-passe<input name="confirmation" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} /></label>
        <button className={buttonClass}>Guardar e entrar</button>
      </form>
      <form action={logoutUser} className="mt-3"><button className="text-sm text-zinc-400">Terminar sessão</button></form>
    </section>
  </main>;
}
