import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/app/theme-provider";
import { PwaRegister } from "@/components/app/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatCommerce CRM Africa - Plateforme CRM Telegram pour PME Africaines",
  description:
    "Le premier CRM Telegram conçu pour les entreprises africaines. Créez des bots intelligents, automatisez vos ventes et gérez vos clients depuis Telegram.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/icons/icon-192.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "ChatCommerce",
    "msapplication-TileColor": "#25D366",
    "theme-color": "#25D366",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
          storageKey="cc-theme"
        >
          <TooltipProvider delayDuration={0}>
            {children}
          </TooltipProvider>
          <Toaster />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}