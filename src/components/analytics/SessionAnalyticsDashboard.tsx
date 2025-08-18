import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, RefreshCw, TrendingUp, TrendingDown, Activity, Users, Clock, Wifi, AlertTriangle } from 'lucide-react';
import { logAggregationService, SessionAnalytics, ConnectionAnalytics, UserBehaviorAnalytics, SystemPerformanceAnalytics } from '@/services/LogAggregationService';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsReport {
  session: SessionAnalytics;
  connection: ConnectionAnalytics;
  behavior: UserBehaviorAnalytics;
  performance: SystemPerformanceAnalytics;
  summary: {
    totalEvents: number;
    totalUsers: number;
    reportPeriod: string;
    generatedAt: Date;
  };
}

export function SessionAnalyticsDashboard() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const { toast } = useToast();

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      const analyticsReport = await logAggregationService.generateAnalyticsReport(
        startDate,
        endDate,
        selectedUserId === 'all' ? undefined : selectedUserId
      );

      setReport(analyticsReport);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedUserId]);

  const exportReport = () => {
    if (!report) return;

    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `session-analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'text-green-600' : 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
        <p>No analytics data available</p>
        <Button onClick={loadAnalytics} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Session Analytics</h2>
          <p className="text-muted-foreground">
            Monitor session persistence and connection performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.session.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {report.summary.totalUsers} unique users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(report.session.averageSessionDuration)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Quality</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.connection.averageLatency}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average latency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(100 - report.performance.errorRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              Success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="session" className="space-y-4">
        <TabsList>
          <TabsTrigger value="session">Session Management</TabsTrigger>
          <TabsTrigger value="connection">Connection & Sync</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
          <TabsTrigger value="performance">System Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="session" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Session Reliability</CardTitle>
                <CardDescription>Session management performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Token Refresh Success Rate</span>
                  <Badge variant={report.session.tokenRefreshSuccessRate > 95 ? 'default' : 'destructive'}>
                    {formatPercentage(report.session.tokenRefreshSuccessRate)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Session Expiration Rate</span>
                  <Badge variant={report.session.sessionExpirationRate < 5 ? 'default' : 'destructive'}>
                    {formatPercentage(report.session.sessionExpirationRate)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Error Recovery Success Rate</span>
                  <Badge variant={report.session.errorRecoverySuccessRate > 90 ? 'default' : 'destructive'}>
                    {formatPercentage(report.session.errorRecoverySuccessRate)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Issues</CardTitle>
                <CardDescription>Network and connectivity metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Connection Issue Frequency</span>
                  <Badge variant={report.session.connectionIssueFrequency < 10 ? 'default' : 'destructive'}>
                    {formatPercentage(report.session.connectionIssueFrequency)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Offline Mode Usage</span>
                  <Badge variant="secondary">
                    {formatPercentage(report.session.offlineModeUsage)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connection" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Connection Performance</CardTitle>
                <CardDescription>Network connectivity and latency metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Average Latency</span>
                  <Badge variant={report.connection.averageLatency < 500 ? 'default' : 'destructive'}>
                    {report.connection.averageLatency}ms
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connection Drop Rate</span>
                  <Badge variant={report.connection.connectionDropRate < 5 ? 'default' : 'destructive'}>
                    {formatPercentage(report.connection.connectionDropRate)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reconnection Success Rate</span>
                  <Badge variant={report.connection.reconnectionSuccessRate > 90 ? 'default' : 'destructive'}>
                    {formatPercentage(report.connection.reconnectionSuccessRate)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Performance</CardTitle>
                <CardDescription>Data synchronization metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Sync Failure Rate</span>
                  <Badge variant={report.connection.syncFailureRate < 5 ? 'default' : 'destructive'}>
                    {formatPercentage(report.connection.syncFailureRate)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Offline Duration</span>
                  <Badge variant="secondary">
                    {formatDuration(report.connection.offlineDuration)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Most Visited Pages</CardTitle>
                <CardDescription>Top pages by visit count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.behavior.mostVisitedPages.slice(0, 5).map((page, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm truncate">{page.page}</span>
                      <Badge variant="secondary">{page.visits}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Actions</CardTitle>
                <CardDescription>Common user behaviors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Session Extension Rate</span>
                  <Badge variant="secondary">
                    {formatPercentage(report.behavior.sessionExtensionRate)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Manual Sync Usage</span>
                  <Badge variant="secondary">
                    {formatPercentage(report.behavior.manualSyncUsage)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Error Recovery Attempts</span>
                  <Badge variant="secondary">
                    {report.behavior.errorRecoveryAttempts}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>Overall system health metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Average Response Time</span>
                  <Badge variant={report.performance.averageResponseTime < 1000 ? 'default' : 'destructive'}>
                    {report.performance.averageResponseTime}ms
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Error Rate</span>
                  <Badge variant={report.performance.errorRate < 5 ? 'default' : 'destructive'}>
                    {formatPercentage(report.performance.errorRate)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cache Hit Rate</span>
                  <Badge variant={report.performance.cacheHitRate > 80 ? 'default' : 'secondary'}>
                    {formatPercentage(report.performance.cacheHitRate)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Background Operations</CardTitle>
                <CardDescription>Background task performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Background Sync Efficiency</span>
                  <Badge variant={report.performance.backgroundSyncEfficiency > 90 ? 'default' : 'destructive'}>
                    {formatPercentage(report.performance.backgroundSyncEfficiency)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Memory Usage</span>
                  <Badge variant="secondary">
                    {report.performance.memoryUsage}MB
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Report Info */}
      <Card>
        <CardHeader>
          <CardTitle>Report Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Report Period:</span>
              <span>{report.summary.reportPeriod}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Events:</span>
              <span>{report.summary.totalEvents.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Generated At:</span>
              <span>{report.summary.generatedAt.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}