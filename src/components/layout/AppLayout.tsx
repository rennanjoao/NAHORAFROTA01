import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BillingReminderDialog } from "./BillingReminderDialog";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      <AppSidebar 
        mobileOpen={sidebarOpen} 
        onMobileClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "md:pl-16" : "md:pl-64"
      )}>
        <TopBar 
          showMenuButton 
          onMenuToggle={() => setSidebarOpen(true)} 
        />
        <main className="p-3 md:p-6">{children}</main>
      </div>

      <BillingReminderDialog />
    </div>
  );
}
