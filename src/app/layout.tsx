import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Topbar } from "@/components/ui";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Melhor Preco",
  description: "Monitoramento inteligente de precos com Next.js, Prisma e SQLite.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Topbar />
        {children}
      </body>
    </html>
  );
}
