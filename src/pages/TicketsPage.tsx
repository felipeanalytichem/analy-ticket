import { useState, useEffect, useMemo } from "react";
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
import { TicketWithDetails } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { useTickets } from "@/hooks/useTickets";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
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

  // Use React Query for tickets data
  const {
    tickets,
    isLoading: isLoadingStats,
    isError,
    error,
    refetch,
    isRefetching,
    handleStuckLoading
  } = useTickets({
    statusFilter: getStatusFilter(),
    showAll: userRole !== "user",
    includeClosedTickets: userRole === "user"
  });

  // Setup loading timeout protection
  useLoadingTimeout(isLoadingStats, 25000); // 25 second timeout

  // Calculate statistics from React Query tickets data
  // Calculate statistics from tickets data - memoized to prevent infinite loops
  const statistics = useMemo(() => {
    if (!tickets || tickets.length === 0) {
      return { total: 0, todayCount: 0, weekCount: 0, avgResolutionTime: 0 };
    }

    console.log('🔍 Calculating statistics for', tickets.length, 'tickets');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // Filter tickets based on current status
    let relevantTickets = tickets;
    switch (status) {
      case "open":
        relevantTickets = tickets.filter(t => t.status === 'open');
        break;
      case "in-progress":
        relevantTickets = tickets.filter(t => t.status === 'in_progress');
        break;
      case "resolved":
        relevantTickets = tickets.filter(t => t.status === 'resolved');
        break;
      case "closed":
        relevantTickets = tickets.filter(t => t.status === 'closed');
        break;
      case "all":
        relevantTickets = tickets;
        break;
      default:
        relevantTickets = tickets.filter(t => t.user_id === userProfile?.id);
    }
    
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
    
    return {
      total: relevantTickets.length,
      todayCount,
      weekCount,
      avgResolutionTime
    };
  }, [tickets, status, userProfile?.id]);

  // Show error toast for React Query errors
  useEffect(() => {
    if (isError && error) {
      console.error('❌ Tickets loading error:', error);
      toast({
        title: t('tickets.errorLoadingTickets', 'Error loading tickets'),
        description: error?.message || t('tickets.genericError', 'An error occurred while loading tickets'),
        variant: "destructive",
      });
    }
  }, [isError, error, toast, t]);

  const handleFiltersChange = (newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  };

  const handleTicketCreated = () => {
    setTicketListKey(prev => prev + 1);
    triggerRefresh();
  };

  const handleRefresh = () => {
    console.log('🔄 Refreshing tickets...');
    refetch();
  };

  const getStatusTheme = () => {
    switch (status) {
      case "open":
        return {
          gradient: "bg-gradient-to-r from-blue-500 to-cyan-500",
          bgGradient: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20",
          borderColor: "border-blue-200 dark:border-blue-800",
          textColor: "text-blue-700 dark:text-blue-300",
          icon: "🆕",
          name: t('navigation.openTickets', 'Open Tickets')
        };
      case "in-progress":
        return {
          gradient: "bg-gradient-to-r from-amber-500 to-orange-500",
          bgGradient: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
          borderColor: "border-amber-200 dark:border-amber-800",
          textColor: "text-amber-700 dark:text-amber-300",
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
      useEnhancedFiltering: true,
      includeClosedTickets: userRole === "user" ? true : undefined,
    };

    switch (status) {
      case "in-progress":
        return { 
          ...baseProps, 
          showAll: userRole !== "user",
        };
      case "resolved":
        return { 
          ...baseProps,
          showAll: userRole !== "user",
        };
      case "closed":
        return { 
          ...baseProps,
          showAll: userRole !== "user",
        };
      case "all":
        return { 
          ...baseProps,
          showAll: userRole !== "user",
        };
      default:
        return baseProps;
    }
  };

  const theme = getStatusTheme();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className={cn("border-0 shadow-lg", theme.bgGradient, theme.borderColor)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={cn("p-3 rounded-lg", theme.gradient)}>
                <span className="text-2xl text-white">{theme.icon}</span>
              </div>
              <div>
                <CardTitle className={cn("text-2xl", theme.textColor)}>
                  {getPageTitle()}
                </CardTitle>
                <p className="text-muted-foreground">
                  {t('tickets.manageYourTicketsEfficiently', 'Manage your tickets efficiently')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>{t('tickets.filters', 'Filters')}</span>
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isLoadingStats || isRefetching}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", (isLoadingStats || isRefetching) && "animate-spin")} />
                {(isLoadingStats || isRefetching) ? t('common.loading', 'Loading...') : t('common.refresh', 'Refresh')}
              </Button>
              {/* Emergency force refresh for stuck loading */}
              {(isLoadingStats && !isRefetching) && (
                <Button 
                  onClick={handleStuckLoading} 
                  variant="destructive" 
                  size="sm"
                >
                  Force Refresh
                </Button>
              )}
              {userRole !== 'user' && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('tickets.createNew', 'Create New')}</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Statistics */}
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <BarChart3 className={cn("h-5 w-5 mr-2", theme.textColor)} />
                <span className="text-sm font-medium text-muted-foreground">
                  {t('tickets.total', 'Total')}
                </span>
              </div>
              <div className={cn("text-2xl font-bold", theme.textColor)}>
                {isLoadingStats ? "..." : statistics.total}
              </div>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Calendar className={cn("h-5 w-5 mr-2", theme.textColor)} />
                <span className="text-sm font-medium text-muted-foreground">
                  {t('tickets.today', 'Today')}
                </span>
              </div>
              <div className={cn("text-2xl font-bold", theme.textColor)}>
                {isLoadingStats ? "..." : statistics.todayCount}
              </div>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className={cn("h-5 w-5 mr-2", theme.textColor)} />
                <span className="text-sm font-medium text-muted-foreground">
                  {t('tickets.thisWeek', 'This Week')}
                </span>
              </div>
              <div className={cn("text-2xl font-bold", theme.textColor)}>
                {isLoadingStats ? "..." : statistics.weekCount}
              </div>
            </div>
            
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className={cn("h-5 w-5 mr-2", theme.textColor)} />
                <span className="text-sm font-medium text-muted-foreground">
                  {t('tickets.avgResolution', 'Avg Resolution')}
                </span>
              </div>
              <div className={cn("text-2xl font-bold", theme.textColor)}>
                {isLoadingStats ? "..." : `${Math.round(statistics.avgResolutionTime)}h`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <AdvancedFilters onFiltersChange={handleFiltersChange} />
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {isError && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('tickets.error')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error?.message || t('tickets.genericError', 'An error occurred while loading tickets')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingStats || isRefetching}
              className="ml-4"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", (isLoadingStats || isRefetching) && "animate-spin")} />
              {t('common.retry', 'Retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Ticket List */}
      <Card>
        <CardContent className="p-0">
          <TicketList
            key={ticketListKey}
            {...getTicketListProps()}
            filters={filters}
          />
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <TicketDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleTicketCreated}
      />
    </div>
  );
};

export default TicketsPage;
