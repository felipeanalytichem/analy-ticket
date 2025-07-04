import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const StatsCards = () => {
  const { userProfile } = useAuth();
  const { refreshKey } = useTicketCount();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    total: 0
  });
  const [previousStats, setPreviousStats] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Store previous stats for trend calculation
      setPreviousStats(stats);
      
      let allTickets: TicketWithDetails[] = [];

      if (userProfile.role === 'admin') {
        allTickets = await DatabaseService.getTickets({
          userRole: 'admin',
          showAll: true
        });
      } else if (userProfile.role === 'agent') {
        allTickets = await DatabaseService.getTickets({
          userRole: 'agent',
          showAll: true
        });
      } else {
        const userTickets = await DatabaseService.getTickets({
          userRole: 'user',
          showAll: true
        });
        
        allTickets = userTickets.filter(ticket => 
          ticket.user_id === userProfile.id && 
          ticket.status !== 'closed' && 
          ticket.status !== 'resolved'
        );
      }
      
      const openTickets = allTickets.filter(ticket => ticket.status === 'open').length;
      const inProgressTickets = allTickets.filter(ticket => ticket.status === 'in_progress').length;
      const resolvedTickets = allTickets.filter(ticket => ticket.status === 'resolved').length;

      setStats({
        total: allTickets.length,
        open: openTickets,
        in_progress: inProgressTickets,
        resolved: resolvedTickets
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({
        total: 0,
        open: 0,
        in_progress: 0,
        resolved: 0
      });
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, userProfile?.role]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (current < previous) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return "text-green-600 dark:text-green-400";
    if (current < previous) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-gray-400";
  };

  const statItems = [
    {
      title: t('status.open'),
      value: stats.open.toString(),
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      borderColor: "border-orange-200 dark:border-orange-800",
      trend: getTrendIcon(stats.open, previousStats.open),
      trendColor: getTrendColor(stats.open, previousStats.open),
      change: stats.open - previousStats.open
    },
    {
      title: t('status.inProgress'),
      value: stats.in_progress.toString(),
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      trend: getTrendIcon(stats.in_progress, previousStats.in_progress),
      trendColor: getTrendColor(stats.in_progress, previousStats.in_progress),
      change: stats.in_progress - previousStats.in_progress
    },
    {
      title: t('status.resolved'),
      value: stats.resolved.toString(),
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-200 dark:border-green-800",
      trend: getTrendIcon(stats.resolved, previousStats.resolved),
      trendColor: getTrendColor(stats.resolved, previousStats.resolved),
      change: stats.resolved - previousStats.resolved
    },
    {
      title: t('common.totalTickets') || t('dashboard.totalTickets') || 'Total',
      value: stats.total.toString(),
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      borderColor: "border-purple-200 dark:border-purple-800",
      trend: getTrendIcon(stats.total, previousStats.total),
      trendColor: getTrendColor(stats.total, previousStats.total),
      change: stats.total - previousStats.total
    },
  ];

  if (loading) {
    return (
      <div className={cn(
        "grid gap-4",
        isMobile 
          ? "grid-cols-2" 
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className={cn(
              "pb-2",
              isMobile && "p-4 pb-2"
            )}>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </CardHeader>
            <CardContent className={cn(
              isMobile && "p-4 pt-0"
            )}>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-4",
      isMobile 
        ? "grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    )}>
      {statItems.map((stat, index) => {
        return (
          <Card key={index} className={cn(
            "relative overflow-hidden transition-all duration-200",
            "hover:shadow-lg hover:scale-[1.02]",
            "border-l-4",
            stat.borderColor,
            stat.bgColor,
            isMobile && [
              "active:scale-[0.98]",
              "touch-manipulation"
            ]
          )}>
            <CardHeader className={cn(
              "pb-2",
              isMobile && "p-4 pb-2"
            )}>
              <CardTitle className={cn(
                "text-sm font-medium",
                "text-gray-600 dark:text-gray-300",
                isMobile && "text-xs"
              )}>
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent className={cn(
              isMobile && "p-4 pt-0"
            )}>
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <div className={cn(
                    "font-bold",
                    stat.color,
                    isMobile ? "text-2xl" : "text-3xl"
                  )}>
                    {stat.value}
                  </div>
                  {previousStats.total > 0 && (
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      stat.trendColor,
                      isMobile && "text-xs"
                    )}>
                      {stat.trend}
                      <span className="text-xs">
                        {stat.change > 0 && '+'}
                        {stat.change}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  stat.bgColor,
                  "opacity-50",
                  isMobile && "w-8 h-8"
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-full",
                    stat.color.replace('text-', 'bg-'),
                    isMobile && "w-4 h-4"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
