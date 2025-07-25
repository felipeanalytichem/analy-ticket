import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, X, Search, Users, Tag } from "lucide-react";

interface AdvancedFiltersProps {
  onFiltersChange: (filters: any) => void;
}

export const AdvancedFilters = ({ onFiltersChange }: AdvancedFiltersProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    priority: "all",
    category: "all",
    assignee: "all",
    dateFrom: "",
    dateTo: "",
    slaStatus: "all"
  });

  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const agents = [
    { id: "joao", name: "João Silva" },
    { id: "ana", name: "Ana Oliveira" },
    { id: "carlos", name: "Carlos Lima" },
    { id: "maria", name: "Maria Santos" }
  ];

  const categories = [
    { id: "ti", name: "TI" },
    { id: "facilities", name: "Facilities" },
    { id: "rh", name: "RH" },
    { id: "financeiro", name: "Financeiro" }
  ];

  const updateFilter = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);

    // Update active filters for display
    const newActiveFilters = Object.entries(newFilters)
      .filter(([k, v]) => v !== "" && v !== "all" && k !== "search")
      .map(([k, v]) => `${k}:${v}`);
    setActiveFilters(newActiveFilters);
  };

  const clearFilter = (filterKey: string) => {
    updateFilter(filterKey, filterKey === "search" ? "" : "all");
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      search: "",
      status: "all",
      priority: "all", 
      category: "all",
      assignee: "all",
      dateFrom: "",
      dateTo: "",
      slaStatus: "all"
    };
    setFilters(clearedFilters);
    setActiveFilters([]);
    onFiltersChange(clearedFilters);
  };

  const getFilterLabel = (key: string, value: string) => {
    switch (key) {
      case "status":
        return `Status: ${value}`;
      case "priority":
        return `Priority: ${value}`;
      case "category":
        const cat = categories.find(c => c.id === value);
        return `Category: ${cat?.name || value}`;
      case "assignee":
        const agent = agents.find(a => a.id === value);
        return `Agent: ${agent?.name || value}`;
      case "dateFrom":
        return `From: ${new Date(value).toLocaleDateString('en-US')}`;
      case "dateTo":
        return `To: ${new Date(value).toLocaleDateString('en-US')}`;
      case "slaStatus":
        return `SLA: ${value}`;
      default:
        return `${key}: ${value}`;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
                          placeholder={t('placeholders.searchTickets')}
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Active filters display */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => {
              const [key, value] = filter.split(":");
              return (
                <Badge key={filter} variant="secondary" className="flex items-center gap-1">
                  {getFilterLabel(key, value)}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => clearFilter(key)}
                  />
                </Badge>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Expanded filters */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => updateFilter("priority", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={(value) => updateFilter("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.assignee} onValueChange={(value) => updateFilter("assignee", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
              />
            </div>

            <Select value={filters.slaStatus} onValueChange={(value) => updateFilter("slaStatus", value)}>
              <SelectTrigger>
                <SelectValue placeholder="SLA Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ok">✅ Within SLA</SelectItem>
                <SelectItem value="warning">⚠️ Close to deadline</SelectItem>
                <SelectItem value="overdue">🔴 Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
