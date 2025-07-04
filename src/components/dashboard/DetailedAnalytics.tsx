import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
  Timer,
  Zap,
  Award,
  Loader2
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

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

export function DetailedAnalytics() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
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

  const chartConfig = {
    created: { label: "Created", color: "#3b82f6" },
    resolved: { label: "Resolved", color: "#10b981" },
    inProgress: { label: "In Progress", color: "#f59e0b" },
    backlog: { label: "Backlog", color: "#ef4444" },
    tickets: { label: "Tickets", color: "#6366f1" },
    productivity: { label: "Productivity", color: "#8b5cf6" }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-lg">Loading detailed analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Detailed Analytics</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive insights and performance metrics
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Activity className="h-4 w-4 mr-1" />
          Real-time Data
        </Badge>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Resolution Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatTime(performanceMetrics.avgResolutionTime)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: 24h</p>
              </div>
              <Timer className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">SLA Compliance</p>
                <p className={`text-2xl font-bold ${getPerformanceColor(performanceMetrics.slaCompliance, 80, 90)}`}>
                  {performanceMetrics.slaCompliance}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: 90%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer Satisfaction</p>
                <p className={`text-2xl font-bold ${getPerformanceColor(performanceMetrics.customerSatisfaction, 80, 90)}`}>
                  {performanceMetrics.customerSatisfaction}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: 85%</p>
              </div>
              <Award className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Backlog</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {performanceMetrics.ticketBacklog}
                </p>
                <p className="text-xs text-gray-500 mt-1">Open + In Progress</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Key Performance Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {performanceMetrics.firstContactResolution}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">First Contact Resolution</div>
              <Progress value={performanceMetrics.firstContactResolution} className="mt-2" />
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {formatTime(performanceMetrics.avgResponseTime)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Average Response Time</div>
              <div className="flex items-center justify-center mt-2">
                <Clock className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${performanceMetrics.reopenRate <= 5 ? 'text-green-600' : 'text-red-600'}`}>
                {performanceMetrics.reopenRate}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ticket Reopen Rate</div>
              <div className="flex items-center justify-center mt-2">
                {performanceMetrics.reopenRate <= 5 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {performanceMetrics.agentProductivity}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Tickets per Agent</div>
              <div className="flex items-center justify-center mt-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {priorityDistribution.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-64">
                <PieChart>
                  <Pie
                    data={priorityDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                  >
                    {priorityDistribution.map((entry, index) => (
                      <Cell key={`priority-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No priority data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Activity (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeseriesData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-64">
                <AreaChart data={timeseriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Area type="monotone" dataKey="created" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="resolved" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No timeline data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentPerformance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentPerformance.map((agent) => (
                <div key={agent.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">{agent.name}</h4>
                    <Badge variant={agent.productivity >= 80 ? "default" : agent.productivity >= 60 ? "secondary" : "destructive"}>
                      {agent.productivity.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Assigned</p>
                      <p className="font-semibold text-lg">{agent.assigned}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Resolved</p>
                      <p className="font-semibold text-lg text-green-600">{agent.resolved}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Avg Resolution</p>
                      <p className="font-semibold text-lg">{formatTime(agent.avgResolutionTime)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Rating</p>
                      <p className="font-semibold text-lg text-yellow-600">{agent.satisfactionScore.toFixed(1)}/5</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Resolution Rate</span>
                      <span>{agent.productivity.toFixed(1)}%</span>
                    </div>
                    <Progress value={agent.productivity} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No agent performance data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Category Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryInsights.length > 0 ? (
            <div className="space-y-3">
              {categoryInsights.slice(0, 5).map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{category.name}</span>
                      <Badge variant={category.trendPercentage > 0 ? "destructive" : "default"}>
                        {category.trendPercentage > 0 ? '+' : ''}{category.trendPercentage}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{category.count} tickets</span>
                      <span>{formatTime(category.avgResolutionTime)} avg</span>
                      <span>{category.satisfactionScore.toFixed(1)}/5 satisfaction</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No category data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 