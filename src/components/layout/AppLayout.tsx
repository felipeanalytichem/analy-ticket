import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { TicketDialog } from "@/components/tickets/dialogs/TicketDialog";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { ConnectionMonitor } from "@/components/auth/ConnectionMonitor";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export const AppLayout = ({ children, title, showSearch = true, onSearch }: AppLayoutProps) => {
  const { userProfile } = useAuth();
  const { triggerRefresh } = useTicketCount();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [ticketListKey, setTicketListKey] = useState(0);
  const { t } = useTranslation();

  // Map URL paths to sidebar tab IDs
  const getActiveTabFromPath = (pathname: string): string => {
    const pathMap: Record<string, string> = {
      '/': 'dashboard',
      '/dashboard': 'dashboard',
      '/tickets': 'my-tickets',
      '/tickets/open': 'open-tickets',
      '/tickets/in-progress': 'in-progress-tickets',
      '/tickets/resolved': 'resolved-tickets',
      '/tickets/closed': 'closed-tickets',
      '/tickets/all': 'all-tickets',
      '/agent-dashboard': 'agent-dashboard',
      '/analytics': 'analytics',
      '/reports': 'reports',
      '/knowledge': 'knowledge',
      '/knowledge-base': 'knowledge',
      '/admin/knowledge': 'knowledge-admin',
      '/admin/users': 'admin',
      '/admin/categories': 'category-management',
      '/admin/sla': 'sla-config',
      '/debug': 'debug',
      '/user-management': 'admin',
      '/category-management': 'category-management',
      '/sla-config': 'sla-config',
      '/settings': 'settings',
      '/profile': 'profile',
      '/notifications': 'notifications',
      '/todo': 'todo',
      '/integrations': 'integrations',
      '/reopen-requests': 'reopen-requests',
    };
    return pathMap[pathname] || 'dashboard';
  };

  const activeTab = getActiveTabFromPath(location.pathname);

  const handleTabChange = (tab: string) => {
    const tabRoutes: Record<string, string> = {
      'dashboard': '/',
      'my-tickets': '/tickets',
      'open-tickets': '/tickets/open',
      'in-progress-tickets': '/tickets/in-progress',
      'resolved-tickets': '/tickets/resolved',
      'closed-tickets': '/tickets/closed',
      'all-tickets': '/tickets/all',
      'agent-dashboard': '/agent-dashboard',
      'analytics': '/analytics',
      'reports': '/reports',
      'knowledge': '/knowledge',
      'knowledge-admin': '/admin/knowledge',
      'admin': '/admin/users',
      'category-management': '/admin/categories',
      'sla-config': '/admin/sla',
      'debug': '/debug',
      'settings': '/settings',
      'profile': '/profile',
      'notifications': '/notifications',
      'todo': '/todo',
      'integrations': '/integrations',
      'reopen-requests': '/reopen-requests',
    };

    const route = tabRoutes[tab] || '/';
    navigate(route);
  };

  const handleTicketCreated = () => {
    // Force re-render of TicketList components
    setTicketListKey(prev => prev + 1);
    // Trigger sidebar count refresh
    triggerRefresh();
  };

  // Get page title from route if not provided
  const getPageTitle = () => {
    if (title) return title;
    
    const routeTitles: Record<string, string> = {
      'dashboard': 'Dashboard',
      'my-tickets': 'My Tickets',
      'open-tickets': 'Open Tickets',
      'in-progress-tickets': 'In Progress',
      'resolved-tickets': 'Resolved',
      'closed-tickets': 'Closed',
      'agent-dashboard': 'Agent Dashboard',
      'analytics': 'Analytics',
      'reports': 'Reports',
      'knowledge': 'Knowledge Base',
      'knowledge-admin': 'Knowledge Management',
      'admin': 'User Management',
      'category-management': 'Category Management',
      'sla-config': 'SLA Configuration',
      'settings': 'Settings',
      'profile': 'Profile',
      'notifications': 'Notifications',
      'todo': 'Todo Tasks',
      'integrations': 'Integrations',
      'reopen-requests': 'Reopen Requests'
    };

    return routeTitles[activeTab] || 'Dashboard';
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full">
        <AppSidebar 
          userRole={userRole} 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onCreateTicket={() => {
            console.log('🎫 Sidebar Create Ticket clicked - opening dialog');
            setIsCreateDialogOpen(true);
          }}
        />
        <SidebarInset className="flex-1">
          <Header 
            title={getPageTitle()}
            showSearch={showSearch}
            onSearch={onSearch}
          />
          <ConnectionMonitor />

          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-auto",
            // Mobile-optimized padding and spacing
            "p-4 md:p-6 lg:p-8",
            // Better scroll behavior on mobile
            "scroll-smooth",
            // Ensure content doesn't get cut off on mobile
            "pb-safe-area-inset-bottom"
          )}>
            <div className={cn(
              // Mobile-first responsive container
              "w-full max-w-none",
              "space-y-4 md:space-y-6",
              // Better mobile spacing
              isMobile && "space-y-3"
            )}>
              {children}
            </div>
          </main>

          <TicketDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onTicketCreated={handleTicketCreated}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}; 