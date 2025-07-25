import React, { useState, useEffect } from "react";
import { ChartContainer, ChartContainerSkeleton } from "./ChartContainer";
import { ChartContainer as RechartsContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Download, Filter, RefreshCw } from "lucide-react";

// Mock data for examples
const statusData = [
  { name: "Open", value: 12, color: "#6b7280" },
  { name: "In Progress", value: 8, color: "#3b82f6" },
  { name: "Resolved", value: 25, color: "#10b981" },
  { name: "Closed", value: 15, color: "#6b7280" }
];

const timelineData = [
  { date: "01/20", created: 5, resolved: 3 },
  { date: "01/21", created: 8, resolved: 6 },
  { date: "01/22", created: 12, resolved: 9 },
  { date: "01/23", created: 6, resolved: 8 },
  { date: "01/24", created: 9, resolved: 7 },
  { date: "01/25", created: 11, resolved: 10 },
  { date: "01/26", created: 7, resolved: 9 }
];

const agentData = [
  { name: "Alice", tickets: 15 },
  { name: "Bob", tickets: 12 },
  { name: "Charlie", tickets: 18 },
  { name: "Diana", tickets: 9 },
  { name: "Eve", tickets: 14 }
];

const chartConfig = {
  created: { label: "Created", color: "#3b82f6" },
  resolved: { label: "Resolved", color: "#10b981" },
  tickets: { label: "Tickets", color: "#3b82f6" }
};

export const ChartContainerUsageExample: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => {
    setError(null);
    setShowError(false);
    setLoading(true);
    
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const simulateError = () => {
    setError("Failed to load chart data. Network connection error.");
    setShowError(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">Chart Container Examples (Loading)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainerSkeleton count={3} height={300} />
          <div className="lg:col-span-2">
            <ChartContainerSkeleton count={1} height={350} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Chart Container Examples</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={simulateError}>
            Simulate Error
          </Button>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <ChartContainer
          title="Status Distribution"
          description="Current ticket status breakdown"
          error={showError ? error : null}
          onRetry={handleRetry}
          actions={
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          }
          height={300}
        >
          <RechartsContainer config={chartConfig} className="h-full">
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
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </RechartsContainer>
        </ChartContainer>

        {/* Agent Performance Bar Chart */}
        <ChartContainer
          title="Agent Performance"
          description="Tickets handled by each agent"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          }
          height={300}
        >
          <RechartsContainer config={chartConfig} className="h-full">
            <BarChart data={agentData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Bar dataKey="tickets" fill="#3b82f6" />
              <ChartTooltip content={<ChartTooltipContent />} />
            </BarChart>
          </RechartsContainer>
        </ChartContainer>

        {/* Timeline Line Chart - Full Width */}
        <div className="lg:col-span-2">
          <ChartContainer
            title="Ticket Timeline"
            description="Created vs resolved tickets over the last 7 days"
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Last 7 days
                </Button>
                <Button variant="outline" size="sm">
                  Last 30 days
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            }
            height={350}
          >
            <RechartsContainer config={chartConfig} className="h-full">
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
            </RechartsContainer>
          </ChartContainer>
        </div>
      </div>

      {/* Usage Notes */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Usage Notes
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• ChartContainer provides consistent styling and responsive behavior</li>
          <li>• Loading states are handled automatically with skeleton animations</li>
          <li>• Error states include retry functionality and clear messaging</li>
          <li>• Action buttons can be added for export, filtering, and other operations</li>
          <li>• Mobile optimization ensures charts remain readable on smaller screens</li>
        </ul>
      </div>
    </div>
  );
};