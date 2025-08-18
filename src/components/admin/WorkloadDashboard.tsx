import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Activity,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  BarChart3,
  Zap,
  Settings,
  Loader2,
  Target,
  Award,
  BookOpen
} from 'lucide-react';
import { assignmentService, type AgentMetrics } from '@/lib/assignmentService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { SafeTranslation } from '@/components/ui/SafeTranslation';
import { useTranslation } from 'react-i18next';

export const WorkloadDashboard = () => {
  const [agents, setAgents] = useState<AgentMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    loadWorkloadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadWorkloadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWorkloadData = async () => {
    try {
      setError(null);
      const agentMetrics = await assignmentService.getAvailableAgents();
      setAgents(agentMetrics);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading workload data:', err);
      setError('Failed to load workload data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRebalance = async () => {
    setIsRebalancing(true);
    try {
      const result = await assignmentService.rebalanceWorkload();
      
      if (result.success) {
        toast({
          title: t('admin.workloadDashboard.workloadRebalanced'),
          description: result.message,
        });
        
        // Refresh data after rebalancing
        await loadWorkloadData();
      } else {
        toast({
          title: t('admin.workloadDashboard.rebalancingFailed'),
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('admin.workloadDashboard.rebalancingError'),
        variant: "destructive",
      });
    } finally {
      setIsRebalancing(false);
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'text-green-600';
      case 'busy': return 'text-yellow-600';
      case 'away': return 'text-orange-600';
      case 'offline': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAvailabilityIcon = (availability: string) => {
    switch (availability) {
      case 'available': return <CheckCircle className="h-4 w-4" />;
      case 'busy': return <Clock className="h-4 w-4" />;
      case 'away': return <AlertTriangle className="h-4 w-4" />;
      case 'offline': return <User className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getWorkloadStatus = (agent: AgentMetrics) => {
    const utilizationRate = agent.currentWorkload / agent.maxConcurrentTickets;
    
    if (utilizationRate >= 0.9) return { status: 'overloaded', color: 'bg-red-500', text: t('admin.workloadDashboard.overloaded', 'Overloaded') };
    if (utilizationRate >= 0.7) return { status: 'busy', color: 'bg-yellow-500', text: t('admin.workloadDashboard.busy', 'Busy') };
    if (utilizationRate >= 0.3) return { status: 'moderate', color: 'bg-blue-500', text: t('admin.workloadDashboard.moderate', 'Moderate') };
    return { status: 'light', color: 'bg-green-500', text: t('admin.workloadDashboard.light', 'Light') };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateTeamStats = () => {
    if (agents.length === 0) return { totalTickets: 0, averageUtilization: 0, availableAgents: 0 };
    
    const totalTickets = agents.reduce((sum, agent) => sum + agent.currentWorkload, 0);
    const totalCapacity = agents.reduce((sum, agent) => sum + agent.maxConcurrentTickets, 0);
    const averageUtilization = totalCapacity > 0 ? (totalTickets / totalCapacity) * 100 : 0;
    const availableAgents = agents.filter(agent => agent.availability === 'available').length;
    
    return { totalTickets, averageUtilization, availableAgents };
  };

  const teamStats = calculateTeamStats();

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <SafeTranslation i18nKey="admin.workloadDashboard.accessDenied" fallback="Access denied. This dashboard is only available to administrators." />
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            <SafeTranslation i18nKey="admin.workloadDashboard.title" fallback="Workload Dashboard" />
          </h1>
          <p className="text-muted-foreground">
            <SafeTranslation i18nKey="admin.workloadDashboard.description" fallback="Monitor and manage agent workload distribution" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadWorkloadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            <SafeTranslation i18nKey="admin.workloadDashboard.refresh" fallback="Refresh" />
          </Button>
          <Button onClick={handleRebalance} disabled={isRebalancing || agents.length < 2}>
            {isRebalancing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            <SafeTranslation i18nKey="admin.workloadDashboard.rebalance" fallback="Rebalance" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <SafeTranslation i18nKey="admin.workloadDashboard.totalActiveTickets" fallback="Total Active Tickets" />
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              <SafeTranslation i18nKey="admin.workloadDashboard.acrossAllAgents" fallback="Across all agents" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <SafeTranslation i18nKey="admin.workloadDashboard.teamUtilization" fallback="Team Utilization" />
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(teamStats.averageUtilization)}%</div>
            <Progress value={teamStats.averageUtilization} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <SafeTranslation i18nKey="admin.workloadDashboard.availableAgents" fallback="Available Agents" />
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.availableAgents}</div>
            <p className="text-xs text-muted-foreground">
              <SafeTranslation 
                i18nKey="admin.workloadDashboard.outOfTotal" 
                fallback="Out of {{total}} total"
                values={{ total: agents.length }}
              />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Details */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <SafeTranslation i18nKey="admin.workloadDashboard.overview" fallback="Overview" />
          </TabsTrigger>
          <TabsTrigger value="performance">
            <SafeTranslation i18nKey="admin.workloadDashboard.performance" fallback="Performance" />
          </TabsTrigger>
          <TabsTrigger value="categories">
            <SafeTranslation i18nKey="admin.workloadDashboard.categories" fallback="Category Expertise" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>
                  <SafeTranslation i18nKey="admin.workloadDashboard.loadingAgentData" fallback="Loading agent data..." />
                </span>
              </div>
            ) : agents.length === 0 ? (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  <SafeTranslation i18nKey="admin.workloadDashboard.noAgentsFound" fallback="No agents found. Make sure there are users with agent or admin roles." />
                </AlertDescription>
              </Alert>
            ) : (
              agents.map((agent) => {
                const utilizationRate = (agent.currentWorkload / agent.maxConcurrentTickets) * 100;
                const workloadStatus = getWorkloadStatus(agent);
                
                return (
                  <Card key={agent.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={agent.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(agent.full_name)}</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold truncate">{agent.full_name}</h3>
                            <Badge variant="outline" className="text-xs capitalize">
                              {agent.role}
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${workloadStatus.color} text-white`}
                            >
                              {workloadStatus.text}
                            </Badge>
                          </div>
                          
                          <div className={`flex items-center gap-1 text-sm mb-3 ${getAvailabilityColor(agent.availability)}`}>
                            {getAvailabilityIcon(agent.availability)}
                            <span className="capitalize">{agent.availability}</span>
                            <span className="text-muted-foreground ml-2">
                              {agent.email}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">
                                <SafeTranslation i18nKey="admin.workloadDashboard.currentWorkload" fallback="Current Workload" />
                              </div>
                              <div className="font-medium">
                                {agent.currentWorkload}/{agent.maxConcurrentTickets} <SafeTranslation i18nKey="admin.workloadDashboard.tickets" fallback="tickets" />
                              </div>
                              <Progress value={utilizationRate} className="mt-1 h-2" />
                            </div>
                            
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">
                                <SafeTranslation i18nKey="admin.workloadDashboard.avgResolution" fallback="Avg Resolution" />
                              </div>
                              <div className="font-medium">{Math.round(agent.averageResolutionTime)}h</div>
                            </div>
                            
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">
                                <SafeTranslation i18nKey="admin.workloadDashboard.resolutionRate" fallback="Resolution Rate" />
                              </div>
                              <div className="font-medium">{Math.round(agent.resolutionRate * 100)}%</div>
                            </div>
                            
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">
                                <SafeTranslation i18nKey="admin.workloadDashboard.satisfaction" fallback="Satisfaction" />
                              </div>
                              <div className="font-medium">{agent.customerSatisfactionScore.toFixed(1)}/5</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4">
            {agents
              .sort((a, b) => b.resolutionRate - a.resolutionRate)
              .map((agent, index) => (
                <Card key={agent.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-muted-foreground">
                          #{index + 1}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={agent.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(agent.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{agent.full_name}</h3>
                          <p className="text-sm text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-3 gap-4 ml-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round(agent.resolutionRate * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Resolution Rate</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round(agent.averageResolutionTime)}h
                          </div>
                          <div className="text-xs text-muted-foreground">Avg Resolution</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {agent.customerSatisfactionScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Satisfaction</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4">
            {agents.map((agent) => {
              const categoryCount = Object.keys(agent.categoryExpertise || {}).length;
              const subcategoryCount = Object.keys(agent.subcategoryExpertise || {}).length;
              const expertCategories = Object.entries(agent.categoryExpertise || {}).filter(([_, score]) => score > 0.8);
              
              return (
                <Card key={agent.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={agent.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(agent.full_name)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate">{agent.full_name}</h3>
                          <Badge variant="outline" className="text-xs capitalize">
                            {agent.role}
                          </Badge>
                          {expertCategories.length > 0 && (
                            <Badge variant="default" className="text-xs bg-yellow-500">
                              <Award className="h-3 w-3 mr-1" />
                              Expert
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-blue-500" />
                            <div>
                              <div className="font-medium">{categoryCount}</div>
                              <div className="text-xs text-muted-foreground">Categories</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-green-500" />
                            <div>
                              <div className="font-medium">{subcategoryCount}</div>
                              <div className="text-xs text-muted-foreground">Subcategories</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <div>
                              <div className="font-medium">{expertCategories.length}</div>
                              <div className="text-xs text-muted-foreground">Expert Level</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Category Expertise Display */}
                        {categoryCount > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">Category Expertise</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(agent.categoryExpertise || {})
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 6)
                                .map(([categoryId, score]) => {
                                  const getExpertiseLevel = (score: number) => {
                                    if (score > 0.8) return { level: 'Expert', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
                                    if (score > 0.6) return { level: 'Advanced', color: 'bg-blue-100 text-blue-800 border-blue-200' };
                                    if (score > 0.4) return { level: 'Intermediate', color: 'bg-green-100 text-green-800 border-green-200' };
                                    return { level: 'Basic', color: 'bg-gray-100 text-gray-800 border-gray-200' };
                                  };
                                  
                                  const expertise = getExpertiseLevel(score);
                                  
                                  return (
                                    <Badge 
                                      key={categoryId} 
                                      variant="outline" 
                                      className={`text-xs ${expertise.color}`}
                                    >
                                      Category {categoryId.slice(-4)} - {expertise.level}
                                    </Badge>
                                  );
                                })}
                              {Object.keys(agent.categoryExpertise || {}).length > 6 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(agent.categoryExpertise || {}).length - 6} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Specializations */}
                        {agent.specializations && agent.specializations.length > 0 && (
                          <div className="mt-3">
                            <div className="text-sm font-medium mb-2">Specializations</div>
                            <div className="flex flex-wrap gap-2">
                              {agent.specializations.slice(0, 4).map((spec, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {spec}
                                </Badge>
                              ))}
                              {agent.specializations.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{agent.specializations.length - 4} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Customer History */}
                        <div className="mt-3 pt-3 border-t">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Customers Served</div>
                              <div className="font-medium">{agent.customerHistory?.totalCustomersServed || 0}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Repeat Rate</div>
                              <div className="font-medium">
                                {Math.round((agent.customerHistory?.repeatCustomerRate || 0) * 100)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Avg Satisfaction</div>
                              <div className="font-medium">
                                {(agent.customerHistory?.averageCustomerSatisfaction || 0).toFixed(1)}/5
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        <SafeTranslation 
          i18nKey="admin.workloadDashboard.lastUpdated" 
          fallback="Last updated: {{time}}"
          values={{ time: lastUpdated.toLocaleTimeString() }}
        />
      </div>
    </div>
  );
};