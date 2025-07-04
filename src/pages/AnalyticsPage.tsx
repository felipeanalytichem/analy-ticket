import { useAuth } from "@/contexts/AuthContext";
import { DetailedAnalytics } from "@/components/dashboard/DetailedAnalytics";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AdvancedStatsCards } from "@/components/dashboard/AdvancedStatsCards";
import { TicketCharts } from "@/components/dashboard/TicketCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Clock, 
  Target, 
  Users,
  Shield,
  AlertTriangle 
} from "lucide-react";

const AnalyticsPage = () => {
  const { userProfile } = useAuth();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";

  // Show access denied for regular users
  if (userRole === "user") {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Advanced analytics are only available to agents and administrators.
            </p>
            <Badge variant="secondary" className="px-3 py-1">
              <Users className="h-4 w-4 mr-1" />
              Contact your administrator
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              Advanced Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Comprehensive performance insights and detailed metrics for {userRole}s
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1">
              <Activity className="h-4 w-4 mr-1" />
              Live Data
            </Badge>
            <Badge variant={userRole === "admin" ? "default" : "secondary"} className="px-3 py-1">
              <Shield className="h-4 w-4 mr-1" />
              {userRole === "admin" ? "Full Access" : "Agent View"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="h-6 w-6 text-blue-500" />
          Performance Overview
        </h2>
        <StatsCards />
      </div>

      {/* Main Detailed Analytics */}
      <DetailedAnalytics />

      {/* Additional Analytics Sections */}
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-500" />
            Advanced KPIs & Metrics
          </h2>
          <AdvancedStatsCards />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-purple-500" />
            Visual Analytics & Charts
          </h2>
          <TicketCharts />
        </div>
      </div>

      {/* Analytics Footer */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Analytics Insights
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                Data is updated in real-time and reflects current system performance. 
                Use these insights to optimize your team's efficiency and improve customer satisfaction.
              </p>
            </div>
            <div className="text-blue-600 dark:text-blue-400">
              <Activity className="h-12 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage; 