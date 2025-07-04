import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Calendar, Clock, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { TicketDialog } from "@/components/tickets/dialogs/TicketDialog";
import { TicketList } from "@/components/tickets/TicketList";
import { AdvancedFilters } from "@/components/tickets/AdvancedFilters";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { cn } from "@/lib/utils";

const TicketsPage = () => {
  const { t } = useTranslation();
  const { status } = useParams<{ status: string }>();
  const { userProfile } = useAuth();
  const { triggerRefresh } = useTicketCount();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [ticketListKey, setTicketListKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    todayCount: 0,
    weekCount: 0,
    avgResolutionTime: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const getStatusFilter = () => {
    switch (status) {
      case "open": return "open";
      case "in-progress": return "in_progress";
      case "resolved": return "resolved";
      case "closed": return "closed";
      case "all": return userRole === "user" ? "active" : "open";
      default: return "my_tickets";
    }
  };

  // Load tickets and calculate statistics
  useEffect(() => {
    const loadTicketsAndStats = async () => {
      setIsLoadingStats(true);
      try {
        const options = {
          userId: userProfile?.id,
          showAll: userRole !== "user",
          statusFilter: getStatusFilter(),
          userRole: userRole,
        };
        
        const loadedTickets = await DatabaseService.getTickets(options);
        setTickets(loadedTickets);
        
        console.log('🔍 Statistics Debug:', {
          totalLoadedTickets: loadedTickets.length,
          status,
          userRole,
          options
        });
        
        // Calculate statistics from loaded tickets
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Filter tickets based on current status
        let relevantTickets = loadedTickets;
        switch (status) {
          case "open":
            relevantTickets = loadedTickets.filter(t => t.status === 'open');
            break;
          case "in-progress":
            relevantTickets = loadedTickets.filter(t => t.status === 'in_progress');
            break;
          case "resolved":
            relevantTickets = loadedTickets.filter(t => t.status === 'resolved');
            break;
          case "closed":
            relevantTickets = loadedTickets.filter(t => t.status === 'closed');
            break;
          default:
            relevantTickets = loadedTickets;
        }
        
        const total = relevantTickets.length;
        
        const todayCount = relevantTickets.filter(t => {
          if (status === "resolved") {
            return t.resolved_at && t.resolved_at.startsWith(todayStr);
          } else if (status === "closed") {
            return t.closed_at && t.closed_at.startsWith(todayStr);
          } else {
            return t.created_at && t.created_at.startsWith(todayStr);
          }
        }).length;
        
        const weekCount = relevantTickets.filter(t => {
          if (status === "resolved") {
            return t.resolved_at && new Date(t.resolved_at) >= weekAgo;
          } else if (status === "closed") {
            return t.closed_at && new Date(t.closed_at) >= weekAgo;
          } else {
            return t.created_at && new Date(t.created_at) >= weekAgo;
          }
        }).length;
        
        // Calculate average resolution time for resolved/closed tickets
        let avgResolutionTime = 0;
        if (status === "resolved" || status === "closed") {
          const resolvedTickets = relevantTickets.filter(t => 
            t.created_at && t.resolved_at
          );
          
          if (resolvedTickets.length > 0) {
            const totalHours = resolvedTickets.reduce((sum, ticket) => {
              const created = new Date(ticket.created_at);
              const resolved = new Date(ticket.resolved_at!);
              const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
              return sum + hours;
            }, 0);
            avgResolutionTime = totalHours / resolvedTickets.length;
          }
        }
        
        setStatistics({
          total,
          todayCount,
          weekCount,
          avgResolutionTime
        });
      } catch (error) {
        console.error('Error loading tickets and statistics:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (userProfile) {
      loadTicketsAndStats();
    }
  }, [status, userProfile, userRole]);

  const handleFiltersChange = (newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  };

  const handleTicketCreated = () => {
    // Force re-render of TicketList components
    setTicketListKey(prev => prev + 1);
    // Trigger sidebar count refresh
    triggerRefresh();
  };

  const getStatusTheme = () => {
    switch (status) {
      case "open":
        return {
          gradient: "bg-gradient-to-r from-orange-500 to-red-500",
          bgGradient: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20",
          borderColor: "border-orange-200 dark:border-orange-800",
          textColor: "text-orange-700 dark:text-orange-300",
          icon: "🔥",
          name: "Open Tickets"
        };
      case "in-progress":
        return {
          gradient: "bg-gradient-to-r from-blue-500 to-indigo-500",
          bgGradient: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20",
          borderColor: "border-blue-200 dark:border-blue-800",
          textColor: "text-blue-700 dark:text-blue-300",
          icon: "⚡",
          name: "In Progress"
        };
      case "resolved":
        return {
          gradient: "bg-gradient-to-r from-green-500 to-emerald-500",
          bgGradient: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20",
          borderColor: "border-green-200 dark:border-green-800",
          textColor: "text-green-700 dark:text-green-300",
          icon: "✅",
          name: "Resolved"
        };
      case "closed":
        return {
          gradient: "bg-gradient-to-r from-gray-500 to-slate-500",
          bgGradient: "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20",
          borderColor: "border-gray-200 dark:border-gray-800",
          textColor: "text-gray-700 dark:text-gray-300",
          icon: "🔒",
          name: "Closed"
        };
      case "all":
        return {
          gradient: "bg-gradient-to-r from-purple-500 to-pink-500",
          bgGradient: "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20",
          borderColor: "border-purple-200 dark:border-purple-800",
          textColor: "text-purple-700 dark:text-purple-300",
          icon: "📋",
          name: t('sidebar.unassignedTickets')
        };
      default:
        return {
          gradient: "bg-gradient-to-r from-blue-600 to-purple-600",
          bgGradient: "bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20",
          borderColor: "border-blue-200 dark:border-blue-800",
          textColor: "text-blue-700 dark:text-blue-300",
          icon: "🎫",
          name: "My Tickets"
        };
    }
  };

  const getPageTitle = () => {
    const theme = getStatusTheme();
    return theme.name;
  };

  const getTicketListProps = () => {
    const baseProps = {
      statusFilter: getStatusFilter()
    };

    switch (status) {
      case "in-progress":
        return { ...baseProps, showAll: true };
      case "all":
        return {
          ...baseProps,
          showAll: userRole === "user",
          unassignedOnly: userRole !== "user"
        };
      case "open":
      case "resolved":
      case "closed":
        return {
          ...baseProps,
          assignedOnly: userRole !== "user"
        };
      default:
        return { ...baseProps, assignedOnly: true };
    }
  };

  const showCreateButton = !status || ["open", "in-progress", "all"].includes(status);
  const theme = getStatusTheme();

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Gradient */}
      <div className={cn("rounded-xl p-6 border", theme.bgGradient, theme.borderColor)}>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg text-white", theme.gradient)}>
                <span className="text-2xl">{theme.icon}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {getPageTitle()}
                </h1>
                <p className={cn("text-sm", theme.textColor)}>
                  {status === "open" && "Tickets waiting for assignment and initial response"}
                  {status === "in-progress" && "Tickets currently being worked on by agents"}
                  {status === "resolved" && "Tickets marked as resolved, awaiting closure"}
                  {status === "closed" && "Completed tickets that have been closed"}
                  {status === "all" && "All unassigned tickets requiring attention"}
                  {!status && "Your personal tickets and requests"}
                </p>
              </div>
            </div>
          </div>
          {showCreateButton && (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎫 Create Ticket button clicked in TicketsPage');
                console.log('🔍 Current isCreateDialogOpen state:', isCreateDialogOpen);
                setIsCreateDialogOpen(true);
                console.log('✅ setIsCreateDialogOpen(true) called');
                console.log('🎯 Dialog should now be open');
              }}
              className={cn("shadow-lg hover:shadow-xl transition-all duration-200", theme.gradient)}
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Ticket
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total {theme.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoadingStats ? "..." : statistics.total}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoadingStats ? "..." : statistics.todayCount}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoadingStats ? "..." : statistics.weekCount}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Avg Resolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoadingStats ? "..." : formatTime(statistics.avgResolutionTime)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Collapsible Advanced Filters */}
      <Card className="overflow-hidden">
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
          onClick={() => setShowFilters(!showFilters)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-md text-white", theme.gradient)}>
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Advanced Filters</span>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showFilters ? "Hide" : "Show"}
            </Badge>
          </CardTitle>
        </CardHeader>
        {showFilters && (
          <CardContent className={cn("border-t", theme.bgGradient)}>
            <AdvancedFilters onFiltersChange={handleFiltersChange} />
          </CardContent>
        )}
      </Card>
      
      {/* Enhanced Ticket List */}
      <div className="space-y-4">
        <TicketList key={`tickets-${status}-${ticketListKey}`} {...getTicketListProps()} />
      </div>

      <TicketDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onTicketCreated={handleTicketCreated}
      />
      
      {/* Debug logging */}
      {console.log('🔍 TicketsPage render - isCreateDialogOpen:', isCreateDialogOpen)}
    </div>
  );
};

export default TicketsPage; 