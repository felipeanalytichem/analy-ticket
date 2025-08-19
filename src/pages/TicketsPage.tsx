import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, TrendingUp, Calendar, Clock, BarChart3, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { TicketDialog } from "@/components/tickets/dialogs/TicketDialog";
import { TicketList } from "@/components/tickets/TicketList";
import { AdvancedFilters } from "@/components/tickets/AdvancedFilters";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
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
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

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

  // Load tickets and calculate statistics with enhanced filtering logic
  useEffect(() => {
    const loadTicketsAndStats = async () => {
      if (!userProfile) {
        setError(t('tickets.pleaseLoginToViewTickets', 'Please log in to view tickets'));
        setIsLoadingStats(false);
        return;
      }

      setIsLoadingStats(true);
      setError(null);
      
      try {
        // Enhanced filtering options based on user role and requirements
        const options = {
          userId: userProfile.id,
          userRole: userRole,
          statusFilter: getStatusFilter(),
          // For regular users, enforce strict filtering
          showAll: userRole !== "user",
          // Include closed tickets with 7-day visibility window for users
          includeClosedTickets: userRole === "user" ? true : undefined,
        };
        
        console.log('🔍 Enhanced filtering options:', {
          userId: options.userId,
          userRole: options.userRole,
          statusFilter: options.statusFilter,
          showAll: options.showAll,
          includeClosedTickets: options.includeClosedTickets
        });
        
        const loadedTickets = await DatabaseService.getTickets(options);
        
        if (!Array.isArray(loadedTickets)) {
          throw new Error(t('tickets.error', 'Invalid ticket data received from server'));
        }
        
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
            // For closed tickets, apply additional time-based filtering for users
            relevantTickets = loadedTickets.filter(t => {
              if (t.status !== 'closed') return false;
              
              // For users, check if closed ticket is within 7-day visibility window
              if (userRole === 'user') {
                return DatabaseService.isClosedTicketVisible(t.closed_at);
              }
              
              return true;
            });
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
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : t('tickets.errorLoadingTickets', 'Failed to load tickets');
        console.error('Error loading tickets and statistics:', error);
        
        // Handle specific error types
        if (error instanceof Error) {
          if (error.name === 'UnauthorizedAccess') {
            setError(t('tickets.accessDeniedMessage', 'Access denied: You can only view your own tickets'));
            toast({
              title: t('common.accessDenied', 'Access Denied'),
              description: t('tickets.canOnlyViewOwnTickets', 'You can only view tickets that belong to you'),
              variant: "destructive",
            });
          } else if (error.name === 'NotFound') {
            setError(t('tickets.noTicketsMessage', 'No tickets are available at the moment'));
          } else {
            setError(errorMessage);
            toast({
              title: t('tickets.errorLoadingTickets', 'Error loading tickets'),
              description: errorMessage,
              variant: "destructive",
            });
          }
        } else {
          setError(t('common.unexpectedError', 'An unexpected error occurred. Please try again.'));
          toast({
            title: t('tickets.errorLoadingTickets', 'Error loading tickets'),
            description: t('common.unexpectedError', 'An unexpected error occurred. Please try again.'),
            variant: "destructive",
          });
        }
        
        // Reset tickets and statistics on error
        setTickets([]);
        setStatistics({
          total: 0,
          todayCount: 0,
          weekCount: 0,
          avgResolutionTime: 0
        });
        
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadTicketsAndStats();
  }, [status, userProfile, userRole, toast]);

  const handleFiltersChange = (newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  };

  const handleTicketCreated = () => {
    // Force re-render of TicketList components
    setTicketListKey(prev => prev + 1);
    // Trigger sidebar count refresh
    triggerRefresh();
  };

  // Refresh function for manual ticket reload
  const handleRefresh = async () => {
    if (!userProfile || isRefreshing) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const options = {
        userId: userProfile.id,
        userRole: userRole,
        statusFilter: getStatusFilter(),
        showAll: userRole !== "user",
        includeClosedTickets: userRole === "user" ? true : undefined,
      };

      const loadedTickets = await DatabaseService.getTickets(options);
      
      if (!Array.isArray(loadedTickets)) {
        throw new Error(t('tickets.error', 'Invalid ticket data received from server'));
      }

      setTickets(loadedTickets);
      setTicketListKey(prev => prev + 1);
      triggerRefresh();

      toast({
        title: t('tickets.ticketsRefreshedSuccessfully', 'Tickets refreshed successfully'),
        description: t('tickets.ticketsRefreshedSuccessfully', 'Your ticket list has been updated successfully'),
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('tickets.errorRefreshingTickets', 'Failed to refresh tickets');
      console.error('Error refreshing tickets:', error);
      
      setError(errorMessage);
      toast({
        title: t('tickets.errorRefreshingTickets', 'Error refreshing tickets'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
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
          name: t('navigation.openTickets', 'Open Tickets')
        };
      case "in-progress":
        return {
          gradient: "bg-gradient-to-r from-blue-500 to-indigo-500",
          bgGradient: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20",
          borderColor: "border-blue-200 dark:border-blue-800",
          textColor: "text-blue-700 dark:text-blue-300",
          icon: "⚡",
          name: t('navigation.inProgressTickets', 'In Progress')
        };
      case "resolved":
        return {
          gradient: "bg-gradient-to-r from-green-500 to-emerald-500",
          bgGradient: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20",
          borderColor: "border-green-200 dark:border-green-800",
          textColor: "text-green-700 dark:text-green-300",
          icon: "✅",
          name: t('navigation.resolvedTickets', 'Resolved')
        };
      case "closed":
        return {
          gradient: "bg-gradient-to-r from-gray-500 to-slate-500",
          bgGradient: "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20",
          borderColor: "border-gray-200 dark:border-gray-800",
          textColor: "text-gray-700 dark:text-gray-300",
          icon: "🔒",
          name: t('navigation.closedTickets', 'Closed')
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
          name: t('navigation.myTickets', 'My Tickets')
        };
    }
  };

  const getPageTitle = () => {
    const theme = getStatusTheme();
    return theme.name;
  };

  const getTicketListProps = () => {
    const baseProps = {
      statusFilter: getStatusFilter(),
      userRole: userRole,
      userId: userProfile?.id,
      // Pass enhanced filtering options to TicketList
      useEnhancedFiltering: true,
      includeClosedTickets: userRole === "user" ? true : undefined,
    };

    switch (status) {
      case "in-progress":
        return { 
          ...baseProps, 
          showAll: userRole !== "user",
          assignedOnly: userRole === "agent" 
        };
      case "all":
        return {
          ...baseProps,
          showAll: userRole !== "user",
          unassignedOnly: userRole !== "user"
        };
      case "open":
      case "resolved":
      case "closed":
        return {
          ...baseProps,
          showAll: userRole !== "user",
          assignedOnly: userRole === "agent"
        };
      default:
        return { 
          ...baseProps, 
          showAll: userRole !== "user",
          assignedOnly: userRole === "agent" 
        };
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
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Enhanced Header with Gradient */}
      <div className={cn("rounded-xl p-4 md:p-6 border", theme.bgGradient, theme.borderColor)}>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={cn("p-1.5 md:p-2 rounded-lg text-white", theme.gradient)}>
                <span className="text-lg md:text-2xl">{theme.icon}</span>
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {getPageTitle()}
                </h1>
                <p className={cn("text-xs md:text-sm", theme.textColor)}>
                  {status === "open" && t('tickets.openTicketsDescription', 'Tickets waiting for assignment and initial response')}
                  {status === "in-progress" && t('tickets.inProgressDescription', 'Tickets currently being worked on by agents')}
                  {status === "resolved" && t('tickets.resolvedDescription', 'Tickets marked as resolved, awaiting closure')}
                  {status === "closed" && t('tickets.closedDescription', 'Completed tickets that have been closed')}
                  {status === "all" && "All unassigned tickets requiring attention"}
                  {!status && "Your personal tickets and requests"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingStats}
              variant="outline"
              size="default"
              className="shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <RefreshCw className={cn("h-4 w-4 md:h-5 md:w-5", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline ml-2">
                {isRefreshing ? t('tickets.refreshing') : t('common.refresh')}
              </span>
            </Button>
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
                className={cn("shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto", theme.gradient)}
                size="default"
              >
                <Plus className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                <span className="hidden sm:inline">{t('tickets.newTicket')}</span>
                <span className="sm:hidden">{t('tickets.newTicket')}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t('common.totalTickets')} {theme.name}
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
                {t('dashboard.createdToday', 'Created Today')}
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
                {t('dashboard.thisWeek', 'This Week')}
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
                {t('common.avgResolution')}
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
              <span>{t('tickets.advancedFilters')}</span>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showFilters ? t('common.hide', 'Hide') : t('common.show', 'Show')}
            </Badge>
          </CardTitle>
        </CardHeader>
        {showFilters && (
          <CardContent className={cn("border-t", theme.bgGradient)}>
            <AdvancedFilters onFiltersChange={handleFiltersChange} />
          </CardContent>
        )}
      </Card>
      
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('tickets.error')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-4"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
              {t('tickets.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

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