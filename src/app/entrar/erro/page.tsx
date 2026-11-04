import type { Metadata } from "next";
import { SignIn } from "../SignIn";

export const metadata: Metadata = { title: "Entrar — Vecka" };

// a mesma mensagem para qualquer falha: e-mail fora da lista, state inválido, Google fora do ar
export default function Page() {
    return <SignIn failed />;
}
