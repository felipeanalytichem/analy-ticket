import { useState, useEffect } from "react";
import { 
  Ticket, 
  Bell, 
  Plus, 
  TicketCheck,
  BookOpen,
  Users,
  Settings,
  Home,
  FileText,
  BarChart3,
  Download,
  Plug,
  Clock,
  Timer,
  RotateCcw,
  CheckCircle,
  XCircle,
  TestTube,
  AlertCircle,
  Pause,
  Play,
  CheckSquare,
  ListTodo,
  Zap,
  BarChart,
  FolderOpen,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import DatabaseService from "@/lib/database";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from 'react-i18next';
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  userRole: "user" | "agent" | "admin";
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCreateTicket?: () => void;
}

interface MenuItem {
  title: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
  type: "regular" | "collapsible";
  subItems?: Array<{
    title: string;
    tab: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number | null;
  }>;
}

export function AppSidebar({ userRole, activeTab, onTabChange, onCreateTicket }: AppSidebarProps) {
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { refreshKey } = useTicketCount();
  const [ticketCounts, setTicketCounts] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [todoCount, setTodoCount] = useState(0);
  const { t } = useTranslation();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Load ticket counts - now triggered by refreshKey changes
  useEffect(() => {
    const loadTicketCounts = async () => {
      if (!userProfile?.id) return;

      try {
        // For normal users, load tickets they created (not assigned)
        // For agents/admins, load tickets assigned to them
        const isNormalUser = userRole === "user";
        
        const [openTickets, inProgressTickets, resolvedTickets, closedTickets, unassignedTickets] = await Promise.all([
          DatabaseService.getTickets({
            userId: userProfile.id,
            userRole: userRole,
            assignedOnly: !isNormalUser, // Normal users see their created tickets, not assigned
            showAll: false, // Only show user's relevant tickets for counts
            statusFilter: "open"
          }),
          DatabaseService.getTickets({
            userId: userProfile.id,
            userRole: userRole,
            assignedOnly: !isNormalUser, // Normal users see their created tickets, not assigned
            showAll: false, // Only show user's relevant tickets for counts
            statusFilter: "in_progress"
          }),
          DatabaseService.getTickets({
            userId: userProfile.id,
            userRole: userRole,
            assignedOnly: !isNormalUser, // Normal users see their created tickets, not assigned
            showAll: false, // Only show user's relevant tickets for counts
            statusFilter: "resolved"
          }),
          DatabaseService.getTickets({
            userId: userProfile.id,
            userRole: userRole,
            assignedOnly: !isNormalUser, // Normal users see their created tickets, not assigned
            showAll: false, // Only show user's relevant tickets for counts
            statusFilter: "closed"
          }),
          // Buscar tickets abertos e não assignados para "All Tickets"
          DatabaseService.getTickets({
            userId: userProfile.id,
            userRole: userRole,
            showAll: true, // Ver todos os tickets
            statusFilter: "open",
            unassignedOnly: true // Nova opção para buscar apenas não assignados
          })
        ]);

        setTicketCounts({
          open: openTickets.length,
          in_progress: inProgressTickets.length,
          resolved: resolvedTickets.length,
          closed: closedTickets.length,
        });
        
        setUnassignedCount(unassignedTickets.length);
      } catch (error) {
        console.error('Error loading ticket counts:', error);
      }
    };

    const loadTodoCount = async () => {
      if (!userProfile?.id) return;

      try {
        const tasks = await DatabaseService.getTodoTasks(userProfile.id);
        // Count only active tasks (pending + in_progress)
        const activeTasks = tasks.filter(task => 
          task.status === "pending" || task.status === "in_progress"
        );
        setTodoCount(activeTasks.length);
      } catch (error) {
        console.error('Error loading todo count:', error);
        setTodoCount(0);
      }
    };

    if (userProfile?.id) {
      loadTicketCounts();
      loadTodoCount();
    }

    // Auto-refresh every 30 seconds as backup
    const interval = setInterval(() => {
      if (userProfile?.id) {
        loadTicketCounts();
        loadTodoCount();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [userProfile?.id, userRole, refreshKey]); // Added refreshKey as dependency

  const getMainMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [
      {
        title: t('sidebar.dashboard'),
        tab: "dashboard",
        icon: Home,
        count: null,
        type: "regular" as const
      },
      {
        title: t('sidebar.createTicket'),
        tab: "create-ticket",
        icon: Plus,
        count: null,
        type: "regular" as const
      },
      {
        title: t('sidebar.myTickets'),
        tab: "my-tickets",
        icon: FileText,
        count: null,
        type: "collapsible" as const,
        subItems: [
          {
            title: t('sidebar.openTickets'),
            tab: "open-tickets",
            icon: AlertCircle,
            count: ticketCounts.open,
          },
          {
            title: t('sidebar.inProgressTickets'),
            tab: "in-progress-tickets",
            icon: Play,
            count: ticketCounts.in_progress,
          },
          {
            title: t('sidebar.resolvedTickets'),
            tab: "resolved-tickets",
            icon: CheckCircle,
            count: ticketCounts.resolved,
          },
          {
            title: t('sidebar.closedTickets'),
            tab: "closed-tickets",
            icon: XCircle,
            count: ticketCounts.closed,
          }
        ]
      }
    ];

    if (userRole === "agent" || userRole === "admin") {
      items.push(
        {
          title: t('sidebar.agentDashboard'),
          tab: "agent-dashboard",
          icon: TicketCheck,
          count: null,
          type: "regular" as const
        },
        {
          title: t('sidebar.unassignedTickets'),
          tab: "all-tickets",
          icon: Ticket,
          count: unassignedCount,
          type: "regular" as const
        },
        {
          title: t('sidebar.reopenRequests'),
          tab: "reopen-requests",
          icon: RotateCcw,
          count: null,
          type: "regular" as const
        },
        {
          title: t('sidebar.todo'),
          tab: "todo",
          icon: ListTodo,
          count: todoCount,
          type: "regular" as const
        }
      );
    }

    items.push(
      {
        title: t('sidebar.knowledgeBase'),
        tab: "knowledge",
        icon: BookOpen,
        count: null,
        type: "regular" as const
      },
      {
        title: t('sidebar.reports'),
        tab: "reports",
        icon: BarChart3,
        count: null,
        type: "regular" as const
      }
    );

    // Add administration menu for admins
    if (userRole === "admin") {
      items.push({
        title: t('sidebar.administration'),
        tab: "administration",
        icon: Settings,
        count: null,
        type: "collapsible" as const,
        subItems: [
          {
            title: t('sidebar.userManagement'),
            tab: "admin",
            icon: Users,
            count: null,
          },
          {
            title: t('sidebar.categoryManagement'),
            tab: "category-management",
            icon: FolderOpen,
            count: null,
          },
          {
            title: t('sidebar.slaConfiguration'),
            tab: "sla-config",
            icon: Clock,
            count: null,
          },
          {
            title: "SLA Notifications",
            tab: "sla-notifications",
            icon: Bell,
            count: null,
          },
          {
            title: "Session Timeout",
            tab: "session-timeout-config",
            icon: Timer,
            count: null,
          },
          {
            title: t('sidebar.knowledgeAdmin'),
            tab: "knowledge-admin",
            icon: BookOpen,
            count: null,
          },
          {
            title: t('sidebar.integrations'),
            tab: "integrations",
            icon: Plug,
            count: null,
          },
          {
            title: t('sidebar.debug'),
            tab: "debug",
            icon: TestTube,
            count: null,
          },
        ]
      });
    }

    return items;
  };

  const getAdminMenuItems = () => {
    // This function is no longer needed as admin items are now in main menu
    return [];
  };

  const mainMenuItems = getMainMenuItems();
  const adminMenuItems = getAdminMenuItems();

  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeTab === item.tab;
    const hasCount = item.count !== null && item.count > 0;
    
    // Define status-specific themes
    const getStatusTheme = (tab: string) => {
      switch (tab) {
        case "open-tickets":
          return {
            gradient: "from-orange-500 to-red-500",
            bgGradient: "from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30",
            textColor: "text-orange-700 dark:text-orange-300",
            icon: "🔥",
            borderColor: "border-orange-300 dark:border-orange-700"
          };
        case "in-progress-tickets":
          return {
            gradient: "from-blue-500 to-indigo-500",
            bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
            textColor: "text-blue-700 dark:text-blue-300",
            icon: "⚡",
            borderColor: "border-blue-300 dark:border-blue-700"
          };
        case "resolved-tickets":
          return {
            gradient: "from-green-500 to-emerald-500",
            bgGradient: "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30",
            textColor: "text-green-700 dark:text-green-300",
            icon: "✅",
            borderColor: "border-green-300 dark:border-green-700"
          };
        case "closed-tickets":
          return {
            gradient: "from-gray-500 to-slate-500",
            bgGradient: "from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30",
            textColor: "text-gray-700 dark:text-gray-300",
            icon: "🔒",
            borderColor: "border-gray-300 dark:border-gray-700"
          };
        case "all-tickets":
          return {
            gradient: "from-purple-500 to-pink-500",
            bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30",
            textColor: "text-purple-700 dark:text-purple-300",
            icon: "📋",
            borderColor: "border-purple-300 dark:border-purple-700"
          };
        default:
          return {
            gradient: "from-blue-500 to-purple-500",
            bgGradient: "from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30",
            textColor: "text-blue-700 dark:text-blue-300",
            icon: "🎫",
            borderColor: "border-blue-300 dark:border-blue-700"
          };
      }
    };

    const theme = getStatusTheme(item.tab);
    const isTicketStatus = ["open-tickets", "in-progress-tickets", "resolved-tickets", "closed-tickets", "all-tickets"].includes(item.tab);

    if (item.type === "collapsible") {
      return (
        <Collapsible key={item.tab} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton 
                tooltip={item.title}
                className={cn(
                  "group w-full transition-colors duration-150",
                  isActive && "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800"
                )}
              >
                <item.icon className={cn(
                  "transition-colors duration-150",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"
                )} />
                <span className={cn(
                  "font-medium transition-colors duration-200",
                  isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
                )}>
                  {item.title}
                </span>
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.subItems?.map((subItem) => {
                  const subIsActive = activeTab === subItem.tab;
                  const subTheme = getStatusTheme(subItem.tab);
                  const subHasCount = subItem.count !== null && subItem.count > 0;
                  
                  return (
                    <SidebarMenuSubItem key={subItem.tab}>
                      <SidebarMenuSubButton 
                        onClick={() => {
                          if (subItem.tab === "create-ticket" && onCreateTicket) {
                            onCreateTicket(); // Open dialog instead of navigating
                          } else {
                            onTabChange(subItem.tab); // Normal navigation
                          }
                        }}
                        className={cn(
                          "group transition-colors duration-150",
                          "border border-transparent hover:border-opacity-50",
                          subIsActive && cn(
                            "bg-gradient-to-r shadow-md border-opacity-70 font-semibold",
                            subTheme.bgGradient,
                            subTheme.borderColor
                          ),
                          !subIsActive && "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800/50 dark:hover:to-gray-700/50"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div className={cn(
                            "p-1 rounded-full transition-all duration-200",
                            subIsActive ? cn("bg-gradient-to-r", subTheme.gradient, "text-white") : "bg-gray-200 dark:bg-gray-700"
                          )}>
                            <subItem.icon className={cn(
                              "h-3 w-3 transition-all duration-200",
                              subIsActive ? "text-white" : "text-gray-500 dark:text-gray-400"
                            )} />
                          </div>
                          <span className={cn(
                            "transition-colors duration-200 flex items-center gap-1",
                            subIsActive ? subTheme.textColor : "text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100"
                          )}>
                            {subItem.title}
                          </span>
                        </div>
                        {subHasCount && (
                          <Badge 
                            variant={subIsActive ? "secondary" : "outline"}
                            className={cn(
                              "ml-auto transition-colors duration-150 text-xs font-bold",
                              subIsActive && cn(
                                "bg-white/80 dark:bg-black/20 shadow-sm",
                                subTheme.textColor
                              ),
                              !subIsActive && "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            )}
                          >
                            {subItem.count}
                          </Badge>
                        )}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.tab}>
        <SidebarMenuButton 
          onClick={() => {
            if (item.tab === "create-ticket" && onCreateTicket) {
              onCreateTicket(); // Open dialog instead of navigating
            } else {
              onTabChange(item.tab); // Normal navigation
            }
          }}
          tooltip={item.title}
          className={cn(
            "group transition-colors duration-150",
            "border border-transparent hover:border-opacity-50",
            isActive && isTicketStatus && cn(
              "bg-gradient-to-r shadow-md border-opacity-70 font-semibold",
              theme.bgGradient,
              theme.borderColor
            ),
            isActive && !isTicketStatus && "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800",
            !isActive && "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800/50 dark:hover:to-gray-700/50"
          )}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className={cn(
              "p-1.5 rounded-lg transition-all duration-200",
              isActive && isTicketStatus ? cn("bg-gradient-to-r", theme.gradient, "text-white shadow-md") :
              isActive && !isTicketStatus ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md" :
              "bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-300 dark:group-hover:bg-gray-600"
            )}>
              <item.icon className={cn(
                "h-4 w-4 transition-all duration-200",
                isActive ? "text-white" : "text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
              )} />
            </div>
            <span className={cn(
              "font-medium transition-colors duration-200 flex items-center gap-2",
              isActive && isTicketStatus ? theme.textColor :
              isActive && !isTicketStatus ? "text-blue-700 dark:text-blue-300" :
              "text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100"
            )}>
              {item.title}
            </span>
          </div>
          {hasCount && (
            <Badge 
              variant={isActive ? "secondary" : "outline"}
              className={cn(
                "ml-auto transition-colors duration-150 font-bold",
                isActive && isTicketStatus && cn(
                  "bg-white/80 dark:bg-black/20 shadow-sm",
                  theme.textColor
                ),
                isActive && !isTicketStatus && "bg-white/80 dark:bg-black/20 text-blue-700 dark:text-blue-300 shadow-sm",
                !isActive && "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              )}
            >
              {item.count}
            </Badge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <Ticket className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ACS Ticket</h1>
            <p className="text-xs text-muted-foreground">{t('sidebar.helpDeskSystem')}</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('sidebar.mainMenu')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-4">
        {userProfile && (
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={userProfile.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white text-xs">
                {getInitials(userProfile.full_name || userProfile.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userProfile.full_name || userProfile.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{userProfile.role}</p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
