import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Settings,
  Target,
  Timer,
  Pause,
  MessageCircle,
  RefreshCw
} from "lucide-react";
import { DatabaseService, SLAStatus } from "@/lib/database";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SLAMonitorProps {
  ticketId: string;
  priority: string;
  createdAt: string;
  status: string;
  userRole?: "user" | "agent" | "admin";
  resolvedAt?: string;
  closedAt?: string;
  ticket?: any; // Full ticket object for enhanced tracking
  refreshKey?: number; // Add refresh trigger
}

export const SLAMonitor = ({ 
  ticketId, 
  priority, 
  createdAt, 
  status, 
  userRole = "user",
  resolvedAt,
  closedAt,
  ticket,
  refreshKey
}: SLAMonitorProps) => {
  const [slaStatus, setSlaStatus] = useState<SLAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstResponseTime, setFirstResponseTime] = useState<Date | null>(null);
  const { t, i18n } = useTranslation();

  // Function to refresh SLA data
  const refreshSLAData = async () => {
    try {
      setLoading(true);
      console.log(`🔄 SLA Monitor: Refreshing data for ticket ${ticketId}`);
      
      // Calculate comprehensive SLA status
      const ticketData = ticket || {
        id: ticketId,
        priority,
        created_at: createdAt,
        status,
        resolved_at: resolvedAt,
        closed_at: closedAt
      };
      
      const slaData = await DatabaseService.calculateTicketSLAStatus(ticketData);
      console.log(`📊 SLA Monitor: Calculated SLA status:`, slaData);
      setSlaStatus(slaData);
      
      // Get first response time
      const firstResponse = await DatabaseService.detectFirstAgentResponse(ticketId);
      console.log(`🕐 SLA Monitor: First response time:`, firstResponse);
      setFirstResponseTime(firstResponse);
      
    } catch (error) {
      console.error('Error loading SLA data:', error);
      // Fallback to basic calculation if enhanced fails
      setBasicSLAStatus();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSLAData();
  }, [ticketId, priority, createdAt, status, resolvedAt, closedAt, ticket, refreshKey]);

  // Auto-refresh every 10 seconds if ticket is active and no first response yet
  useEffect(() => {
    if (!slaStatus?.isActive || firstResponseTime) return;
    
    console.log(`⏲️ SLA Monitor: Setting up auto-refresh for ticket ${ticketId}`);
    const interval = setInterval(() => {
      console.log(`🔄 SLA Monitor: Auto-refreshing (waiting for first response)`);
      refreshSLAData();
    }, 10000); // 10 seconds - mais frequente para detectar mudanças

    return () => {
      console.log(`🛑 SLA Monitor: Clearing auto-refresh for ticket ${ticketId}`);
      clearInterval(interval);
    };
  }, [slaStatus?.isActive, firstResponseTime, ticketId]);

  // Force refresh when comments/messages are added (immediate update)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      console.log(`⚡ SLA Monitor: Forced refresh triggered by refreshKey: ${refreshKey}`);
      // Add small delay to ensure database operations are complete
      setTimeout(() => {
        refreshSLAData();
      }, 500);
    }
  }, [refreshKey]);

  const setBasicSLAStatus = () => {
    // Fallback basic SLA calculation
         const defaultRule = { 
       id: 'default',
       name: 'Default SLA',
       priority: priority,
       response_time: 24, 
       resolution_time: 72,
       is_active: true,
       created_at: new Date().toISOString()
     };
    const created = new Date(createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const isActive = !['resolved', 'closed'].includes(status);

    setSlaStatus({
      ticketId,
      responseStatus: isActive ? (hoursElapsed > 24 ? 'overdue' : 'ok') : 'met',
      resolutionStatus: isActive ? (hoursElapsed > 72 ? 'overdue' : 'ok') : 'met',
      responseTimeElapsed: hoursElapsed,
      totalTimeElapsed: hoursElapsed,
      firstResponseAt: null,
      slaRule: defaultRule,
      isActive
    });
  };

  const formatTimeRemaining = (elapsed: number, target: number, statusType: 'response' | 'resolution' = 'response') => {
    const remaining = target - elapsed;
    
    // Para tempo de resposta: verificar se primeira resposta foi dada E se foi dentro do prazo
    if (statusType === 'response') {
      if (firstResponseTime) {
        // Primeira resposta foi dada - verificar se foi dentro do prazo
        const responseTime = new Date(firstResponseTime);
        const createdTime = new Date(createdAt);
        const responseHours = (responseTime.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
        
        if (responseHours <= target) {
          return t('sla.target_met');
        } else {
          return t('sla.resolved_late'); // Respondido, mas fora do prazo
        }
      } else {
        // Ainda não respondeu - verificar se já passou do prazo
        if (remaining <= 0) return t('sla.overdue');
      }
    }
    
    // Para tempo de resolução: só mostra "Meta Atingida" se ticket foi realmente resolvido dentro do prazo
    if (statusType === 'resolution') {
      if (status === 'resolved' || status === 'closed') {
        // Ticket foi resolvido - verificar se foi dentro do prazo
        const resolutionTime = resolvedAt ? new Date(resolvedAt) : new Date();
        const createdTime = new Date(createdAt);
        const resolutionHours = (resolutionTime.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
        
        if (resolutionHours <= target) {
          return t('sla.target_met');
        } else {
          return t('sla.resolved_late');
        }
      }
    }
    
    if (remaining <= 0) return t('sla.overdue');
    if (remaining < 1) return `${Math.round(remaining * 60)}${t('sla.minutes_short')}`;
    if (remaining < 24) return `${Math.round(remaining)}${t('sla.hours_short')}`;
    return `${Math.round(remaining / 24)}${t('sla.days_short')}`;
  };

  const getResponseDisplayStatus = () => {
    if (!firstResponseTime) {
      // Ainda não respondeu - verificar se já passou do prazo
      const target = slaStatus?.slaRule?.response_time as number || 24;
      if (slaStatus?.responseTimeElapsed && slaStatus.responseTimeElapsed > target) {
        return 'missed'; // Não respondeu e já passou do prazo
      }
      return slaStatus?.responseStatus || 'in_progress';
    } else {
      // Já respondeu - verificar se foi dentro do prazo
      const responseTime = new Date(firstResponseTime);
      const createdTime = new Date(createdAt);
      const responseHours = (responseTime.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
      const target = slaStatus?.slaRule?.response_time as number || 24;
      
      if (responseHours <= target) {
        return 'met';
      } else {
        return 'completed_late';
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
      case "warning": return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30";
      case "overdue": return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
      case "met": return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
      case "completed_late": return "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30";
      case "missed": return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
      case "stopped": return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
      default: return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  const getStatusIcon = () => {
    if (resolvedAt) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (getResponseDisplayStatus() === 'overdue') return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return <Timer className="h-5 w-5 text-blue-500" />;
  };

  const getStatusText = () => {
    if (resolvedAt) return 'SLA Met';
    if (getResponseDisplayStatus() === 'overdue') return 'SLA Breached';
    return 'SLA Active';
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const getProgressValue = (elapsed: number, target: number) => {
    if (!slaStatus?.isActive) return 100;
    return Math.max(0, Math.min(100, ((target - elapsed) / target) * 100));
  };

  if (loading) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
            <Target className="h-5 w-5 animate-pulse" />
            {t('common.loading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!slaStatus) {
    return null;
  }

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
            <Target className="h-5 w-5" />
            {t('sla.monitor')}
          {!slaStatus.isActive && (
            <Badge className="text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800">
              <Pause className="h-3 w-3 mr-1" />
              {t('sla.stopped')}
            </Badge>
          )}
          {(userRole === 'agent' || userRole === 'admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshSLAData}
              disabled={loading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SLA Overview - Clean Modern Design */}
        <div className="space-y-4">
          {/* Response Time Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('sla.response_time')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('sla.first_response_target')}</p>
                  </div>
                </div>
                <Badge className={`${getStatusColor(getResponseDisplayStatus())} font-medium`}>
                  {getResponseDisplayStatus() === 'met' ? t('sla.status.met') : 
                   getResponseDisplayStatus() === 'overdue' ? t('sla.status.overdue') :
                   getResponseDisplayStatus() === 'completed_late' ? t('sla.status.completed_late') :
                   getResponseDisplayStatus() === 'missed' ? t('sla.status.missed') :
                   getResponseDisplayStatus() === 'warning' ? t('sla.status.warning') : t('sla.status.in_progress')}
                </Badge>
              </div>
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800/50">
              {firstResponseTime ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">{t('sla.responded_at')} {firstResponseTime.toLocaleString(i18n.language)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{t('sla.time_elapsed')}: {Math.round(slaStatus.responseTimeElapsed)}h</span>
                    <span>{t('sla.target')}: {slaStatus.slaRule.response_time as number}h</span>
                  </div>
                  <Progress value={100} className="h-2 bg-green-100 dark:bg-green-900/30" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{t('sla.waiting_first_response')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{t('sla.elapsed')}: {Math.round(slaStatus.responseTimeElapsed)}h</span>
                    <span>{t('sla.remaining')}: {formatTimeRemaining(slaStatus.responseTimeElapsed, slaStatus.slaRule.response_time as number, 'response')}</span>
                  </div>
                  <Progress 
                    value={getProgressValue(slaStatus.responseTimeElapsed, slaStatus.slaRule.response_time as number)}
                    className={cn(
                      'h-2',
                      resolvedAt ? '[&>div]:bg-emerald-500' : 
                      getResponseDisplayStatus() === 'overdue' ? '[&>div]:bg-red-500' : 
                      '[&>div]:bg-blue-500'
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Resolution Time Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('sla.resolution_time')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('sla.resolution_target')}</p>
                  </div>
                </div>
                <Badge className={`${getStatusColor(slaStatus.resolutionStatus)} font-medium`}>
                  {(status === 'resolved' || status === 'closed') ? 
                    (formatTimeRemaining(slaStatus.totalTimeElapsed, slaStatus.slaRule.resolution_time as number, 'resolution') === t('sla.target_met') ? t('sla.status.met') : t('sla.status.completed_late')) :
                   slaStatus.resolutionStatus === 'overdue' ? t('sla.status.overdue') :
                   slaStatus.resolutionStatus === 'warning' ? t('sla.status.warning') : t('sla.status.in_progress')}
                </Badge>
              </div>
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800/50">
              {(status === 'resolved' || status === 'closed') ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">{t('sla.resolved_at')} {resolvedAt ? new Date(resolvedAt).toLocaleString(i18n.language) : t('common.not_available')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{t('sla.total_time')}: {Math.round(slaStatus.totalTimeElapsed)}h</span>
                    <span>{t('sla.target')}: {slaStatus.slaRule.resolution_time as number}h</span>
                  </div>
                  <Progress value={100} className="h-2 bg-green-100 dark:bg-green-900/30" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Timer className="h-4 w-4" />
                    <span className="font-medium">{t('sla.in_progress')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{t('sla.elapsed')}: {Math.round(slaStatus.totalTimeElapsed)}h</span>
                    <span>{t('sla.remaining')}: {formatTimeRemaining(slaStatus.totalTimeElapsed, slaStatus.slaRule.resolution_time as number, 'resolution')}</span>
                  </div>
                  <Progress 
                    value={getProgressValue(slaStatus.totalTimeElapsed, slaStatus.slaRule.resolution_time as number)}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SLA Details */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('tickets.priority')}:</span>
              <p className="font-medium dark:text-gray-200 capitalize">{t(`priority.${priority}`)}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('tickets.createdAt')}:</span>
              <p className="font-medium dark:text-gray-200">
                {new Date(createdAt).toLocaleString(i18n.language)}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('sla.time_elapsed')}:</span>
              <p className="font-medium dark:text-gray-200">
                {Math.round(slaStatus.totalTimeElapsed)}h
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('sla.status_label')}:</span>
              <p className="font-medium dark:text-gray-200">
                {slaStatus.isActive ? t('sla.active') : t('sla.completed')}
              </p>
            </div>
          </div>
        </div>

        <TooltipProvider>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={cn(
                  'font-medium',
                  resolvedAt ? 'text-emerald-500' : getResponseDisplayStatus() === 'overdue' ? 'text-red-500' : 'text-blue-500'
                )}>
                  {getStatusText()}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(slaStatus.responseTimeElapsed)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Time elapsed since ticket creation</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Response Time</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-zinc-400">{formatDuration(slaStatus.slaRule.response_time as number)} target</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Target response time based on priority</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Progress
                value={getProgressValue(slaStatus.responseTimeElapsed, slaStatus.slaRule.response_time as number)}
                className={cn(
                  'h-2',
                  resolvedAt ? '[&>div]:bg-emerald-500' : 
                  getResponseDisplayStatus() === 'overdue' ? '[&>div]:bg-red-500' : 
                  '[&>div]:bg-blue-500'
                )}
              />
              {slaStatus.isActive && (
                <div className="flex justify-end">
                  <span className="text-xs text-zinc-500">
                    {getResponseDisplayStatus() === 'overdue'
                      ? `Overdue by ${formatDuration(slaStatus.responseTimeElapsed - Number(slaStatus.slaRule.response_time))}`
                      : `${formatDuration(Number(slaStatus.slaRule.response_time) - slaStatus.responseTimeElapsed)} remaining`}
                  </span>
                </div>
              )}
            </div>

            {resolvedAt && (
              <div className="flex items-center gap-2 text-sm text-emerald-500">
                <CheckCircle className="h-4 w-4" />
                <span>Resolved in {formatDuration(Math.round((new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60)))}</span>
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
