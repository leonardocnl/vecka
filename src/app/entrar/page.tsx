import type { Metadata } from "next";
import { SignIn } from "./SignIn";

export const metadata: Metadata = { title: "Entrar — Vecka" };

export default function Page() {
    return <SignIn />;
}
