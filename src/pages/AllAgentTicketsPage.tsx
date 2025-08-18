import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, Search, Filter, RefreshCw, BarChart3, Clock, TrendingUp, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { TicketList } from "@/components/tickets/TicketList";
import { cn } from "@/lib/utils";
import { useAllActiveAgents } from "@/hooks/useAgents";
import { SafeTranslation } from '@/components/ui/SafeTranslation';

interface AgentTicketStats {
  total: number;
  todayCount: number;
  weekCount: number;
  avgResolutionTime: number;
}

const AllAgentTicketsPage = () => {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Use the new agent hook for fetching all active agents
  const { 
    agents, 
    isLoading: agentsLoading, 
    isError: agentsError, 
    refetch: refetchAgents 
  } = useAllActiveAgents({
    enabled: !!(userProfile?.id && (userProfile.role === 'agent' || userProfile.role === 'admin')),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
  
  // Filter states
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Statistics
  const [statistics, setStatistics] = useState<AgentTicketStats>({
    total: 0,
    todayCount: 0,
    weekCount: 0,
    avgResolutionTime: 0
  });

  // Load tickets only (agents are now loaded via the hook)
  useEffect(() => {
    const loadData = async () => {
      if (!userProfile?.id || (userProfile.role !== 'agent' && userProfile.role !== 'admin')) return;
      
      setIsLoading(true);
      try {
        // Load all agent tickets using the showAllAgentTickets option
        const allAgentTickets = await DatabaseService.getTickets({
          userRole: userProfile.role,
          showAllAgentTickets: true,
          userId: userProfile.id
        });

        // Filter to only show Open and In-Progress tickets
        const filteredAgentTickets = allAgentTickets.filter(ticket => 
          ticket.status === 'open' || ticket.status === 'in_progress'
        );

        setTickets(filteredAgentTickets);
        
        // Calculate statistics
        calculateStatistics(allAgentTickets);
        
      } catch (error) {
        console.error('Error loading agent tickets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userProfile, refreshKey]);

  // Apply filters
  useEffect(() => {
    let filtered = [...tickets];

    // Filter by assigned agent
    if (selectedAgent !== "all") {
      filtered = filtered.filter(ticket => ticket.assigned_to === selectedAgent);
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Filter by priority
    if (priorityFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.title.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower) ||
        ticket.ticket_number?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTickets(filtered);
    calculateStatistics(filtered);
  }, [tickets, selectedAgent, statusFilter, priorityFilter, searchTerm]);

  const calculateStatistics = (ticketList: TicketWithDetails[]) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const total = ticketList.length;
    
    const todayCount = ticketList.filter(t => 
      t.created_at && t.created_at.startsWith(todayStr)
    ).length;
    
    const weekCount = ticketList.filter(t => 
      t.created_at && new Date(t.created_at) >= weekAgo
    ).length;
    
    // Calculate average resolution time for resolved tickets
    const resolvedTickets = ticketList.filter(t => 
      t.status === 'resolved' && t.created_at && t.resolved_at
    );
    
    let avgResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.created_at);
        const resolved = new Date(ticket.resolved_at!);
        const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      avgResolutionTime = totalHours / resolvedTickets.length;
    }
    
    setStatistics({
      total,
      todayCount,
      weekCount,
      avgResolutionTime
    });
  };

  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    // Also refresh the agents data
    await refetchAgents();
  };

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const theme = {
    gradient: "bg-gradient-to-r from-blue-500 to-purple-500",
    bgGradient: "bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-700 dark:text-blue-300",
    icon: "👥",
    name: "All Agent Tickets"
  };

  if (!userProfile || (userProfile.role !== 'agent' && userProfile.role !== 'admin')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <SafeTranslation i18nKey="admin.accessDenied.agentsAndAdmins" fallback="This page is only available to agents and administrators." />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Enhanced Header with Gradient */}
      <div className={cn("rounded-xl p-4 md:p-6 border", theme.bgGradient, theme.borderColor)}>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={cn("p-1.5 md:p-2 rounded-lg text-white", theme.gradient)}>
                <span className="text-lg md:text-2xl">{theme.icon}</span>
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {theme.name}
                </h1>
                <p className={cn("text-xs md:text-sm", theme.textColor)}>
                  View and manage open and in-progress tickets assigned to all agents
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="default"
            className="w-full sm:w-auto"
            disabled={isLoading || agentsLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (isLoading || agentsLoading) && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "..." : statistics.total}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "..." : statistics.todayCount}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "..." : statistics.weekCount}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Avg Resolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? "..." : formatTime(statistics.avgResolutionTime)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md text-white", theme.gradient)}>
              <Filter className="h-4 w-4" />
            </div>
            <span>Filter Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("border-t", theme.bgGradient)}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Agent Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Assigned Agent
              </label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder={agentsLoading ? "Loading agents..." : "All agents"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agentsError ? (
                    <SelectItem value="error" disabled>
                      Error loading agents
                    </SelectItem>
                  ) : (
                    agents
                      .sort((a, b) => a.full_name.localeCompare(b.full_name))
                      .map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Priority
              </label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket List */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>Agent Tickets</span>
                <Badge variant="outline">
                  {filteredTickets.length} tickets
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(isLoading || agentsLoading) ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {isLoading && agentsLoading ? "Loading tickets and agents..." : 
                     isLoading ? "Loading tickets..." : "Loading agents..."}
                  </p>
                </div>
              </div>
            ) : agentsError ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Error Loading Agents
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Failed to load agent information for filtering.
                </p>
                <Button onClick={refetchAgents} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Loading Agents
                </Button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No tickets found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {tickets.length === 0 
                    ? "No agent tickets are currently available."
                    : "No tickets match your current filters."
                  }
                </p>
              </div>
            ) : (
              <TicketList 
                key={`all-agent-tickets-${refreshKey}`}
                statusFilter="all"
                showAll={true}
                showAllAgentTickets={true}
                customTickets={filteredTickets}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AllAgentTicketsPage;