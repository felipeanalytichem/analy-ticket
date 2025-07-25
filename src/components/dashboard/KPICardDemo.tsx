import React from "react";
import { KPICard } from "./KPICard";
import { 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  Target,
  AlertCircle 
} from "lucide-react";

export const KPICardDemo: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">KPI Card Examples</h2>
        
        {/* Basic KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Average Resolution Time"
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
            icon={TrendingUp}
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

        {/* Cards without targets */}
        <h3 className="text-lg font-semibold mb-4">Without Targets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <KPICard
            title="Total Users"
            value={1250}
            trend="up"
            color="blue"
            icon={Users}
            format="number"
          />
          
          <KPICard
            title="Response Rate"
            value={87}
            trend="down"
            color="red"
            icon={Target}
            format="percentage"
          />
          
          <KPICard
            title="Processing Time"
            value={23}
            trend="neutral"
            color="green"
            icon={Clock}
            format="time"
          />
        </div>

        {/* Loading states */}
        <h3 className="text-lg font-semibold mb-4">Loading States</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Loading Example"
            value={0}
            color="blue"
            icon={Clock}
            loading={true}
          />
          
          <KPICard
            title="Loading Example"
            value={0}
            color="green"
            icon={CheckCircle}
            loading={true}
          />
          
          <KPICard
            title="Loading Example"
            value={0}
            color="purple"
            icon={TrendingUp}
            loading={true}
          />
          
          <KPICard
            title="Loading Example"
            value={0}
            color="red"
            icon={AlertCircle}
            loading={true}
          />
        </div>
      </div>
    </div>
  );
};