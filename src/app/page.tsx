import { requireUser } from "@/app/_auth/session";
import { signOut } from "@/app/_auth/actions";
import { Wordmark } from "@/app/_components/Wordmark";

export default async function Home() {
    await requireUser();
    return (
        <div className="mx-auto max-w-page">
            <header className="flex items-center justify-between px-gutter pt-24">
                <Wordmark />
                <form action={signOut}>
                    <button type="submit" className="min-h-target text-muted">
                        sair
                    </button>
                </form>
            </header>
            <main />
        </div>
    );
}
