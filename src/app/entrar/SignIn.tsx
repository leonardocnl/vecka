import { redirect } from "next/navigation";
import { currentUser } from "@/app/_auth/session";
import { Wordmark } from "@/app/_components/Wordmark";

export async function SignIn({ failed = false }: { failed?: boolean }) {
    // quem já tem sessão viva não precisa entrar de novo
    if (await currentUser().catch(() => null)) redirect("/");

    return (
        <div className="mx-auto max-w-page">
            <header className="px-gutter pt-24">
                <Wordmark />
            </header>
            <main className="px-gutter pt-48">
                {failed && (
                    <p role="alert" className="mb-24">
                        <span className="bg-signal px-8 text-white">Não foi possível entrar.</span>
                    </p>
                )}
                {/* link, não formulário: o redirecionamento para o Google não esbarra no form-action da CSP */}
                <a
                    href="/api/auth/google"
                    className="inline-flex min-h-target items-center border-2 border-ink bg-ink px-24 text-lg text-paper"
                >
                    Entrar com Google
                </a>
            </main>
        </div>
    );
}
