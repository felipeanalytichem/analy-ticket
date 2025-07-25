import { useAuth } from "@/contexts/AuthContext";
import { DetailedAnalytics } from "@/components/dashboard/DetailedAnalytics";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AdvancedStatsCards } from "@/components/dashboard/AdvancedStatsCards";
import { TicketCharts } from "@/components/dashboard/TicketCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Clock, 
  Target, 
  Users,
  Shield
} from "lucide-react";

const AnalyticsPage = () => {
  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";

  // Show access denied for regular users
  if (userRole === "user") {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
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
      {/* Enhanced Page Header with Mobile-First Design */}
      <header className="border-b border-gray-200 dark:border-gray-800 pb-6">
        <div className={cn(
          "flex gap-4",
          isMobile ? "flex-col" : "flex-row items-center justify-between"
        )}>
          {/* Title Section with Improved Typography Hierarchy */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <BarChart3 className={cn(
                  "text-blue-600 dark:text-blue-400",
                  isMobile ? "h-6 w-6" : "h-8 w-8"
                )} />
              </div>
              <h1 className={cn(
                "font-bold text-gray-900 dark:text-white",
                isMobile ? "text-2xl" : "text-4xl"
              )}>
                Advanced Analytics
              </h1>
            </div>
            <p className={cn(
              "text-gray-600 dark:text-gray-400",
              isMobile ? "text-sm" : "text-base"
            )}>
              Comprehensive performance insights and detailed metrics for {userRole}s
            </p>
          </div>

          {/* Role-based Badges with Live Data Indicators */}
          <div className={cn(
            "flex gap-2",
            isMobile ? "flex-wrap" : "items-center gap-3"
          )}>
            {/* Live Data Indicator with Animation */}
            <Badge 
              variant="outline" 
              className={cn(
                "px-3 py-1 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
                isMobile && "text-xs"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <Activity className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300">Live Data</span>
              </div>
            </Badge>

            {/* Role-based Access Badge */}
            <Badge 
              variant={userRole === "admin" ? "default" : "secondary"} 
              className={cn(
                "px-3 py-1",
                isMobile && "text-xs",
                userRole === "admin" 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              )}
            >
              <Shield className="h-3 w-3 mr-1" />
              {userRole === "admin" ? "Full Access" : "Agent View"}
            </Badge>
          </div>
        </div>
      </header>

      {/* Performance Overview Section with Clear Visual Separation */}
      <section className="border-b border-gray-100 dark:border-gray-800 pb-8">
        <div className="mb-6">
          <h2 className={cn(
            "font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            <Clock className={cn(
              "text-blue-500",
              isMobile ? "h-5 w-5" : "h-6 w-6"
            )} />
            Performance Overview
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Key metrics and performance indicators at a glance
          </p>
        </div>
        <StatsCards />
      </section>

      {/* Main Detailed Analytics Section */}
      <section className="border-b border-gray-100 dark:border-gray-800 pb-8">
        <DetailedAnalytics />
      </section>

      {/* Advanced KPIs & Metrics Section */}
      <section className="border-b border-gray-100 dark:border-gray-800 pb-8">
        <div className="mb-6">
          <h2 className={cn(
            "font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            <TrendingUp className={cn(
              "text-green-500",
              isMobile ? "h-5 w-5" : "h-6 w-6"
            )} />
            Advanced KPIs & Metrics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Detailed performance metrics and trend analysis
          </p>
        </div>
        <AdvancedStatsCards />
      </section>

      {/* Visual Analytics & Charts Section */}
      <section className="border-b border-gray-100 dark:border-gray-800 pb-8">
        <div className="mb-6">
          <h2 className={cn(
            "font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            <Target className={cn(
              "text-purple-500",
              isMobile ? "h-5 w-5" : "h-6 w-6"
            )} />
            Visual Analytics & Charts
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Interactive charts and visual data representations
          </p>
        </div>
        <TicketCharts />
      </section>

      {/* Analytics Insights Footer */}
      <footer>
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className={cn(
            isMobile ? "p-4" : "p-6"
          )}>
            <div className={cn(
              "flex gap-4",
              isMobile ? "flex-col text-center" : "flex-row items-center justify-between"
            )}>
              <div className="flex-1">
                <h3 className={cn(
                  "font-semibold text-blue-900 dark:text-blue-100 mb-2",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  Analytics Insights
                </h3>
                <p className={cn(
                  "text-blue-700 dark:text-blue-300",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Data is updated in real-time and reflects current system performance. 
                  Use these insights to optimize your team's efficiency and improve customer satisfaction.
                </p>
              </div>
              <div className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Activity className={cn(
                  isMobile ? "h-8 w-8 mx-auto" : "h-12 w-12"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
      </footer>
    </div>
  );
};

export default AnalyticsPage; 