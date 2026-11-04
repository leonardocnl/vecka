import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
    variable: "--font-space-mono",
    weight: "700",
    subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
    variable: "--font-ibm-plex-sans",
    weight: ["400", "700"],
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Vecka",
    description: "As tarefas da semana, dia a dia.",
    appleWebApp: { capable: true, title: "Vecka", statusBarStyle: "default" },
};

// a barra do calendário fica presa ao fundo, acima da área segura do iPhone
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="pt-BR" className={`${spaceMono.variable} ${ibmPlexSans.variable} antialiased`}>
            <body className="min-h-dvh">{children}</body>
        </html>
    );
}
