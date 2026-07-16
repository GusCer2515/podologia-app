import type { Metadata } from "next";
import { Cormorant_Garamond, Karla } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.vidadecolorespodologia.cl"),
  title: "Vida de Colores — Podología Clínica",
  description:
    "Cuidado podológico profesional con atención personalizada. Agenda tu hora online. Podóloga clínica Jahel Rivera Soto.",
  openGraph: {
    title: "Vida de Colores — Podología Clínica",
    description:
      "Cuidado podológico profesional. Agenda tu hora online en segundos. 🌸",
    url: "https://www.vidadecolorespodologia.cl",
    siteName: "Vida de Colores",
    locale: "es_CL",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${cormorant.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
