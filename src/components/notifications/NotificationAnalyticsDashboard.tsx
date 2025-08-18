import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MessageSquare, 
  Eye, 
  MousePointer, 
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { NotificationAnalytics } from '@/services/NotificationAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DashboardMetrics {
  totalNotifications: number;
  totalUsers: number;
  averageEngagement: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  deleteRate: number;
  topPerformingTypes: string[];
  dailyStats: Array<{
    date: string;
    sent: number;
    read: number;
    clicked: number;
    deleted: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    count: number;
  }>;
  typeBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  insights: {
    patterns: string[];
    suggestions: string[];
    performanceIssues: string[];
  };
}

interface UserEngagementData {
  userId: string;
  userName: string;
  totalNotifications: number;
  readRate: number;
  clickRate: number;
  deleteRate: number;
  averageReadTime: number;
  lastActive: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const NotificationAnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [userEngagement, setUserEngagement] = useState<UserEngagementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const analytics = NotificationAnalytics.getInstance();

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDashboardData();
    }
  }, [user, timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load system analytics
      const systemAnalytics = await analytics.getSystemAnalytics();
      
      // Calculate additional metrics
      const deliveryRate = systemAnalytics.totalNotifications > 0 
        ? ((systemAnalytics.totalNotifications - 0) / systemAnalytics.totalNotifications) * 100 
        : 0;

      const readRate = systemAnalytics.totalNotifications > 0
        ? (systemAnalytics.dailyStats.reduce((sum, day) => sum + day.read, 0) / systemAnalytics.totalNotifications) * 100
        : 0;

      const clickRate = systemAnalytics.totalNotifications > 0
        ? (systemAnalytics.dailyStats.reduce((sum, day) => sum + day.clicked, 0) / systemAnalytics.totalNotifications) * 100
        : 0;

      const deleteRate = 5; // Mock data - would come from actual analytics

      // Generate hourly distribution (mock data)
      const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: Math.floor(Math.random() * 100) + 10
      }));

      // Generate type breakdown (mock data)
      const typeBreakdown = [
        { type: 'Ticket Update', count: 450, percentage: 45 },
        { type: 'New Comment', count: 300, percentage: 30 },
        { type: 'Assignment', count: 150, percentage: 15 },
        { type: 'Status Change', count: 100, percentage: 10 }
      ];

      // Generate insights based on data
      const insights = {
        patterns: [],
        suggestions: [],
        performanceIssues: []
      };

      // Identify patterns
      if (readRate < 50) {
        insights.patterns.push('Low notification read rates detected');
        insights.suggestions.push('Consider improving notification content relevance');
      }

      if (deleteRate > 20) {
        insights.patterns.push('High notification deletion rates');
        insights.suggestions.push('Review notification frequency and user preferences');
      }

      if (deliveryRate < 95) {
        insights.performanceIssues.push('Delivery rate below optimal threshold');
        insights.suggestions.push('Investigate notification delivery infrastructure');
      }

      // Check for high volume periods
      const peakHour = hourlyDistribution.reduce((max, hour) => 
        hour.count > max.count ? hour : max, hourlyDistribution[0]);
      
      if (peakHour.count > 200) {
        insights.patterns.push(`Peak notification volume at ${peakHour.hour}:00`);
        insights.suggestions.push('Consider implementing notification batching during peak hours');
      }

      setMetrics({
        totalNotifications: systemAnalytics.totalNotifications,
        totalUsers: systemAnalytics.totalUsers,
        averageEngagement: systemAnalytics.averageEngagement,
        deliveryRate,
        readRate,
        clickRate,
        deleteRate,
        topPerformingTypes: systemAnalytics.topPerformingTypes,
        dailyStats: systemAnalytics.dailyStats,
        hourlyDistribution,
        typeBreakdown,
        insights
      });

      // Generate mock user engagement data
      const mockUserEngagement: UserEngagementData[] = [
        {
          userId: '1',
          userName: 'John Doe',
          totalNotifications: 45,
          readRate: 89,
          clickRate: 67,
          deleteRate: 12,
          averageReadTime: 15,
          lastActive: '2024-01-15T10:30:00Z'
        },
        {
          userId: '2',
          userName: 'Jane Smith',
          totalNotifications: 38,
          readRate: 92,
          clickRate: 71,
          deleteRate: 8,
          averageReadTime: 22,
          lastActive: '2024-01-15T09:45:00Z'
        },
        {
          userId: '3',
          userName: 'Bob Johnson',
          totalNotifications: 52,
          readRate: 76,
          clickRate: 45,
          deleteRate: 18,
          averageReadTime: 8,
          lastActive: '2024-01-15T11:15:00Z'
        }
      ];

      setUserEngagement(mockUserEngagement);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Dashboard data refreshed');
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  if (user?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Analytics</h1>
          <p className="text-muted-foreground">
            Monitor notification performance and user engagement
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '90d') => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.totalNotifications || 0)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +5% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics?.averageEngagement || 0)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +3% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics?.deliveryRate || 0)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +1% from last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">User Engagement</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="types">Notification Types</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Notification Trends</CardTitle>
                <CardDescription>
                  Notification volume and engagement over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics?.dailyStats || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="sent" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="read" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    <Area type="monotone" dataKey="clicked" stackId="1" stroke="#ffc658" fill="#ffc658" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Hourly Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Hourly Distribution</CardTitle>
                <CardDescription>
                  When users are most active with notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics?.hourlyDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown</CardTitle>
              <CardDescription>
                How users interact with notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Read Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics?.readRate || 0)}
                    </span>
                  </div>
                  <Progress value={metrics?.readRate || 0} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Click Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics?.clickRate || 0)}
                    </span>
                  </div>
                  <Progress value={metrics?.clickRate || 0} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Delete Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics?.deleteRate || 0)}
                    </span>
                  </div>
                  <Progress value={metrics?.deleteRate || 0} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Delivery Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics?.deliveryRate || 0)}
                    </span>
                  </div>
                  <Progress value={metrics?.deliveryRate || 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights and Recommendations */}
          {metrics?.insights && (
            <Card>
              <CardHeader>
                <CardTitle>Insights & Recommendations</CardTitle>
                <CardDescription>
                  AI-powered analysis of notification patterns and suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.insights.patterns.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Identified Patterns
                      </h4>
                      <ul className="space-y-1">
                        {metrics.insights.patterns.map((pattern, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                            {pattern}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {metrics.insights.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Improvement Suggestions
                      </h4>
                      <ul className="space-y-1">
                        {metrics.insights.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {metrics.insights.performanceIssues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Performance Issues
                      </h4>
                      <ul className="space-y-1">
                        {metrics.insights.performanceIssues.map((issue, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement Details</CardTitle>
              <CardDescription>
                Individual user notification engagement metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userEngagement.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{user.userName}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.totalNotifications} notifications • Avg read time: {user.averageReadTime}s
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-sm font-medium">{formatPercentage(user.readRate)}</p>
                        <p className="text-xs text-muted-foreground">Read</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{formatPercentage(user.clickRate)}</p>
                        <p className="text-xs text-muted-foreground">Click</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{formatPercentage(user.deleteRate)}</p>
                        <p className="text-xs text-muted-foreground">Delete</p>
                      </div>
                      <Badge variant={user.readRate > 80 ? "default" : user.readRate > 60 ? "secondary" : "destructive"}>
                        {user.readRate > 80 ? "High" : user.readRate > 60 ? "Medium" : "Low"} Engagement
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  System performance and reliability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Average Delivery Time</span>
                  <Badge variant="outline">1.2s</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Failed Deliveries</span>
                  <Badge variant="destructive">0.3%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Retry Success Rate</span>
                  <Badge variant="default">98.7%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Queue Processing Time</span>
                  <Badge variant="outline">0.8s</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Real-time system status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">WebSocket Connections</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database Status</span>
                  <Badge variant="default">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Hit Rate</span>
                  <Badge variant="outline">94.2%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <Badge variant="secondary">67%</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Types Distribution</CardTitle>
                <CardDescription>
                  Breakdown by notification type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics?.typeBreakdown || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(metrics?.typeBreakdown || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Type Performance</CardTitle>
                <CardDescription>
                  Engagement rates by notification type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.typeBreakdown.map((type, index) => (
                    <div key={type.type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{type.type}</span>
                        <span className="text-sm text-muted-foreground">
                          {type.count} notifications
                        </span>
                      </div>
                      <Progress value={type.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};