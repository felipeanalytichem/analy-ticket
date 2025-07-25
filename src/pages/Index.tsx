import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfile } from "@/components/auth/UserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { TicketDialog } from "@/components/tickets/dialogs/TicketDialog";
import { TicketList } from "@/components/tickets/TicketList";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AdvancedStatsCards } from "@/components/dashboard/AdvancedStatsCards";
import { TicketCharts } from "@/components/dashboard/TicketCharts";
import { AdvancedFilters } from "@/components/tickets/AdvancedFilters";

import { KnowledgeBase } from "@/components/knowledge/KnowledgeBase";
import { ReportExporter } from "@/components/reports/ReportExporter";
import { ExternalIntegrations } from "@/components/integrations/ExternalIntegrations";
import { SLAConfiguration } from "@/components/admin/SLAConfiguration";
import { UserManagement } from "@/components/admin/UserManagement";
import { ReopenRequests } from "./ReopenRequests";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationDemo } from "@/components/notifications/NotificationDemo";
import { NotificationTester } from "@/components/notifications/NotificationTester";
import { TodoList } from "@/components/todo/TodoList";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { ConnectionMonitor } from "@/components/auth/ConnectionMonitor";
import { AgentDashboard } from "./AgentDashboard";
import { SubscriptionDebugger } from "@/components/debug/SubscriptionDebugger";
import { KnowledgeBaseAdmin } from "@/components/admin/knowledge/KnowledgeBaseAdmin";

