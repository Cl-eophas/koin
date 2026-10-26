import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { PublicThemeToggle } from "@/components/layout/ThemeToggle";
import { CookieNotice } from "@/components/layout/CookieNotice";

export const metadata: Metadata = {
  title: "koin — Workforce Management",
  description: "Workforce management and operational control platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=localStorage.getItem('yp_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');var a=localStorage.getItem('yp_accent');document.documentElement.setAttribute('data-accent',['gold','ocean','emerald','violet','rose','orange','slate'].indexOf(a)>=0?a:'gold');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-accent','gold');}})();" }} />
      </head>
      <body className="bg-base-bg text-ink min-h-screen antialiased">
        <AuthProvider>
          <ToastProvider>
            {children}
            <PublicThemeToggle />
            <CookieNotice />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
