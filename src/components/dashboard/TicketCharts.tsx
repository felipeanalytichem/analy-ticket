import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import DatabaseService from '@/lib/database';
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const TicketCharts = () => {
  const [statusData, setStatusData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true);
        
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
          { name: "Open", value: statusCounts.open, color: "#6b7280" },
          { name: "In Progress", value: statusCounts.in_progress, color: "#3b82f6" },
          { name: "Resolved", value: statusCounts.resolved, color: "#10b981" },
          { name: "Closed", value: statusCounts.closed, color: "#6b7280" }
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
      } finally {
        setLoading(false);
      }
    };

    if (userProfile) {
      loadChartData();
    }
  }, [userProfile]);

  const COLORS = ['#6b7280', '#3b82f6', '#10b981', '#6b7280'];

  const chartConfig = {
    created: { label: "Created", color: "#3b82f6" },
    resolved: { label: "Resolved", color: "#10b981" },
    tickets: { label: "Tickets", color: "#3b82f6" }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className={index === 2 ? "lg:col-span-2" : ""}>
            <CardHeader>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Distribuição por Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-64">
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
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance por Agente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tickets by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          {agentData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-64">
              <BarChart data={agentData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Bar dataKey="tickets" fill="#3b82f6" />
                <ChartTooltip content={<ChartTooltipContent />} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No agents with assigned tickets
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline de Criação vs Resolução */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Created vs Resolved (Last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-64">
              <LineChart data={timelineData}>
                <XAxis dataKey="date" />
                <YAxis />
                <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} />
                <ChartTooltip content={<ChartTooltipContent />} />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No timeline data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
