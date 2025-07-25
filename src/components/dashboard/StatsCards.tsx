import { useState, useEffect, useCallback, useRef } from "react";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Target, Users, CheckCircle } from "lucide-react";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { KPICard, TrendDirection, KPIColor } from "./KPICard";

interface PerformanceMetrics {
  avgResolutionTime: number; // in hours
  slaCompliance: number; // percentage
  customerSatisfaction: number; // percentage
  firstContactResolution: number; // percentage
}

export const StatsCards = () => {
  const { userProfile } = useAuth();
  const { refreshKey } = useTicketCount();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    avgResolutionTime: 0,
    slaCompliance: 0,
    customerSatisfaction: 0,
    firstContactResolution: 0
  });
  
  const [previousMetrics, setPreviousMetrics] = useState<PerformanceMetrics>({
    avgResolutionTime: 0,
    slaCompliance: 0,
    customerSatisfaction: 0,
    firstContactResolution: 0
  });
  
  const [loading, setLoading] = useState(true);
  const isInitialLoadRef = useRef(true);

  const calculateAverageResolutionTime = (tickets: TicketWithDetails[]): number => {
    if (tickets.length === 0) return 0;
    
    const totalTime = tickets.reduce((sum, ticket) => {
      if (ticket.created_at && ticket.updated_at) {
        const created = new Date(ticket.created_at).getTime();
        const resolved = new Date(ticket.updated_at).getTime();
        return sum + (resolved - created);
      }
      return sum;
    }, 0);
    
    return totalTime / tickets.length / (1000 * 60 * 60); // Convert to hours
  };

  const calculateSLACompliance = (tickets: TicketWithDetails[]): number => {
    if (tickets.length === 0) return 0;
    
    const slaTarget = 24; // 24 hours SLA target
    const compliantTickets = tickets.filter(ticket => {
      if (ticket.created_at && ticket.updated_at) {
        const created = new Date(ticket.created_at).getTime();
        const resolved = new Date(ticket.updated_at).getTime();
        const resolutionTime = (resolved - created) / (1000 * 60 * 60); // hours
        return resolutionTime <= slaTarget;
      }
      return false;
    });
    
    return Math.round((compliantTickets.length / tickets.length) * 100);
  };

  const calculateCustomerSatisfaction = (tickets: TicketWithDetails[]): number => {
    // Mock calculation - in real app would use actual feedback data
    // Using ticket count as seed for consistent results
    const seed = tickets.length || 1;
    return Math.round(85 + (seed % 10)); // 85-95% based on ticket count
  };

  const calculateFirstContactResolution = (tickets: TicketWithDetails[]): number => {
    if (tickets.length === 0) return 0;
    // Mock calculation - would track actual first contact resolutions
    // Using ticket count as seed for consistent results
    const seed = tickets.length || 1;
    return Math.round(65 + (seed % 15)); // 65-80% based on ticket count
  };

  const getTrend = (current: number, previous: number): TrendDirection => {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  const getInvertedTrend = (current: number, previous: number): TrendDirection => {
    if (current < previous) return 'up'; // Lower is better, so decrease is good
    if (current > previous) return 'down'; // Higher is worse, so increase is bad
    return 'neutral';
  };

  const loadPerformanceMetrics = useCallback(async () => {
    if (!userProfile?.id) {
      setLoading(false);
      isInitialLoadRef.current = false;
      return;
    }

    try {
      // Only show loading skeleton on initial load
      if (isInitialLoadRef.current) {
        setLoading(true);
      }
      
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
      
      const resolvedTickets = allTickets.filter(ticket => 
        ticket.status === 'resolved' || ticket.status === 'closed'
      );

      const avgResolutionTime = calculateAverageResolutionTime(resolvedTickets);
      const slaCompliance = calculateSLACompliance(resolvedTickets);
      const customerSatisfaction = calculateCustomerSatisfaction(resolvedTickets);
      const firstContactResolution = calculateFirstContactResolution(resolvedTickets);

      const newMetrics = {
        avgResolutionTime,
        slaCompliance,
        customerSatisfaction,
        firstContactResolution
      };

      // Store previous metrics for trend calculation before updating
      setPerformanceMetrics(current => {
        setPreviousMetrics(current);
        return newMetrics;
      });
    } catch (error) {
      console.error('Error loading performance metrics:', error);
      setPerformanceMetrics(current => {
        setPreviousMetrics(current);
        return {
          avgResolutionTime: 0,
          slaCompliance: 0,
          customerSatisfaction: 0,
          firstContactResolution: 0
        };
      });
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, [userProfile?.id, userProfile?.role]);

  useEffect(() => {
    loadPerformanceMetrics();
  }, [loadPerformanceMetrics, refreshKey]);

  // Define performance targets
  const targets = {
    avgResolutionTime: 24, // 24 hours target
    slaCompliance: 90, // 90% target
    customerSatisfaction: 90, // 90% target
    firstContactResolution: 75 // 75% target
  };

  // Define KPI cards with performance-based color coding
  const getPerformanceColor = (value: number, target: number, isLowerBetter = false): KPIColor => {
    if (value === 0) return 'red'; // Handle zero values
    
    const ratio = isLowerBetter ? target / value : value / target;
    if (ratio >= 1) return 'green';
    if (ratio >= 0.8) return 'yellow';
    return 'red';
  };

  const kpiCards = [
    {
      title: t('dashboard.avgResolutionTime') || 'Avg Resolution Time',
      value: performanceMetrics.avgResolutionTime,
      target: targets.avgResolutionTime,
      trend: getInvertedTrend(performanceMetrics.avgResolutionTime, previousMetrics.avgResolutionTime), // Lower is better
      color: getPerformanceColor(performanceMetrics.avgResolutionTime, targets.avgResolutionTime, true),
      icon: Clock,
      format: 'time' as const
    },
    {
      title: t('dashboard.slaCompliance') || 'SLA Compliance',
      value: performanceMetrics.slaCompliance,
      target: targets.slaCompliance,
      trend: getTrend(performanceMetrics.slaCompliance, previousMetrics.slaCompliance),
      color: getPerformanceColor(performanceMetrics.slaCompliance, targets.slaCompliance),
      icon: Target,
      format: 'percentage' as const
    },
    {
      title: t('dashboard.customerSatisfaction') || 'Customer Satisfaction',
      value: performanceMetrics.customerSatisfaction,
      target: targets.customerSatisfaction,
      trend: getTrend(performanceMetrics.customerSatisfaction, previousMetrics.customerSatisfaction),
      color: getPerformanceColor(performanceMetrics.customerSatisfaction, targets.customerSatisfaction),
      icon: Users,
      format: 'percentage' as const
    },
    {
      title: t('dashboard.firstContactResolution') || 'First Contact Resolution',
      value: performanceMetrics.firstContactResolution,
      target: targets.firstContactResolution,
      trend: getTrend(performanceMetrics.firstContactResolution, previousMetrics.firstContactResolution),
      color: getPerformanceColor(performanceMetrics.firstContactResolution, targets.firstContactResolution),
      icon: CheckCircle,
      format: 'percentage' as const
    }
  ];

  return (
    <div className={cn(
      "grid gap-4",
      isMobile 
        ? "grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    )}>
      {kpiCards.map((kpi, index) => (
        <KPICard
          key={index}
          title={kpi.title}
          value={kpi.value}
          target={kpi.target}
          trend={kpi.trend}
          color={kpi.color}
          icon={kpi.icon}
          format={kpi.format}
          loading={loading}
        />
      ))}
    </div>
  );
};