const Index = () => {
  const { userProfile } = useAuth();
  const { triggerRefresh } = useTicketCount();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";
  
  // Helper function to get default route based on user role
  const getDefaultRoute = (role: "user" | "agent" | "admin"): string => {
    switch (role) {
      case "agent":
        return "agent-dashboard";
      case "admin":
        return "dashboard"; // Analytics for admins
      case "user":
      default:
        return "dashboard";
    }
  };
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(getDefaultRoute(userRole));
  const [filters, setFilters] = useState({});
  const [ticketListKey, setTicketListKey] = useState(0);

  const handleFiltersChange = (newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  };

  const handleTicketCreated = () => {
    // Force re-render of TicketList components
    setTicketListKey(prev => prev + 1);
    // Trigger sidebar count refresh
    triggerRefresh();
  };

  // Update activeTab when user role changes to ensure proper default landing page
  useEffect(() => {
    const defaultRoute = getDefaultRoute(userRole);
    // Only update if we're currently on a default route (dashboard or agent-dashboard)
    // This prevents overriding user navigation when they're actively using the app
    if (activeTab === "dashboard" || activeTab === "agent-dashboard") {
      setActiveTab(defaultRoute);
    }
  }, [userRole]);

  // Debug: Log current activeTab
  console.log('🔍 Current activeTab:', activeTab, 'userRole:', userRole);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar 
          userRole={userRole} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          onCreateTicket={() => {
            console.log('🎫 Create Ticket called from sidebar');
            setIsCreateDialogOpen(true);
          }}
        />
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🎫 Create Ticket button clicked in Index (header)');
                  console.log('🔍 Current isCreateDialogOpen state:', isCreateDialogOpen);
                  setIsCreateDialogOpen(true);
                  console.log('✅ setIsCreateDialogOpen(true) called');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
              <UserProfile />
            </div>
          </header>

          <ConnectionMonitor />

          {/* Main Content */}
          <main className="flex-1 p-6">
            {activeTab === "dashboard" && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                    Dashboard & Analytics
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Welcome, {userProfile?.full_name?.split(' ')[0] || 'User'}
                  </p>
                  <StatsCards />
                </div>
                
                {/* Analytics Section */}
                {(userRole === "agent" || userRole === "admin") && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Analytics & KPIs</h2>
                      <AdvancedStatsCards />
                    </div>
                    <TicketCharts />
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        Unassigned Tickets
                      </CardTitle>
                      <CardDescription>Tickets that are currently unassigned and awaiting assignment</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TicketList 
                        key={`recent-${ticketListKey}`} 
                        limit={5} 
                        showAll={true} 
                        unassignedOnly={true}
                        statusFilter="open"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "agent-dashboard" && (
              <AgentDashboard />
            )}

            {(activeTab === "tickets" || activeTab === "all-tickets" || activeTab === "open-tickets" || activeTab === "in-progress-tickets" || activeTab === "resolved-tickets" || activeTab === "closed-tickets") && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {activeTab === "tickets" && "My Tickets"}
                    {activeTab === "all-tickets" && "All Tickets"}
                    {activeTab === "open-tickets" && "Open Tickets"}
                    {activeTab === "in-progress-tickets" && "In Progress Tickets"}
                    {activeTab === "resolved-tickets" && "Resolved Tickets"}
                    {activeTab === "closed-tickets" && "Closed Tickets"}
                  </h2>
                  {(activeTab === "tickets" || activeTab === "all-tickets" || activeTab === "open-tickets" || activeTab === "in-progress-tickets") && (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🎫 Create Ticket button clicked in Index (header)');
                        console.log('🔍 Current isCreateDialogOpen state:', isCreateDialogOpen);
                        setIsCreateDialogOpen(true);
                        console.log('✅ setIsCreateDialogOpen(true) called');
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Ticket
                    </Button>
                  )}
                </div>
                
                <AdvancedFilters onFiltersChange={handleFiltersChange} />
                <TicketList 
                  key={`main-${ticketListKey}`} 
                  showAll={
                    activeTab === "in-progress-tickets" || 
                    (activeTab === "all-tickets" && userRole === "user") // For normal users, all-tickets shows all open tickets
                  } 
                  assignedOnly={
                    activeTab === "tickets" || 
                    (activeTab === "open-tickets" && userRole !== "user") || // For agents/admins, open-tickets shows assigned
                    activeTab === "resolved-tickets" || 
                    activeTab === "closed-tickets"
                  }
                  unassignedOnly={
                    (activeTab === "all-tickets" && userRole !== "user") // For agents/admins, all-tickets shows unassigned
                  }
                  statusFilter={
                    activeTab === "tickets" ? "my_tickets" :
                    activeTab === "open-tickets" ? "open" :
                    activeTab === "in-progress-tickets" ? "in_progress" :
                    activeTab === "resolved-tickets" ? "resolved" : 
                    activeTab === "closed-tickets" ? "closed" :
                    activeTab === "all-tickets" ? 
                      (userRole === "user" ? "active" : "open") : // For normal users, show all active tickets
                    undefined
                  }
                />
              </div>
            )}

            {activeTab === "knowledge" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Knowledge Base</h2>
                </div>
                <KnowledgeBase />
              </div>
            )}

            {activeTab === "todo" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">To-Do List</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Manage your ticket-related tasks
                  </p>
                </div>
                <TodoList />
              </div>
            )}

            {activeTab === "reports" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Reports & Export</h2>
                </div>
                <ReportExporter />
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">External Integrations</h2>
                </div>
                <ExternalIntegrations />
              </div>
            )}

            {activeTab === "notifications-demo" && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                    Notification System
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Real-time notification system demonstration
                  </p>
                </div>
                <NotificationDemo />
              </div>
            )}

            {activeTab === "notification-tester" && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                    Notification Tester
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Tool to test the real-time notification system
                  </p>
                </div>
                <NotificationTester />
              </div>
            )}

            {activeTab === "admin" && userRole === "admin" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">User Management</h2>
                </div>
                <UserManagement />
              </div>
            )}

            {activeTab === "category-management" && userRole === "admin" && (
              <div className="space-y-6">
                <CategoryManagement />
              </div>
            )}

            {activeTab === "sla-config" && userRole === "admin" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">SLA Configuration</h2>
                </div>
                <SLAConfiguration />
              </div>
            )}

            {activeTab === "reopen-requests" && (userRole === "agent" || userRole === "admin") && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Reopen Requests</h2>
                </div>
                <ReopenRequests />
              </div>
            )}

            {activeTab === "knowledge-admin" && userRole === "admin" && (
              <div className="space-y-6">
                <KnowledgeBaseAdmin userRole={userRole} userId={userProfile?.id || ""} />
              </div>
            )}
          </main>

          <TicketDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onTicketCreated={handleTicketCreated}
          />
          
          {/* Debug Component - Only show in development */}
          {process.env.NODE_ENV === 'development' && <SubscriptionDebugger />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Index;
