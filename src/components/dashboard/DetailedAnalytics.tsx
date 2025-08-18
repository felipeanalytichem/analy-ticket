import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, 
  ResponsiveContainer, AreaChart, Area, RadialBarChart, RadialBar,
  CartesianGrid, Legend, ScatterChart, Scatter
} from "recharts";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Activity,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Zap,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DatabaseService from '@/lib/database';
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PerformanceMetrics {
  avgResolutionTime: number;
  avgResponseTime: number;
  slaCompliance: number;
  firstContactResolution: number;
  customerSatisfaction: number;
  reopenRate: number;
  agentProductivity: number;
  ticketBacklog: number;
}

interface AgentPerformance {
  name: string;
  id: string;
  assigned: number;
  resolved: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  productivity: number;
}

interface CategoryInsights {
  name: string;
  count: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  trendPercentage: number;
}

interface TimeseriesData {
  date: string;
  created: number;
  resolved: number;
  inProgress: number;
  backlog: number;
  avgResolutionTime: number;
}

// Skeleton loading components with progressive loading animations
const HeaderSkeleton = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex items-center justify-between animate-in fade-in duration-300">
      <div>
        <Skeleton className={cn("mb-2", isMobile ? "h-8 w-48" : "h-10 w-64")} />
        <Skeleton className={cn(isMobile ? "h-4 w-32" : "h-5 w-40")} />
      </div>
      <Skeleton className="h-8 w-24" />
    </div>
  );
};

