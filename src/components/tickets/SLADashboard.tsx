import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Target,
  Timer,
  Zap,
  Activity
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { Link } from "react-router-dom";

interface SLAOverview {
  totalTickets: number;
  slaCompliant: number;
  slaWarnings: number;
  slaBreaches: number;
  complianceRate: number;
  avgResponseTime: number;
  avgResolutionTime: number;
}

interface SLADashboardProps {
  userRole?: "user" | "agent" | "admin";
  userId?: string;
}

export const SLADashboard = ({ userRole = "user", userId }: SLADashboardProps) => {
  const [slaOverview, setSlaOverview] = useState<SLAOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [criticalTickets, setCriticalTickets] = useState<any[]>([]);

  useEffect(() => {
    loadSLAOverview();
  }, [userRole, userId]);

  const loadSLAOverview = async () => {
    try {
      setLoading(true);

      // Load SLA warnings and breaches
      const slaWarnings = await DatabaseService.checkSLAWarnings();
      
      // Get ticket statistics
      const ticketStats = await DatabaseService.getTicketStatistics(userId, userRole);
      
      // Calculate SLA overview
      const totalTickets = ticketStats.totalTickets || 0;
      const complianceRate = totalTickets > 0 ? 
        ((totalTickets - slaWarnings.warnings - slaWarnings.breaches) / totalTickets) * 100 : 100;

      setSlaOverview({
        totalTickets,
        slaCompliant: totalTickets - slaWarnings.warnings - slaWarnings.breaches,
        slaWarnings: slaWarnings.warnings,
        slaBreaches: slaWarnings.breaches,
        complianceRate,
        avgResponseTime: 2.5, // This would come from actual SLA calculations
        avgResolutionTime: 18.2 // This would come from actual SLA calculations
      });

      // Get critical tickets (those with SLA issues)
      if (userRole === 'agent' || userRole === 'admin') {
        const tickets = await DatabaseService.getTickets({
          statusFilter: 'open,in_progress',
          limit: 5,
          userRole
        });
        
        // Filter tickets that might have SLA issues (simplified check)
        const critical = tickets.filter(ticket => {
          const hoursElapsed = (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
          const priorityThresholds: Record<string, number> = {
            urgent: 1,
            high: 2,
            medium: 4,
            low: 8
          };
          return hoursElapsed > (priorityThresholds[ticket.priority] || 4);
        }).slice(0, 3);
        
        setCriticalTickets(critical);
      }

    } catch (error) {
      console.error('Error loading SLA overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
    if (rate >= 85) return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30";
    return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
  };

  const getComplianceIcon = (rate: number) => {
    if (rate >= 95) return <CheckCircle className="h-4 w-4" />;
    if (rate >= 85) return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
            <Target className="h-5 w-5 animate-pulse" />
            SLA Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!slaOverview) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* SLA Overview Card */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
            <Target className="h-5 w-5" />
            SLA Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SLA Compliance Rate */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge className={getComplianceColor(slaOverview.complianceRate)}>
                <div className="flex items-center gap-1">
                  {getComplianceIcon(slaOverview.complianceRate)}
                  {slaOverview.complianceRate.toFixed(1)}% Compliance
                </div>
              </Badge>
            </div>
            <Progress 
              value={slaOverview.complianceRate} 
              className="h-3 bg-gray-200 dark:bg-gray-700" 
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Target: 95% SLA Compliance
            </p>
          </div>

          {/* SLA Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-700 dark:text-green-300">
                {slaOverview.slaCompliant}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">Compliant</div>
            </div>

            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                {slaOverview.slaWarnings}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Warnings</div>
            </div>

            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <Clock className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-red-700 dark:text-red-300">
                {slaOverview.slaBreaches}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">Breaches</div>
            </div>

            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                {slaOverview.totalTickets}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Total</div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium dark:text-gray-200">Avg Response</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {slaOverview.avgResponseTime}h
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <Timer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-medium dark:text-gray-200">Avg Resolution</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {slaOverview.avgResolutionTime}h
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Tickets - Agent/Admin Only */}
      {(userRole === 'agent' || userRole === 'admin') && criticalTickets.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Critical SLA Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalTickets.map((ticket) => {
              const hoursElapsed = (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
              
              return (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {ticket.priority}
                      </Badge>
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">
                        #{ticket.ticket_number}
                      </span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1 truncate">
                      {ticket.title}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Elapsed: {Math.round(hoursElapsed)}h
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                    asChild
                  >
                    <Link to={`/tickets/${ticket.id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              );
            })}

            <div className="pt-2 border-t border-red-200 dark:border-red-800">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                asChild
              >
                <Link to="/tickets?filter=critical">
                  View All Critical Tickets
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 