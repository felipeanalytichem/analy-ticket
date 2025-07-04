import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  TrendingUp, 
  Timer,
  Calendar,
  Target
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

export const AdvancedStatsCards = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalTickets: 0,
    avgResponseTime: "0h",
    slaCompliance: 0,
    activeAgents: 0,
    resolvedToday: 0,
    criticalPending: 0,
    monthlyGrowth: 0,
    responseTimeImprovement: 0
  });
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    const loadAdvancedStats = async () => {
      try {
        setLoading(true);
        
        // Get all tickets and users
        const [allTickets, allUsers] = await Promise.all([
          DatabaseService.getTickets({ showAll: true }),
          DatabaseService.getUsers()
        ]);

        // Calculate stats
        const totalTickets = allTickets.length;
        
        // Active agents (users with agent or admin role)
        const activeAgents = allUsers.filter(user => 
          user.role === 'agent' || user.role === 'admin'
        ).length;

        // Resolved today
        const today = new Date().toISOString().split('T')[0];
        const resolvedToday = allTickets.filter(ticket => 
          ticket.status === 'resolved' && 
          ticket.updated_at && 
          ticket.updated_at.startsWith(today)
        ).length;

        // Critical pending
        const criticalPending = allTickets.filter(ticket => 
          ticket.priority === 'urgent' && 
          (ticket.status === 'open' || ticket.status === 'in_progress')
        ).length;

        // Calculate average response time (simplified - using creation to update time)
        const ticketsWithResponse = allTickets.filter(ticket => 
          ticket.created_at && ticket.updated_at && ticket.created_at !== ticket.updated_at
        );
        
        let avgResponseHours = 0;
        if (ticketsWithResponse.length > 0) {
          const totalResponseTime = ticketsWithResponse.reduce((sum, ticket) => {
            const created = new Date(ticket.created_at!);
            const updated = new Date(ticket.updated_at!);
            return sum + (updated.getTime() - created.getTime());
          }, 0);
          avgResponseHours = totalResponseTime / (ticketsWithResponse.length * 1000 * 60 * 60);
        }

        const avgResponseTime = avgResponseHours < 1 
          ? `${Math.round(avgResponseHours * 60)}min`
          : `${Math.round(avgResponseHours)}h`;

        // SLA compliance (simplified - tickets resolved within 24h)
        const resolvedTickets = allTickets.filter(ticket => ticket.status === 'resolved');
        const slaCompliantTickets = resolvedTickets.filter(ticket => {
          if (!ticket.created_at || !ticket.updated_at) return false;
          const created = new Date(ticket.created_at);
          const resolved = new Date(ticket.updated_at);
          const hoursDiff = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
          return hoursDiff <= 24; // 24h SLA
        });
        
        const slaCompliance = resolvedTickets.length > 0 
          ? Math.round((slaCompliantTickets.length / resolvedTickets.length) * 100)
          : 0;

        // Monthly growth (simplified - compare with last month)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const currentMonthTickets = allTickets.filter(ticket => {
          if (!ticket.created_at) return false;
          const created = new Date(ticket.created_at);
          return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
        }).length;

        const lastMonthTickets = allTickets.filter(ticket => {
          if (!ticket.created_at) return false;
          const created = new Date(ticket.created_at);
          return created.getMonth() === lastMonth && created.getFullYear() === lastMonthYear;
        }).length;

        const monthlyGrowth = lastMonthTickets > 0 
          ? Math.round(((currentMonthTickets - lastMonthTickets) / lastMonthTickets) * 100)
          : 0;

        setStats({
          totalTickets,
          avgResponseTime,
          slaCompliance,
          activeAgents,
          resolvedToday,
          criticalPending,
          monthlyGrowth,
          responseTimeImprovement: avgResponseHours < 4 ? 15 : -5 // Simplified calculation
        });

      } catch (error) {
        console.error('Error loading advanced stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile) {
      loadAdvancedStats();
    }
  }, [userProfile]);

  const statItems = [
    {
      title: t('dashboard.totalTickets'),
      value: stats.totalTickets.toString(),
      change: `${stats.monthlyGrowth > 0 ? '+' : ''}${stats.monthlyGrowth}% ${t('dashboard.thisMonth', 'this month')}`,
      percentage: `${stats.monthlyGrowth > 0 ? '+' : ''}${stats.monthlyGrowth}%`,
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      trend: stats.monthlyGrowth > 0 ? "up" : stats.monthlyGrowth < 0 ? "down" : "stable"
    },
    {
      title: t('dashboard.avgResponseTime'),
      value: stats.avgResponseTime,
      change: `${t('dashboard.goal')}: 4h`,
      percentage: `${stats.responseTimeImprovement > 0 ? '+' : ''}${stats.responseTimeImprovement}%`,
      icon: Timer,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
      trend: stats.responseTimeImprovement > 0 ? "up" : "down"
    },
    {
      title: t('dashboard.slaCompliance'),
      value: `${stats.slaCompliance}%`,
      change: `${t('dashboard.goal')}: 90%`,
      percentage: stats.slaCompliance >= 90 ? "+0%" : `${stats.slaCompliance - 90}%`,
      icon: Target,
      color: stats.slaCompliance >= 90 ? "text-green-600" : "text-orange-600",
      bgColor: stats.slaCompliance >= 90 ? "bg-green-100 dark:bg-green-900/20" : "bg-orange-100 dark:bg-orange-900/20",
      trend: stats.slaCompliance >= 90 ? "up" : "down"
    },
    {
      title: t('dashboard.activeAgents'),
      value: stats.activeAgents.toString(),
      change: t('dashboard.available'),
      percentage: "+0%",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      trend: "stable"
    },
    {
      title: t('dashboard.resolvedToday'),
      value: stats.resolvedToday.toString(),
      change: `${t('dashboard.dailyGoal')}: 20`,
      percentage: stats.resolvedToday >= 20 ? "+15%" : "-5%",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
      trend: stats.resolvedToday >= 20 ? "up" : "down"
    },
    {
      title: t('dashboard.criticalPending'),
      value: stats.criticalPending.toString(),
      change: stats.criticalPending > 0 ? t('dashboard.urgentAttention') : t('dashboard.allGood'),
      percentage: stats.criticalPending > 0 ? "+50%" : "0%",
      icon: AlertCircle,
      color: stats.criticalPending > 0 ? "text-red-600" : "text-green-600",
      bgColor: stats.criticalPending > 0 ? "bg-red-100 dark:bg-red-900/20" : "bg-green-100 dark:bg-green-900/20",
      trend: stats.criticalPending > 0 ? "down" : "up"
    }
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case "down":
        return <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />;
      default:
        return <div className="h-3 w-3 bg-gray-400 dark:bg-gray-600 rounded-full" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
              <div className="flex items-center justify-between">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {statItems.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.change}</p>
                <div className="flex items-center gap-1">
                  {getTrendIcon(stat.trend)}
                  <span className={`text-xs font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 
                    stat.trend === 'down' ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {stat.percentage}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
