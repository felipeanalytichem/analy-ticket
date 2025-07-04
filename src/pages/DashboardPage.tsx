import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AdvancedStatsCards } from "@/components/dashboard/AdvancedStatsCards";
import { TicketCharts } from "@/components/dashboard/TicketCharts";
import { DetailedAnalytics } from "@/components/dashboard/DetailedAnalytics";
import { TicketList } from "@/components/tickets/TicketList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

const DashboardPage = () => {
  const { userProfile } = useAuth();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
          Dashboard & Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Welcome, {userProfile?.full_name?.split(' ')[0] || 'User'}
        </p>
        <StatsCards />
      </div>
      
      {/* Enhanced Analytics Section for Agents and Admins */}
      {(userRole === "agent" || userRole === "admin") && (
        <div className="space-y-8">
          {/* Detailed Analytics */}
          <DetailedAnalytics />
          
          {/* Legacy Analytics - keeping for comparison */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Legacy Analytics & KPIs</h2>
              <AdvancedStatsCards />
            </div>
            <TicketCharts />
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              {userRole === "user" ? "My Active Tickets" : "Unassigned Tickets"}
            </CardTitle>
            <CardDescription>
              {userRole === "user" 
                ? "Your tickets that are currently open or in progress"
                : "Tickets that are currently unassigned and awaiting assignment"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userRole === "user" ? (
              <TicketList 
                limit={5} 
                showAll={false}
                assignedOnly={false}
                statusFilter="active"
              />
            ) : (
              <TicketList 
                limit={5} 
                showAll={true} 
                unassignedOnly={true}
                statusFilter="open"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage; 