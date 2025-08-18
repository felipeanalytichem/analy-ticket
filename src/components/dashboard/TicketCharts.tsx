import { useState, useEffect } from "react";
import { ChartContainer as CustomChartContainer } from "./ChartContainer";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Button } from "@/components/ui/button";
import DatabaseService from '@/lib/database';
import { useAuth } from "@/contexts/AuthContext";
import { Download, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

export const TicketCharts = () => {
  const [statusData, setStatusData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();
  const { t } = useTranslation();

  const loadChartData = async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get all tickets for charts
      const allTickets = await DatabaseService.getTickets({
        showAll: true // Get all tickets for admin/agent view
      });

      // Status distribution
      const statusCounts = {
        open: allTickets.filter(t => t.status === 'open').length,
        in_progress: allTickets.filter(t => t.status === 'in_progress').length,
        resolved: allTickets.filter(t => t.status === 'resolved').length,
        closed: allTickets.filter(t => t.status === 'closed').length
      };

      const statusChartData = [
        { name: t('status.open'), value: statusCounts.open, color: "#6b7280" },
        { name: t('status.inProgress'), value: statusCounts.in_progress, color: "#3b82f6" },
        { name: t('status.resolved'), value: statusCounts.resolved, color: "#10b981" },
        { name: t('status.closed'), value: statusCounts.closed, color: "#6b7280" }
      ].filter(item => item.value > 0); // Only show statuses with tickets

      setStatusData(statusChartData);

      // Agent performance (tickets assigned to each agent)
      const agentCounts: Record<string, number> = {};
      allTickets.forEach(ticket => {
        if (ticket.assignee) {
          const agentName = ticket.assignee.name;
          agentCounts[agentName] = (agentCounts[agentName] || 0) + 1;
        }
      });

      const agentChartData = Object.entries(agentCounts)
        .map(([name, tickets]) => ({ name, tickets: tickets as number }))
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 5); // Top 5 agents

      setAgentData(agentChartData);

      // Timeline data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date;
      });

      const timelineChartData = last7Days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayStr = date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' });
        
        const created = allTickets.filter(ticket => 
          ticket.created_at && ticket.created_at.startsWith(dateStr)
        ).length;
        
        const resolved = allTickets.filter(ticket => 
          ticket.updated_at && 
          ticket.updated_at.startsWith(dateStr) && 
          ticket.status === 'resolved'
        ).length;

        return { date: dayStr, created, resolved };
      });

      setTimelineData(timelineChartData);

    } catch (error) {
      console.error('Error loading chart data:', error);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChartData();
  }, [userProfile]);

  const COLORS = ['#6b7280', '#3b82f6', '#10b981', '#6b7280'];

  const chartConfig = {
    created: { label: "Created", color: "#3b82f6" },
    resolved: { label: "Resolved", color: "#10b981" },
    tickets: { label: "Tickets", color: "#3b82f6" }
  };

  return (
    <section 
      aria-labelledby="ticket-charts-title"
      role="region"
    >
      <h2 id="ticket-charts-title" className="sr-only">
        {t('dashboard.ticketAnalyticsCharts')}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div
          role="img"
          aria-labelledby="status-chart-title"
          aria-describedby="status-chart-description"
          tabIndex={0}
        >
          <div id="status-chart-description" className="sr-only">
            Pie chart showing ticket status distribution: {statusData.map(item => `${item.name}: ${item.value} tickets`).join(', ')}
          </div>
          <CustomChartContainer
            title={t('dashboard.statusDistribution')}
            description={t('dashboard.statusDistributionDescription')}
            loading={loading}
            error={error}
            onRetry={loadChartData}
            height={300}
            actions={
              <Button 
                variant="outline" 
                size="sm"
                aria-label="Export status distribution chart data"
              >
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('dashboard.exportData')}
              </Button>
            }
          >
            {statusData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-full">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div 
                className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
                role="status"
                aria-label="No status distribution data available"
              >
                {t('dashboard.noDataAvailable')}
              </div>
            )}
          </CustomChartContainer>
        </div>

        {/* Agent Performance */}
        <div
          role="img"
          aria-labelledby="agent-chart-title"
          aria-describedby="agent-chart-description"
          tabIndex={0}
        >
          <div id="agent-chart-description" className="sr-only">
            Bar chart showing agent performance: {agentData.map(item => `${item.name}: ${item.tickets} tickets`).join(', ')}
          </div>
          <CustomChartContainer
            title={t('dashboard.agentPerformance')}
            description={t('dashboard.agentPerformanceDescription')}
            loading={loading}
            error={error}
            onRetry={loadChartData}
            height={300}
            actions={
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  aria-label="Refresh agent performance data"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('dashboard.refreshData')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  aria-label="Export agent performance chart data"
                >
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('dashboard.exportData')}
                </Button>
              </div>
            }
          >
            {agentData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-full">
                <BarChart data={agentData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Bar dataKey="tickets" fill="#3b82f6" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div 
                className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
                role="status"
                aria-label="No agent performance data available"
              >
                {t('dashboard.noAgentsWithTickets')}
              </div>
            )}
          </CustomChartContainer>
        </div>

        {/* Timeline Chart - Full Width */}
        <div 
          className="lg:col-span-2"
          role="img"
          aria-labelledby="timeline-chart-title"
          aria-describedby="timeline-chart-description"
          tabIndex={0}
        >
          <div id="timeline-chart-description" className="sr-only">
            Line chart showing ticket timeline over the last 7 days. Shows trends for tickets created and resolved each day. Created tickets are shown in blue, resolved tickets in green.
          </div>
          <CustomChartContainer
            title={t('dashboard.ticketTimeline')}
            description={t('dashboard.ticketTimelineDescription')}
            loading={loading}
            error={error}
            onRetry={loadChartData}
            height={350}
            actions={
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  aria-label="Show data for last 7 days"
                >
                  {t('dashboard.last7Days')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  aria-label="Show data for last 30 days"
                >
                  {t('dashboard.last30Days')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  aria-label="Export ticket timeline chart data"
                >
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('dashboard.exportData')}
                </Button>
              </div>
            }
          >
            {timelineData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-full">
                <LineChart data={timelineData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Line 
                    type="monotone" 
                    dataKey="created" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Created"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="resolved" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Resolved"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div 
                className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
                role="status"
                aria-label="No ticket timeline data available"
              >
                {t('dashboard.noTimelineData')}
              </div>
            )}
          </CustomChartContainer>
        </div>
      </div>
    </section>
  );
};
