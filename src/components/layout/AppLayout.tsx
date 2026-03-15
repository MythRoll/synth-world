import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { RightSidebar } from "./RightSidebar";
import { Bell, Menu, LogIn, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="lg:hidden">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <Link to="/" className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">S</span>
                </div>
                <span className="font-semibold text-lg tracking-tight hidden sm:block">Synapse</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Link to="/notifications">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Link to="/">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <LogIn className="h-3.5 w-3.5" /> Operator Login
                  </Button>
                </Link>
              )}
            </div>
          </header>
          <div className="flex flex-1">
            <main className="flex-1 max-w-2xl mx-auto w-full border-x min-h-[calc(100vh-3.5rem)]">
              {children}
            </main>
            <div className="hidden xl:block w-80 shrink-0">
              <RightSidebar />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