const KPIMetricsSkeleton = () => {
  const isMobile = useIsMobile();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center space-y-2">
              <Skeleton className={cn("mx-auto", isMobile ? "h-6 w-16" : "h-8 w-20")} />
              <Skeleton className={cn("mx-auto", isMobile ? "h-3 w-24" : "h-4 w-32")} />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ChartsSkeleton = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} className="animate-pulse">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const AgentPerformanceSkeleton = () => {
  const isMobile = useIsMobile();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse border-l-4 border-l-gray-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Skeleton className="h-3 w-16 mx-auto mb-1" />
                    <Skeleton className="h-6 w-8 mx-auto" />
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Skeleton className="h-3 w-16 mx-auto mb-1" />
                    <Skeleton className="h-6 w-8 mx-auto" />
                  </div>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CategoryInsightsSkeleton = () => {
  const isMobile = useIsMobile();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse border-l-4 border-l-gray-300">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-24 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Skeleton className="h-3 w-16 mx-auto mb-1" />
                    <Skeleton className="h-4 w-10 mx-auto" />
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Skeleton className="h-3 w-16 mx-auto mb-1" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
                
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function DetailedAnalytics() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // State for different analytics data
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    avgResolutionTime: 0,
    avgResponseTime: 0,
    slaCompliance: 0,
    firstContactResolution: 0,
    customerSatisfaction: 0,
    reopenRate: 0,
    agentProductivity: 0,
    ticketBacklog: 0
  });
  
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [categoryInsights, setCategoryInsights] = useState<CategoryInsights[]>([]);
  const [timeseriesData, setTimeseriesData] = useState<TimeseriesData[]>([]);
  const [priorityDistribution, setPriorityDistribution] = useState<any[]>([]);
  const [resolutionTrends, setResolutionTrends] = useState<any[]>([]);
  
  // Dialog state for agent tickets
  const [selectedAgent, setSelectedAgent] = useState<AgentPerformance | null>(null);
  const [agentTickets, setAgentTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [allTicketsData, setAllTicketsData] = useState<any[]>([]);
  
  useEffect(() => {
    const loadDetailedAnalytics = async () => {
      try {
        setLoading(true);
        
        const [allTickets, allUsers, categories] = await Promise.all([
          DatabaseService.getTickets({ showAll: true }),
          DatabaseService.getUsers(),
          DatabaseService.getCategories()
        ]);

        console.log('📊 Loading detailed analytics...', {
          totalTickets: allTickets.length,
          totalUsers: allUsers.length,
          totalCategories: categories.length
        });

        // Calculate Performance Metrics
        const resolvedTickets = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
        const openTickets = allTickets.filter(t => t.status === 'open' || t.status === 'in_progress');
        
        // Average resolution time (in hours)
        const avgResolutionTime = calculateAverageResolutionTime(resolvedTickets);
        
        // Average response time (time to first agent response)
        const avgResponseTime = calculateAverageResponseTime(allTickets);
        
        // SLA Compliance (tickets resolved within target time)
        const slaCompliance = calculateSLACompliance(resolvedTickets);
        
        // First Contact Resolution Rate
        const firstContactResolution = calculateFirstContactResolution(resolvedTickets);
        
        // Customer Satisfaction (mock data - would come from feedback)
        const customerSatisfaction = calculateCustomerSatisfaction(resolvedTickets);
        
        // Reopen Rate
        const reopenRate = calculateReopenRate(allTickets);
        
        // Agent Productivity
        const agentProductivity = calculateAgentProductivity(allTickets, allUsers);
        
        // Ticket Backlog
        const ticketBacklog = openTickets.length;

        setPerformanceMetrics({
          avgResolutionTime,
          avgResponseTime,
          slaCompliance,
          firstContactResolution,
          customerSatisfaction,
          reopenRate,
          agentProductivity,
          ticketBacklog
        });

        // Agent Performance Analysis
        const agents = allUsers.filter(u => u.role === 'agent' || u.role === 'admin');
        const agentStats = agents.map(agent => {
          const agentTickets = allTickets.filter(t => t.assigned_to === agent.id);
          const resolvedByAgent = agentTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
          
          return {
            name: agent.name,
            id: agent.id,
            assigned: agentTickets.length,
            resolved: resolvedByAgent.length,
            avgResolutionTime: calculateAverageResolutionTime(resolvedByAgent),
            satisfactionScore: 4.2 + Math.random() * 0.6, // Mock satisfaction
            productivity: resolvedByAgent.length > 0 ? (resolvedByAgent.length / agentTickets.length) * 100 : 0
          };
        }).sort((a, b) => b.productivity - a.productivity);

        setAgentPerformance(agentStats);
        
        // Store all tickets data for dialog use
        setAllTicketsData(allTickets);

        // Category Insights
        const categoryStats = categories.map(category => {
          const categoryTickets = allTickets.filter(t => t.category_id === category.id);
          const resolvedCategoryTickets = categoryTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
          
          return {
            name: category.name,
            count: categoryTickets.length,
            avgResolutionTime: calculateAverageResolutionTime(resolvedCategoryTickets),
            satisfactionScore: 4.0 + Math.random() * 0.8,
            trendPercentage: Math.floor(Math.random() * 40) - 20 // -20% to +20%
          };
        }).filter(cat => cat.count > 0).sort((a, b) => b.count - a.count);

        setCategoryInsights(categoryStats);

        // Time Series Data (last 30 days)
        const timeSeriesStats = generateTimeSeriesData(allTickets, 30);
        setTimeseriesData(timeSeriesStats);

        // Priority Distribution
        const priorityStats = [
          { name: 'Low', value: allTickets.filter(t => t.priority === 'low').length, color: '#10b981' },
          { name: 'Medium', value: allTickets.filter(t => t.priority === 'medium').length, color: '#f59e0b' },
          { name: 'High', value: allTickets.filter(t => t.priority === 'high').length, color: '#ef4444' },
          { name: 'Urgent', value: allTickets.filter(t => t.priority === 'urgent').length, color: '#dc2626' }
        ].filter(p => p.value > 0);

        setPriorityDistribution(priorityStats);

        // Resolution Trends (last 12 weeks)
        const resolutionTrendStats = generateResolutionTrends(allTickets, 12);
        setResolutionTrends(resolutionTrendStats);

      } catch (error) {
        console.error('❌ Error loading detailed analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile && (userProfile.role === 'agent' || userProfile.role === 'admin')) {
      loadDetailedAnalytics();
    }
  }, [userProfile]);

  // Helper functions for calculations
  const calculateAverageResolutionTime = (tickets: any[]) => {
    if (tickets.length === 0) return 0;
    
    const totalTime = tickets.reduce((sum, ticket) => {
      if (ticket.created_at && ticket.updated_at) {
        const created = new Date(ticket.created_at);
        const resolved = new Date(ticket.updated_at);
        return sum + (resolved.getTime() - created.getTime());
      }
      return sum;
    }, 0);
    
    return Math.round(totalTime / (tickets.length * 1000 * 60 * 60)); // Hours
  };

  const calculateAverageResponseTime = (tickets: any[]) => {
    // Simplified: time from creation to first update
    const ticketsWithResponse = tickets.filter(t => 
      t.created_at && t.updated_at && t.created_at !== t.updated_at
    );
    
    if (ticketsWithResponse.length === 0) return 0;
    
    const totalTime = ticketsWithResponse.reduce((sum, ticket) => {
      const created = new Date(ticket.created_at);
      const firstResponse = new Date(ticket.updated_at);
      return sum + (firstResponse.getTime() - created.getTime());
    }, 0);
    
    return Math.round(totalTime / (ticketsWithResponse.length * 1000 * 60 * 60)); // Hours
  };

  const calculateSLACompliance = (resolvedTickets: any[]) => {
    if (resolvedTickets.length === 0) return 0;
    
    const slaCompliantTickets = resolvedTickets.filter(ticket => {
      if (!ticket.created_at || !ticket.updated_at) return false;
      const created = new Date(ticket.created_at);
      const resolved = new Date(ticket.updated_at);
      const hoursDiff = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
      
      // SLA targets based on priority
      let slaTarget = 48; // Default 48 hours
      if (ticket.priority === 'urgent') slaTarget = 4;
      else if (ticket.priority === 'high') slaTarget = 12;
      else if (ticket.priority === 'medium') slaTarget = 24;
      
      return hoursDiff <= slaTarget;
    });
    
    return Math.round((slaCompliantTickets.length / resolvedTickets.length) * 100);
  };

  const calculateFirstContactResolution = (resolvedTickets: any[]) => {
    // Mock calculation - would need comment data to determine actual FCR
    return Math.round(65 + Math.random() * 15); // 65-80%
  };

  const calculateCustomerSatisfaction = (resolvedTickets: any[]) => {
    // Mock calculation - would use actual feedback data
    return Math.round(85 + Math.random() * 10); // 85-95%
  };

  const calculateReopenRate = (allTickets: any[]) => {
    // Mock calculation - would need reopen history
    return Math.round(3 + Math.random() * 5); // 3-8%
  };

  const calculateAgentProductivity = (allTickets: any[], allUsers: any[]) => {
    const agents = allUsers.filter(u => u.role === 'agent' || u.role === 'admin');
    if (agents.length === 0) return 0;
    
    const totalResolved = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    return Math.round(totalResolved / agents.length);
  };

  const generateTimeSeriesData = (tickets: any[], days: number) => {
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const dayStr = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
      
      const created = tickets.filter(t => 
        t.created_at && t.created_at.startsWith(dateStr)
      ).length;
      
      const resolved = tickets.filter(t => 
        t.updated_at && t.updated_at.startsWith(dateStr) && 
        (t.status === 'resolved' || t.status === 'closed')
      ).length;
      
      const inProgress = tickets.filter(t => 
        t.updated_at && t.updated_at.startsWith(dateStr) && 
        t.status === 'in_progress'
      ).length;
      
      return {
        date: dayStr,
        created,
        resolved,
        inProgress,
        backlog: Math.max(0, created - resolved),
        avgResolutionTime: 12 + Math.random() * 24 // Mock data
      };
    });
  };

  const generateResolutionTrends = (tickets: any[], weeks: number) => {
    return Array.from({ length: weeks }, (_, i) => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - (weeks - 1 - i) * 7);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      
      const weekTickets = tickets.filter(t => {
        if (!t.created_at) return false;
        const created = new Date(t.created_at);
        return created >= startDate && created <= endDate;
      });
      
      const resolvedInWeek = weekTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
      
      return {
        week: `W${weeks - i}`,
        tickets: weekTickets.length,
        resolved: resolvedInWeek.length,
        resolutionRate: weekTickets.length > 0 ? (resolvedInWeek.length / weekTickets.length) * 100 : 0
      };
    });
  };

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const getPerformanceColor = (value: number, good: number, excellent: number) => {
    if (value >= excellent) return "text-green-600";
    if (value >= good) return "text-yellow-600";
    return "text-red-600";
  };

  // Handle agent card click to show open tickets
  const handleAgentClick = async (agent: AgentPerformance) => {
    setSelectedAgent(agent);
    setTicketsLoading(true);
    
    try {
      // Filter open and in-progress tickets for this agent
      const openTickets = allTicketsData.filter(ticket => 
        ticket.assigned_to === agent.id && 
        (ticket.status === 'open' || ticket.status === 'in_progress')
      );
      
      // Get categories and subcategories to match with tickets
      const [categories, subcategories] = await Promise.all([
        DatabaseService.getCategories(),
        DatabaseService.getSubcategories()
      ]);
      
      // Enrich tickets with category and subcategory information
      const enrichedTickets = openTickets.map(ticket => ({
        ...ticket,
        category: categories.find(cat => cat.id === ticket.category_id),
        subcategory: subcategories.find(sub => sub.id === ticket.subcategory_id)
      }));
      
      setAgentTickets(enrichedTickets);
    } catch (error) {
      console.error('Error loading agent tickets:', error);
      setAgentTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const chartConfig = {
    created: { label: t('tickets.created', 'Created'), color: "#3b82f6" },
    resolved: { label: t('status.resolved'), color: "#10b981" },
    inProgress: { label: t('status.inProgress'), color: "#f59e0b" },
    backlog: { label: t('dashboard.backlog', 'Backlog'), color: "#ef4444" },
    tickets: { label: t('common.tickets', 'Tickets'), color: "#6366f1" },
    productivity: { label: t('dashboard.productivity', 'Productivity'), color: "#8b5cf6" }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <HeaderSkeleton />
        
        {/* KPI Metrics Skeleton */}
        <KPIMetricsSkeleton />
        
        {/* Charts Skeleton */}
        <ChartsSkeleton />
        
        {/* Agent Performance Skeleton */}
        <AgentPerformanceSkeleton />
        
        {/* Category Insights Skeleton */}
        <CategoryInsightsSkeleton />
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-6",
      // Mobile-first responsive spacing
      isMobile ? "space-y-4" : "space-y-6"
    )}>
      {/* Header - Mobile-first responsive design with accessibility improvements */}
      <header 
        className={cn(
          "flex items-center justify-between",
          // Stack on mobile for better readability
          isMobile && "flex-col items-start gap-3"
        )}
        role="banner"
        aria-labelledby="analytics-title"
      >
        <div className={cn(
          isMobile && "w-full"
        )}>
          <h1 
            id="analytics-title"
            className={cn(
              "font-bold text-gray-900 dark:text-white",
              // Responsive typography
              isMobile ? "text-2xl" : "text-3xl"
            )}
          >
            {t('dashboard.detailedAnalyticsTitle')}
          </h1>
          <p 
            className={cn(
              "text-gray-600 dark:text-gray-400 mt-1",
              // Responsive text size
              isMobile ? "text-sm" : "text-base"
            )}
            id="analytics-description"
            aria-describedby="analytics-title"
          >
            {t('dashboard.detailedAnalyticsSubtitle')}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "px-3 py-1",
            // Full width on mobile for better touch targets
            isMobile && "w-full justify-center"
          )}
          role="status"
          aria-label="Data status: Real-time updates active"
        >
          <Activity 
            className="h-4 w-4 mr-1" 
            aria-hidden="true"
          />
          {t('dashboard.realTimeData')}
        </Badge>
      </header>



      {/* Key Metrics Summary - Mobile-first responsive design with accessibility improvements */}
      <section 
        aria-labelledby="kpi-title"
        role="region"
      >
        <Card className={cn(
          // Touch-friendly interactions on mobile
          isMobile && "active:scale-[0.98] transition-transform duration-150"
        )}>
          <CardHeader className={cn(
            // Responsive padding
            isMobile && "p-4 pb-3"
          )}>
            <CardTitle 
              id="kpi-title"
              className={cn(
                "flex items-center gap-2",
                // Responsive icon and text size
                isMobile && "text-lg"
              )}
            >
              <Activity 
                className={cn(
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )}
                aria-hidden="true"
              />
              {t('dashboard.keyPerformanceIndicators')}
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(
            // Responsive padding
            isMobile && "p-4 pt-0"
          )}>
            <div 
              className={cn(
                "grid gap-6",
                // Mobile-first grid: 2 cols on mobile, 2 on tablet, 4 on desktop
                isMobile 
                  ? "grid-cols-2 gap-4" 
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
              )}
              role="list"
              aria-label="Key performance metrics"
            >
              <div 
                className="text-center"
                role="listitem"
                tabIndex={0}
                aria-label={`First Contact Resolution: ${performanceMetrics.firstContactResolution} percent. This metric shows the percentage of tickets resolved on first contact.`}
              >
                <div className={cn(
                  "font-bold text-blue-600 mb-1",
                  // Responsive text size
                  isMobile ? "text-xl" : "text-2xl"
                )}
                aria-hidden="true"
                >
                  {performanceMetrics.firstContactResolution}%
                </div>
                <div className={cn(
                  "text-gray-600 dark:text-gray-400",
                  // Responsive text size and line height
                  isMobile ? "text-xs leading-tight" : "text-sm"
                )}
                aria-hidden="true"
                >
                  First Contact Resolution
                </div>
                <Progress 
                  value={performanceMetrics.firstContactResolution} 
                  className={cn(
                    "mt-2",
                    // Responsive progress bar height
                    isMobile && "h-1.5"
                  )}
                  aria-label={`Progress: ${performanceMetrics.firstContactResolution}% of target`}
                />
              </div>
              
              <div 
                className="text-center"
                role="listitem"
                tabIndex={0}
                aria-label={`Average Response Time: ${formatTime(performanceMetrics.avgResponseTime)}. This shows how quickly agents respond to new tickets.`}
              >
                <div className={cn(
                  "font-bold text-green-600 mb-1",
                  isMobile ? "text-xl" : "text-2xl"
                )}
                aria-hidden="true"
                >
                  {formatTime(performanceMetrics.avgResponseTime)}
                </div>
                <div className={cn(
                  "text-gray-600 dark:text-gray-400",
                  isMobile ? "text-xs leading-tight" : "text-sm"
                )}
                aria-hidden="true"
                >
                  Average Response Time
                </div>
                <div className="flex items-center justify-center mt-2">
                  <Clock 
                    className={cn(
                      "text-gray-400",
                      isMobile ? "h-3 w-3" : "h-4 w-4"
                    )}
                    aria-hidden="true"
                  />
                </div>
              </div>
              
              <div 
                className="text-center"
                role="listitem"
                tabIndex={0}
                aria-label={`Ticket Reopen Rate: ${performanceMetrics.reopenRate} percent. ${performanceMetrics.reopenRate <= 5 ? 'This is within acceptable limits.' : 'This exceeds recommended thresholds.'} Lower rates indicate better resolution quality.`}
              >
                <div className={cn(
                  `font-bold mb-1 ${performanceMetrics.reopenRate <= 5 ? 'text-green-600' : 'text-red-600'}`,
                  isMobile ? "text-xl" : "text-2xl"
                )}
                aria-hidden="true"
                >
                  {performanceMetrics.reopenRate}%
                </div>
                <div className={cn(
                  "text-gray-600 dark:text-gray-400",
                  isMobile ? "text-xs leading-tight" : "text-sm"
                )}
                aria-hidden="true"
                >
                  Ticket Reopen Rate
                </div>
                <div className="flex items-center justify-center mt-2">
                  {performanceMetrics.reopenRate <= 5 ? (
                    <CheckCircle 
                      className={cn(
                        "text-green-600",
                        isMobile ? "h-3 w-3" : "h-4 w-4"
                      )}
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle 
                      className={cn(
                        "text-red-600",
                        isMobile ? "h-3 w-3" : "h-4 w-4"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
              
              <div 
                className="text-center"
                role="listitem"
                tabIndex={0}
                aria-label={`Agent Productivity: ${performanceMetrics.agentProductivity} tickets per agent. This shows the average number of tickets handled per agent.`}
              >
                <div className={cn(
                  "font-bold text-purple-600 mb-1",
                  isMobile ? "text-xl" : "text-2xl"
                )}
                aria-hidden="true"
                >
                  {performanceMetrics.agentProductivity}
                </div>
                <div className={cn(
                  "text-gray-600 dark:text-gray-400",
                  isMobile ? "text-xs leading-tight" : "text-sm"
                )}
                aria-hidden="true"
                >
                  Tickets per Agent
                </div>
                <div className="flex items-center justify-center mt-2">
                  <TrendingUp 
                    className={cn(
                      "text-blue-500",
                      isMobile ? "h-3 w-3" : "h-4 w-4"
                    )}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Charts Section - Mobile-first responsive design with accessibility improvements */}
      <section 
        aria-labelledby="charts-title"
        role="region"
      >
        <h2 
          id="charts-title" 
          className="sr-only"
        >
          Analytics Charts and Visualizations
        </h2>
        <div className={cn(
          "grid gap-6",
          // Mobile: single column, Desktop: 2 columns
          isMobile ? "grid-cols-1 gap-4" : "grid-cols-1 lg:grid-cols-2"
        )}>
          {/* Priority Distribution */}
          <Card className={cn(
            // Touch-friendly interactions on mobile
            isMobile && "active:scale-[0.98] transition-transform duration-150"
          )}>
            <CardHeader className={cn(
              // Responsive padding
              isMobile && "p-4 pb-3"
            )}>
              <CardTitle 
                className={cn(
                  "flex items-center gap-2",
                  // Responsive icon and text size
                  isMobile && "text-lg"
                )}
                id="priority-chart-title"
              >
                <PieChartIcon 
                  className={cn(
                    isMobile ? "h-4 w-4" : "h-5 w-5"
                  )}
                  aria-hidden="true"
                />
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className={cn(
              // Responsive padding
              isMobile && "p-4 pt-0"
            )}>
              {loading ? (
                <div 
                  className={cn(
                    "bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center animate-pulse",
                    // Responsive chart height
                    isMobile ? "h-48" : "h-64"
                  )}
                  role="status"
                  aria-label="Loading priority distribution chart"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 
                      className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500"
                      aria-hidden="true"
                    />
                    <div className={cn(
                      "text-gray-500 dark:text-gray-400",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Loading chart data...
                    </div>
                  </div>
                </div>
              ) : priorityDistribution.length > 0 ? (
                <div
                  role="img"
                  aria-labelledby="priority-chart-title"
                  aria-describedby="priority-chart-description"
                  tabIndex={0}
                >
                  <div 
                    id="priority-chart-description" 
                    className="sr-only"
                  >
                    Pie chart showing ticket priority distribution: {priorityDistribution.map(item => `${item.name} priority: ${item.value} tickets`).join(', ')}
                  </div>
                  <ChartContainer 
                    config={chartConfig} 
                    className={cn(
                      // Responsive chart height with better mobile optimization
                      isMobile ? "h-56" : "h-64"
                    )}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityDistribution}
                          cx="50%"
                          cy={isMobile ? "45%" : "50%"}
                          outerRadius={isMobile ? 50 : 80}
                          innerRadius={isMobile ? 15 : 0}
                          dataKey="value"
                          label={isMobile ? false : ({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                        >
                          {priorityDistribution.map((entry, index) => (
                            <Cell key={`priority-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {/* Always show legend on mobile, optional on desktop */}
                        <Legend 
                          wrapperStyle={{
                            paddingTop: isMobile ? '10px' : '20px',
                            fontSize: isMobile ? '12px' : '14px'
                          }}
                          iconType={isMobile ? 'circle' : 'rect'}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <div 
                  className={cn(
                    "flex items-center justify-center text-gray-500",
                    isMobile ? "h-48" : "h-64"
                  )}
                  role="status"
                  aria-label="No priority distribution data available"
                >
                  <div className="text-center">
                    <PieChartIcon 
                      className={cn(
                        "mx-auto mb-4 opacity-50",
                        isMobile ? "h-8 w-8" : "h-12 w-12"
                      )}
                      aria-hidden="true"
                    />
                    <p className={cn(
                      "font-medium mb-2",
                      isMobile ? "text-base" : "text-lg"
                    )}>
                      No Priority Data
                    </p>
                    <p className={cn(
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Priority distribution will appear here once tickets are available.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ticket Timeline */}
          <Card className={cn(
            // Touch-friendly interactions on mobile
            isMobile && "active:scale-[0.98] transition-transform duration-150"
          )}>
            <CardHeader className={cn(
              // Responsive padding
              isMobile && "p-4 pb-3"
            )}>
              <CardTitle 
                className={cn(
                  "flex items-center gap-2",
                  // Responsive icon and text size
                  isMobile && "text-lg"
                )}
                id="timeline-chart-title"
              >
                <Calendar 
                  className={cn(
                    isMobile ? "h-4 w-4" : "h-5 w-5"
                  )}
                  aria-hidden="true"
                />
                Daily Activity (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className={cn(
              // Responsive padding
              isMobile && "p-4 pt-0"
            )}>
              {loading ? (
                <div 
                  className={cn(
                    "bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center animate-pulse",
                    // Responsive chart height
                    isMobile ? "h-48" : "h-64"
                  )}
                  role="status"
                  aria-label="Loading daily activity timeline chart"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 
                      className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500"
                      aria-hidden="true"
                    />
                    <div className={cn(
                      "text-gray-500 dark:text-gray-400",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Loading chart data...
                    </div>
                  </div>
                </div>
              ) : timeseriesData.length > 0 ? (
                <div
                  role="img"
                  aria-labelledby="timeline-chart-title"
                  aria-describedby="timeline-chart-description"
                  tabIndex={0}
                >
                  <div 
                    id="timeline-chart-description" 
                    className="sr-only"
                  >
                    Area chart showing daily ticket activity over the last 30 days. Shows trends for tickets created and resolved each day. Created tickets are shown in blue, resolved tickets in green.
                  </div>
                  <ChartContainer 
                    config={chartConfig} 
                    className={cn(
                      // Responsive chart height
                      isMobile ? "h-48" : "h-64"
                    )}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={timeseriesData}
                        margin={{
                          top: 10,
                          right: isMobile ? 10 : 30,
                          left: isMobile ? 0 : 20,
                          bottom: isMobile ? 20 : 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ 
                            fontSize: isMobile ? 9 : 12,
                            fill: 'currentColor'
                          }}
                          tickLine={false}
                          axisLine={false}
                          interval={isMobile ? Math.ceil(timeseriesData.length / 4) : 'preserveStartEnd'}
                          angle={isMobile ? -45 : 0}
                          textAnchor={isMobile ? 'end' : 'middle'}
                          height={isMobile ? 50 : 30}
                        />
                        <YAxis 
                          tick={{ 
                            fontSize: isMobile ? 9 : 12,
                            fill: 'currentColor'
                          }}
                          tickLine={false}
                          axisLine={false}
                          width={isMobile ? 30 : 40}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="created" 
                          stackId="1" 
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={isMobile ? 0.4 : 0.3}
                          strokeWidth={isMobile ? 1.5 : 2}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="resolved" 
                          stackId="2" 
                          stroke="#10b981" 
                          fill="#10b981" 
                          fillOpacity={isMobile ? 0.4 : 0.3}
                          strokeWidth={isMobile ? 1.5 : 2}
                        />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          cursor={{ strokeDasharray: '3 3' }}
                        />
                        {/* Add legend for mobile */}
                        {isMobile && (
                          <Legend 
                            wrapperStyle={{
                              paddingTop: '10px',
                              fontSize: '11px'
                            }}
                            iconType="line"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <div 
                  className={cn(
                    "flex items-center justify-center text-gray-500",
                    isMobile ? "h-48" : "h-64"
                  )}
                  role="status"
                  aria-label="No daily activity timeline data available"
                >
                  <div className="text-center">
                    <Calendar 
                      className={cn(
                        "mx-auto mb-4 opacity-50",
                        isMobile ? "h-8 w-8" : "h-12 w-12"
                      )}
                      aria-hidden="true"
                    />
                    <p className={cn(
                      "font-medium mb-2",
                      isMobile ? "text-base" : "text-lg"
                    )}>
                      No Timeline Data
                    </p>
                    <p className={cn(
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Daily activity timeline will appear here once data is available.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Agent Performance - Mobile-first responsive design with accessibility improvements */}
      <section 
        aria-labelledby="agent-performance-title"
        role="region"
      >
        <Card className={cn(
          // Touch-friendly interactions on mobile
          isMobile && "active:scale-[0.98] transition-transform duration-150"
        )}>
          <CardHeader className={cn(
            // Responsive padding
            isMobile && "p-4 pb-3"
          )}>
            <CardTitle 
              id="agent-performance-title"
              className={cn(
                "flex items-center gap-2",
                // Responsive icon and text size
                isMobile && "text-lg"
              )}
            >
              <Users 
                className={cn(
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )}
                aria-hidden="true"
              />
              Agent Performance Analysis
            </CardTitle>
          </CardHeader>
        <CardContent className={cn(
          // Responsive padding
          isMobile && "p-4 pt-0"
        )}>
          {agentPerformance.length > 0 ? (
            <div 
              className={cn(
                "grid gap-6",
                // Mobile-first grid: 1 col on mobile, 2 on tablet, 3 on desktop
                isMobile 
                  ? "grid-cols-1 gap-4" 
                  : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              )}
              role="list"
              aria-label="Agent performance cards"
            >
              {agentPerformance.map((agent) => {
                const performanceLevel = agent.productivity >= 80 ? "Excellent" : agent.productivity >= 60 ? "Good" : "Needs Improvement";
                const trendDirection = agent.productivity >= 80 ? "up" : agent.productivity >= 60 ? "neutral" : "down";
                
                return (
                  <Card 
                    key={agent.id} 
                    className={cn(
                      "relative overflow-hidden transition-all duration-200 border-l-4 border-l-blue-500 cursor-pointer",
                      // Mobile-optimized hover and touch states
                      isMobile 
                        ? "active:scale-[0.98] active:shadow-md touch-manipulation" 
                        : "hover:shadow-lg hover:scale-[1.02]"
                    )}
                    onClick={() => handleAgentClick(agent)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAgentClick(agent);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for agent ${agent.name}. Performance: ${performanceLevel}. ${agent.assigned} tickets assigned, ${agent.resolved} resolved. Productivity: ${agent.productivity.toFixed(1)}%. Satisfaction score: ${agent.satisfactionScore.toFixed(1)} out of 5.`}
                    aria-describedby={`agent-${agent.id}-details`}
                  >
                    <CardContent className={cn(
                    // Responsive padding
                    isMobile ? "p-4" : "p-6"
                  )}>
                    <div 
                      id={`agent-${agent.id}-details`}
                      className="sr-only"
                    >
                      Agent performance details: {agent.name} has {agent.assigned} tickets assigned and {agent.resolved} resolved. 
                      Average resolution time is {formatTime(agent.avgResolutionTime)}. 
                      Productivity rate is {agent.productivity.toFixed(1)}% with satisfaction score of {agent.satisfactionScore.toFixed(1)} out of 5.
                    </div>
                    
                    {/* Agent Header with Performance Badge */}
                    <div className={cn(
                      "flex items-start justify-between mb-4",
                      // Stack on mobile for better readability
                      isMobile && "flex-col gap-3"
                    )}>
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-semibold text-gray-900 dark:text-white truncate mb-1",
                          // Responsive text size
                          isMobile ? "text-base" : "text-lg"
                        )}>
                          {agent.name}
                        </h3>
                        <p className={cn(
                          "text-gray-600 dark:text-gray-400",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Support Agent
                        </p>
                      </div>
                      <div className={cn(
                        "flex gap-2",
                        // Full width on mobile for better touch targets
                        isMobile ? "w-full justify-between" : "flex-col items-end ml-3"
                      )}>
                        {/* Performance Badge with Color Coding */}
                        <Badge 
                          variant={agent.productivity >= 80 ? "default" : agent.productivity >= 60 ? "secondary" : "destructive"}
                          className={cn(
                            `font-semibold ${
                              agent.productivity >= 80 
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800" 
                                : agent.productivity >= 60 
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800"
                            }`,
                            // Responsive padding and text size
                            isMobile ? "px-2 py-1 text-xs" : "px-3 py-1"
                          )}
                          aria-label={`Performance level: ${performanceLevel}`}
                        >
                          {performanceLevel}
                        </Badge>
                        {/* Satisfaction Rating Badge */}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            isMobile ? "px-2 py-1" : "px-2 py-1"
                          )}
                          aria-label={`Customer satisfaction rating: ${agent.satisfactionScore.toFixed(1)} out of 5 stars`}
                        >
                          <span aria-hidden="true">⭐</span> {agent.satisfactionScore.toFixed(1)}/5
                        </Badge>
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className={cn(
                      "grid grid-cols-2 gap-4 mb-4",
                      // Responsive gap
                      isMobile && "gap-3"
                    )}>
                      <div className={cn(
                        "text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg",
                        // Responsive padding
                        isMobile ? "p-2" : "p-3"
                      )}>
                        <p className={cn(
                          "font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1",
                          isMobile ? "text-xs" : "text-xs"
                        )}>
                          Assigned
                        </p>
                        <p className={cn(
                          "font-bold text-blue-700 dark:text-blue-300",
                          // Responsive text size
                          isMobile ? "text-lg" : "text-xl"
                        )}>
                          {agent.assigned}
                        </p>
                      </div>
                      <div className={cn(
                        "text-center bg-green-50 dark:bg-green-900/20 rounded-lg",
                        // Responsive padding
                        isMobile ? "p-2" : "p-3"
                      )}>
                        <p className={cn(
                          "font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1",
                          isMobile ? "text-xs" : "text-xs"
                        )}>
                          Resolved
                        </p>
                        <p className={cn(
                          "font-bold text-green-700 dark:text-green-300",
                          // Responsive text size
                          isMobile ? "text-lg" : "text-xl"
                        )}>
                          {agent.resolved}
                        </p>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className={cn(
                      "space-y-3 mb-4",
                      // Responsive spacing
                      isMobile && "space-y-2"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "font-medium text-gray-600 dark:text-gray-400",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Avg Resolution Time
                        </span>
                        <span className={cn(
                          "font-semibold text-gray-900 dark:text-white",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {formatTime(agent.avgResolutionTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "font-medium text-gray-600 dark:text-gray-400",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Resolution Rate
                        </span>
                        <span className={cn(
                          `font-semibold ${
                            agent.productivity >= 80 
                              ? "text-green-600 dark:text-green-400" 
                              : agent.productivity >= 60 
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-red-600 dark:text-red-400"
                          }`,
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {agent.productivity.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Performance</span>
                        <span className="font-medium">{agent.productivity.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={agent.productivity} 
                        className={cn(
                          `${
                            agent.productivity >= 80 
                              ? "[&>div]:bg-green-500" 
                              : agent.productivity >= 60 
                                ? "[&>div]:bg-yellow-500"
                                : "[&>div]:bg-red-500"
                          }`,
                          // Responsive height
                          isMobile ? "h-1.5" : "h-2"
                        )}
                      />
                    </div>

                    {/* Performance Indicator - Hide on mobile to save space */}
                    {!isMobile && (
                      <div className="absolute top-4 right-4 opacity-10">
                        {agent.productivity >= 80 ? (
                          <TrendingUp 
                            className="h-8 w-8 text-green-500"
                            aria-hidden="true"
                          />
                        ) : agent.productivity >= 60 ? (
                          <Activity 
                            className="h-8 w-8 text-yellow-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <TrendingDown 
                            className="h-8 w-8 text-red-500"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Agent Performance Data</p>
              <p className="text-sm">Agent performance metrics will appear here once data is available.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </section>

      {/* Category Insights - Mobile-first responsive design with accessibility improvements */}
      <section 
        aria-labelledby="category-insights-title"
        role="region"
      >
        <Card className={cn(
          // Touch-friendly interactions on mobile
          isMobile && "active:scale-[0.98] transition-transform duration-150"
        )}>
          <CardHeader className={cn(
            // Responsive padding
            isMobile && "p-4 pb-3"
          )}>
            <CardTitle 
              id="category-insights-title"
              className={cn(
                "flex items-center gap-2",
                // Responsive icon and text size
                isMobile && "text-lg"
              )}
            >
              <BarChart3 
                className={cn(
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )}
                aria-hidden="true"
              />
              Category Performance Insights
            </CardTitle>
          </CardHeader>
        <CardContent className={cn(
          // Responsive padding
          isMobile && "p-4 pt-0"
        )}>
          {categoryInsights.length > 0 ? (
            <div 
              className={cn(
                "grid gap-4",
                // Mobile-first grid: 1 col on mobile, 2 on tablet, 3 on desktop
                isMobile 
                  ? "grid-cols-1 gap-3" 
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              )}
              role="list"
              aria-label="Category performance insights"
            >
              {categoryInsights.slice(0, 6).map((category, index) => {
                // Determine trend direction based on percentage
                const trendDirection = category.trendPercentage > 5 ? 'up' : 
                                     category.trendPercentage < -5 ? 'down' : 'neutral';
                
                // Determine performance color based on satisfaction and resolution time
                const performanceColor = category.satisfactionScore >= 4.5 && category.avgResolutionTime <= 24 ? 'green' :
                                       category.satisfactionScore >= 4.0 && category.avgResolutionTime <= 48 ? 'blue' :
                                       category.satisfactionScore >= 3.5 && category.avgResolutionTime <= 72 ? 'yellow' : 'red';

                const performanceLabel = performanceColor === 'green' ? 'Excellent' :
                                       performanceColor === 'blue' ? 'Good' :
                                       performanceColor === 'yellow' ? 'Fair' : 'Needs Attention';

                const trendDescription = trendDirection === 'up' ? 'Volume increasing' :
                                       trendDirection === 'down' ? 'Volume decreasing' :
                                       'Volume stable';

                return (
                  <Card 
                    key={index} 
                    className={cn(
                      `relative overflow-hidden transition-all duration-200 border-l-4 ${
                        performanceColor === 'green' ? 'border-l-green-500 bg-green-50 dark:bg-green-950/20' :
                        performanceColor === 'blue' ? 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20' :
                        performanceColor === 'yellow' ? 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                        'border-l-red-500 bg-red-50 dark:bg-red-950/20'
                      }`,
                      // Mobile-optimized hover and touch states
                      isMobile 
                        ? "active:scale-[0.98] active:shadow-md touch-manipulation" 
                        : "hover:shadow-lg hover:scale-[1.02]"
                    )}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`Category: ${category.name}. ${category.count} tickets. Performance: ${performanceLabel}. Average resolution time: ${formatTime(category.avgResolutionTime)}. Satisfaction score: ${category.satisfactionScore.toFixed(1)} out of 5. Trend: ${trendDescription} by ${Math.abs(category.trendPercentage)}% compared to last period.`}
                  >
                    <CardContent className={cn(
                      // Responsive padding
                      isMobile ? "p-3" : "p-4"
                    )}>
                      {/* Category Header with Trend Indicator */}
                      <div className={cn(
                        "flex items-start justify-between mb-3",
                        // Stack on mobile for better readability
                        isMobile && "flex-col gap-2"
                      )}>
                        <div className="flex-1 min-w-0">
                          <h4 className={cn(
                            "font-semibold text-gray-900 dark:text-white truncate mb-1",
                            // Responsive text size
                            isMobile ? "text-base" : "text-lg"
                          )}>
                            {category.name}
                          </h4>
                          <p className={cn(
                            "text-gray-600 dark:text-gray-400",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {category.count} ticket{category.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        
                        {/* Visual Trend Indicator with accessibility improvements */}
                        <div className={cn(
                          "flex gap-2",
                          // Full width on mobile for better touch targets
                          isMobile ? "w-full justify-between" : "flex-col items-end ml-3"
                        )}>
                          <div 
                            className={cn(
                              `flex items-center gap-1 rounded-full font-medium ${
                                trendDirection === 'up' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                trendDirection === 'down' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                              }`,
                              // Responsive padding and text size
                              isMobile ? "px-2 py-1 text-xs" : "px-2 py-1 text-xs"
                            )}
                            role="status"
                            aria-label={`Trend indicator: ${trendDescription} by ${Math.abs(category.trendPercentage)}% compared to last period`}
                          >
                            {trendDirection === 'up' ? (
                              <TrendingUp 
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            ) : trendDirection === 'down' ? (
                              <TrendingDown 
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            ) : (
                              <Activity 
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            )}
                            <span aria-hidden="true">
                              {category.trendPercentage > 0 ? '+' : ''}{category.trendPercentage}%
                            </span>
                          </div>
                          
                          {/* Performance Badge */}
                          <Badge 
                            variant="outline"
                            className={cn(
                              `text-xs ${
                                performanceColor === 'green' ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400' :
                                performanceColor === 'blue' ? 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400' :
                                performanceColor === 'yellow' ? 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400' :
                                'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                              }`,
                              // Responsive padding
                              isMobile ? "px-2 py-0.5" : "px-2 py-0.5"
                            )}
                            aria-label={`Performance level: ${performanceLabel}`}
                          >
                            {performanceLabel}
                          </Badge>
                        </div>
                      </div>

                      {/* Key Metrics Grid */}
                      <div className={cn(
                        "grid grid-cols-2 gap-3 mb-3",
                        // Responsive gap
                        isMobile && "gap-2"
                      )}>
                        <div className={cn(
                          "text-center bg-white dark:bg-gray-800/50 rounded-lg border",
                          // Responsive padding
                          isMobile ? "p-2" : "p-2"
                        )}>
                          <p className={cn(
                            "font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1",
                            isMobile ? "text-xs" : "text-xs"
                          )}>
                            Avg Resolution
                          </p>
                          <p className={cn(
                            `font-bold ${
                              category.avgResolutionTime <= 24 ? 'text-green-600 dark:text-green-400' :
                              category.avgResolutionTime <= 48 ? 'text-blue-600 dark:text-blue-400' :
                              category.avgResolutionTime <= 72 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`,
                            // Responsive text size
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {formatTime(category.avgResolutionTime)}
                          </p>
                        </div>
                        <div className={cn(
                          "text-center bg-white dark:bg-gray-800/50 rounded-lg border",
                          // Responsive padding
                          isMobile ? "p-2" : "p-2"
                        )}>
                          <p className={cn(
                            "font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1",
                            isMobile ? "text-xs" : "text-xs"
                          )}>
                            Satisfaction
                          </p>
                          <p className={cn(
                            `font-bold ${
                              category.satisfactionScore >= 4.5 ? 'text-green-600 dark:text-green-400' :
                              category.satisfactionScore >= 4.0 ? 'text-blue-600 dark:text-blue-400' :
                              category.satisfactionScore >= 3.5 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`,
                            // Responsive text size
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {category.satisfactionScore.toFixed(1)}/5
                          </p>
                        </div>
                      </div>

                      {/* Progress Indicator */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Performance Score</span>
                          <span className="font-medium">
                            {Math.round((category.satisfactionScore / 5) * 100)}%
                          </span>
                        </div>
                        <Progress 
                          value={(category.satisfactionScore / 5) * 100} 
                          className={cn(
                            `${
                              performanceColor === 'green' ? '[&>div]:bg-green-500' :
                              performanceColor === 'blue' ? '[&>div]:bg-blue-500' :
                              performanceColor === 'yellow' ? '[&>div]:bg-yellow-500' :
                              '[&>div]:bg-red-500'
                            }`,
                            // Responsive height
                            isMobile ? "h-1.5" : "h-2"
                          )}
                        />
                      </div>

                      {/* Trend Description */}
                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className={cn(
                          "text-gray-600 dark:text-gray-400",
                          isMobile ? "text-xs" : "text-xs"
                        )}>
                          {trendDirection === 'up' ? 'Volume increasing' :
                           trendDirection === 'down' ? 'Volume decreasing' :
                           'Volume stable'} compared to last period
                        </p>
                      </div>

                      {/* Background Performance Icon - Hide on mobile to save space */}
                      {!isMobile && (
                        <div className="absolute top-3 right-3 opacity-10">
                          {performanceColor === 'green' ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : performanceColor === 'blue' ? (
                            <Target className="h-6 w-6 text-blue-500" />
                          ) : performanceColor === 'yellow' ? (
                            <Clock className="h-6 w-6 text-yellow-500" />
                          ) : (
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Category Performance Data</p>
              <p className="text-sm">Category insights will appear here once tickets are categorized.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </section>

      {/* Agent Tickets Dialog - Mobile-first responsive design */}
      <Dialog open={selectedAgent !== null} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className={cn(
          // Responsive dialog sizing
          isMobile 
            ? "max-w-[95vw] max-h-[90vh] p-4" 
            : "max-w-4xl max-h-[80vh]"
        )}>
          <DialogHeader className={cn(
            // Responsive padding
            isMobile && "pb-3"
          )}>
            <DialogTitle className={cn(
              "flex items-center gap-2",
              // Responsive text size and layout
              isMobile && "text-lg flex-col items-start gap-1"
            )}>
              <div className="flex items-center gap-2">
                <Users className={cn(
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )} />
                <span className={cn(
                  isMobile && "text-base"
                )}>
                  Open & In-Progress Tickets
                </span>
              </div>
              {isMobile && (
                <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                  {selectedAgent?.name}
                </span>
              )}
              {!isMobile && (
                <span>- {selectedAgent?.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className={cn(
            // Responsive height
            isMobile ? "max-h-[70vh]" : "max-h-[60vh]"
          )}>
            {ticketsLoading ? (
              <div className={cn(
                "space-y-4",
                // Responsive spacing
                isMobile && "space-y-3"
              )}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="animate-pulse border-l-4 border-l-gray-300">
                    <CardContent className={cn(
                      // Responsive padding
                      isMobile ? "p-3" : "p-4"
                    )}>
                      <div className={cn(
                        "flex items-start justify-between mb-3",
                        // Stack on mobile for better readability
                        isMobile && "flex-col gap-2"
                      )}>
                        <div className="flex-1">
                          <Skeleton className="h-5 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className={cn(
                          "flex gap-2",
                          // Full width on mobile
                          isMobile ? "w-full justify-between" : "flex-col items-end ml-4"
                        )}>
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-5 w-12" />
                        </div>
                      </div>
                      
                      <div className={cn(
                        "grid gap-4",
                        // Responsive grid: 2 cols on mobile, 4 on desktop
                        isMobile ? "grid-cols-2 gap-3" : "grid-cols-2 md:grid-cols-4"
                      )}>
                        <div>
                          <Skeleton className="h-3 w-12 mb-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <div>
                          <Skeleton className="h-3 w-16 mb-1" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        {!isMobile && (
                          <>
                            <div>
                              <Skeleton className="h-3 w-14 mb-1" />
                              <Skeleton className="h-4 w-18" />
                            </div>
                            <div>
                              <Skeleton className="h-3 w-12 mb-1" />
                              <Skeleton className="h-4 w-16" />
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : agentTickets.length > 0 ? (
              <div className={cn(
                "space-y-4",
                // Responsive spacing
                isMobile && "space-y-3"
              )}>
                {agentTickets.map((ticket) => (
                  <Card 
                    key={ticket.id} 
                    className={cn(
                      "border-l-4 border-l-blue-500",
                      // Touch-friendly interactions on mobile
                      isMobile && "active:scale-[0.98] transition-transform duration-150"
                    )}
                  >
                    <CardContent className={cn(
                      // Responsive padding
                      isMobile ? "p-3" : "p-4"
                    )}>
                      <div className={cn(
                        "flex items-start justify-between mb-3",
                        // Stack on mobile for better readability
                        isMobile && "flex-col gap-2"
                      )}>
                        <div className="flex-1 min-w-0">
                          <h4 className={cn(
                            "font-semibold text-gray-900 dark:text-white truncate mb-1",
                            // Responsive text size
                            isMobile ? "text-base" : "text-lg"
                          )}>
                            {ticket.title}
                          </h4>
                          <p className={cn(
                            "text-gray-600 dark:text-gray-400 line-clamp-2",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {ticket.description}
                          </p>
                        </div>
                        <div className={cn(
                          "flex gap-2",
                          // Full width on mobile for better touch targets
                          isMobile ? "w-full justify-between" : "flex-col items-end ml-4"
                        )}>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              getPriorityColor(ticket.priority),
                              // Responsive text size
                              isMobile && "text-xs"
                            )}
                          >
                            {ticket.priority?.toUpperCase() || 'MEDIUM'}
                          </Badge>
                          <Badge 
                            variant={ticket.status === 'open' ? 'destructive' : 'secondary'}
                            className={cn(
                              "text-xs",
                              // Responsive padding
                              isMobile && "px-2 py-1"
                            )}
                          >
                            {ticket.status?.toUpperCase() || 'OPEN'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "grid gap-4",
                        // Responsive grid: 2 cols on mobile, 4 on desktop
                        isMobile ? "grid-cols-2 gap-3 text-xs" : "grid-cols-2 md:grid-cols-4 text-sm"
                      )}>
                        <div>
                          <p className={cn(
                            "text-gray-500 dark:text-gray-400 font-medium",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            Created
                          </p>
                          <p className={cn(
                            "text-gray-900 dark:text-white",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {ticket.created_at ? formatDate(ticket.created_at) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className={cn(
                            "text-gray-500 dark:text-gray-400 font-medium",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            Last Updated
                          </p>
                          <p className={cn(
                            "text-gray-900 dark:text-white",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {ticket.updated_at ? formatDate(ticket.updated_at) : 'N/A'}
                          </p>
                        </div>
                        {!isMobile && (
                          <>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Category</p>
                              <p className="text-gray-900 dark:text-white text-sm">
                                {ticket.category?.name || 'Uncategorized'}
                                {ticket.subcategory?.name && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    /{ticket.subcategory.name}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Ticket ID</p>
                              <Button
                                variant="link"
                                className="h-auto p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/ticket/${ticket.id}`);
                                  setSelectedAgent(null);
                                }}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                #{ticket.ticket_number || ticket.id?.slice(-8) || 'N/A'}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Mobile-only additional info */}
                      {isMobile && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Category</p>
                              <p className="text-xs text-gray-900 dark:text-white">
                                {ticket.category?.name || 'Uncategorized'}
                                {ticket.subcategory?.name && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    /{ticket.subcategory.name}
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/ticket/${ticket.id}`);
                                setSelectedAgent(null);
                              }}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              #{ticket.ticket_number || ticket.id?.slice(-8) || 'N/A'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p className="text-lg font-medium mb-2">No Open or In-Progress Tickets</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedAgent?.name} has no open or in-progress tickets assigned.
                </p>
              </div>
            )}
          </ScrollArea>
          
          <div className={cn(
            "flex items-center justify-between pt-4 border-t",
            // Stack on mobile for better touch targets
            isMobile && "flex-col gap-3"
          )}>
            <div className={cn(
              "text-gray-600 dark:text-gray-400",
              isMobile ? "text-xs text-center" : "text-sm"
            )}>
              {agentTickets.length} open/in-progress ticket{agentTickets.length !== 1 ? 's' : ''} found
            </div>
            <Button 
              variant="outline" 
              onClick={() => setSelectedAgent(null)}
              className={cn(
                // Full width on mobile for better touch targets
                isMobile && "w-full"
              )}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 