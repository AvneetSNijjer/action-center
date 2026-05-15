import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { StrategyProvider } from "@/components/strategy-provider";
import { PortfolioProvider } from "@/components/portfolio-provider";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { SimulationToolbar } from "@/components/simulation-toolbar";

export const metadata: Metadata = {
  title: "ampliphi · Action Center",
  description: "Insights & Action Center — the revenue manager's command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <PortfolioProvider>
            <StrategyProvider>
              <div className="flex min-h-screen flex-col bg-background">
                <ReadOnlyBanner />
                <div className="flex flex-1">
                  <Sidebar />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <TopBar />
                    <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
                  </div>
                </div>
              </div>
              <SimulationToolbar />
            </StrategyProvider>
          </PortfolioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
