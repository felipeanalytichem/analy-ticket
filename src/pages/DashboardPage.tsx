import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AdvancedStatsCards } from "@/components/dashboard/AdvancedStatsCards";
import { TicketCharts } from "@/components/dashboard/TicketCharts";
import { DetailedAnalytics } from "@/components/dashboard/DetailedAnalytics";
import { TicketList } from "@/components/tickets/TicketList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const DashboardPage = () => {
  const { userProfile } = useAuth();
  const { t } = useTranslation();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";

  return (
    <div className="space-y-4 md:space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-white">
          {t('dashboard.title')}
        </h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
          {t('dashboard.welcome', { name: userProfile?.full_name?.split(' ')[0] || 'User' })}
        </p>
        <StatsCards />
      </div>
      
      {/* Enhanced Analytics Section for Agents and Admins */}
      {(userRole === "agent" || userRole === "admin") && (
        <div className="space-y-4 md:space-y-8">
          {/* Detailed Analytics */}
          <DetailedAnalytics />
          
          {/* Legacy Analytics - keeping for comparison */}
          <div className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">{t('dashboard.legacyAnalyticsTitle')}</h2>
              <AdvancedStatsCards />
            </div>
            <TicketCharts />
          </div>
        </div>
      )}
      
      <section 
        aria-labelledby="tickets-section-title"
        role="region"
      >
        <div className="grid grid-cols-1 gap-4 md:gap-8">
          <Card>
            <CardHeader>
              <CardTitle 
                id="tickets-section-title"
                className="text-base md:text-lg flex items-center gap-2"
              >
                <Clock 
                  className="h-4 w-4 md:h-5 md:w-5 text-orange-500" 
                  aria-hidden="true"
                />
                {userRole === "user" ? t('dashboard.myActiveTickets') : t('dashboard.unassignedTickets')}
              </CardTitle>
              <CardDescription>
                {userRole === "user" 
                  ? t('dashboard.yourTicketsDescription')
                  : t('dashboard.unassignedTicketsDescription')
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="region"
                aria-labelledby="tickets-section-title"
                aria-describedby="tickets-section-description"
              >
                <div 
                  id="tickets-section-description" 
                  className="sr-only"
                >
                  {userRole === "user" 
                    ? t('dashboard.activeTicketsAriaDescription')
                    : t('dashboard.unassignedTicketsAriaDescription')
                  }
                </div>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage; 