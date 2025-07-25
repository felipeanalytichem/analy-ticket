import React from "react";
import { KPICard } from "./KPICard";
import { 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  AlertCircle,
  Target,
  Users,
  Timer,
  Star
} from "lucide-react";

/**
 * Example showing how to use KPICard components in the Analytics page
 * This demonstrates the enhanced KPI cards with trend indicators and target comparisons
 */
export const KPICardUsageExample: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-green-500" />
          Enhanced KPI Overview
        </h2>
        
        {/* Main KPI Grid - 4 columns on desktop, 2 on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Avg Resolution Time"
            value={45}
            target={60}
            trend="up"
            color="blue"
            icon={Clock}
            format="time"
          />
          
          <KPICard
            title="SLA Compliance"
            value={92}
            target={95}
            trend="down"
            color="green"
            icon={CheckCircle}
            format="percentage"
          />
          
          <KPICard
            title="Customer Satisfaction"
            value={4.7}
            target={4.5}
            trend="up"
            color="purple"
            icon={Star}
            format="number"
          />
          
          <KPICard
            title="Active Tickets"
            value={127}
            trend="neutral"
            color="yellow"
            icon={AlertCircle}
            format="number"
          />
        </div>

        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Agent Performance Metrics
        </h3>
        
        {/* Agent Performance Grid - 3 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <KPICard
            title="First Contact Resolution"
            value={78}
            target={85}
            trend="up"
            color="green"
            icon={Target}
            format="percentage"
          />
          
          <KPICard
            title="Response Time"
            value={23}
            target={30}
            trend="up"
            color="blue"
            icon={Timer}
            format="time"
          />
          
          <KPICard
            title="Active Agents"
            value={12}
            trend="neutral"
            color="purple"
            icon={Users}
            format="number"
          />
        </div>

        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Critical Metrics (Red Indicators)
        </h3>
        
        {/* Critical Metrics - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPICard
            title="Overdue Tickets"
            value={15}
            target={5}
            trend="down"
            color="red"
            icon={AlertCircle}
            format="number"
          />
          
          <KPICard
            title="Escalation Rate"
            value={8}
            target={5}
            trend="down"
            color="red"
            icon={TrendingUp}
            format="percentage"
          />
        </div>
      </div>
    </div>
  );
};