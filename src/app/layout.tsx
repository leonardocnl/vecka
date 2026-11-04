import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Mono } from "next/font/google";
import Script from "next/script";
import { Grain } from "./_components/Grain";
import "./globals.css";

const spaceMono = Space_Mono({
    variable: "--font-space-mono",
    weight: "700",
    subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
    variable: "--font-ibm-plex-sans",
    weight: ["400", "600", "700"],
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Vecka",
    description: "As tarefas da semana, dia a dia.",
    appleWebApp: { capable: true, title: "Vecka", statusBarStyle: "default" },
};

// a barra inferior fica presa ao fundo, acima da área segura do iPhone
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        // o script de aparência muda a classe e o data-font do <html> antes da hidratação
        <html
            lang="pt-BR"
            className={`${spaceMono.variable} ${ibmPlexSans.variable} antialiased`}
            suppressHydrationWarning
        >
            <body className="min-h-dvh">
                <Script src="/appearance.js" strategy="beforeInteractive" />
                <Grain />
                {children}
            </body>
        </html>
    );
}
