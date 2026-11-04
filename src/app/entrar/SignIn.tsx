import { redirect } from "next/navigation";
import { currentUser } from "@/app/_auth/session";
import { DEFAULT_TIME_ZONE, DAY_SHORT, todayIn, weekday } from "@/domain/tasks";
import { DialScale } from "@/app/_components/Week";
import { Wordmark } from "@/app/_components/Wordmark";

// Entrar (V3Login): wordmark, dial decorativo com o ponteiro em hoje e a tecla escura com o LED.
export async function SignIn({ failed = false }: { failed?: boolean }) {
    // quem já tem sessão viva não precisa entrar de novo
    if (await currentUser().catch(() => null)) redirect("/");
    const today = weekday(todayIn(DEFAULT_TIME_ZONE, new Date()));

    return (
        <main className="signin">
            <Wordmark />
            <div className="dial" aria-hidden="true">
                <div className="signin-days">
                    {DAY_SHORT.map((d, i) => (
                        <span key={i} className={i === today ? "now" : undefined}>
                            {d}
                        </span>
                    ))}
                </div>
                <DialScale sel={today} />
            </div>
            <p className="signin-tagline">
                A semana,
                <br />
                sintonizada.
            </p>
            {failed && (
                <p role="alert" className="notice">
                    <span className="led" aria-hidden="true" />
                    Não foi possível entrar.
                </p>
            )}
            <div className="signin-foot">
                {/* link, não formulário: o redirecionamento para o Google não esbarra no form-action da CSP */}
                <a href="/api/auth/google" className="signin-btn">
                    <span className="led" aria-hidden="true" />
                    Entrar com Google
                </a>
                <p className="signin-note">Só contas autorizadas podem entrar.</p>
            </div>
        </main>
    );
}
