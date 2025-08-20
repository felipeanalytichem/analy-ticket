import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  User, 
  MessageSquare, 
  Target,
  TrendingUp,
  Users,
  Ticket,
  Search,
  Filter,
  RefreshCw,
  Bell,
  Calendar,
  BarChart3
} from "lucide-react";
import { TicketWithDetails } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
// AgentResponseInterface removed - using navigation to UnifiedTicketDetail instead
import { AgentNotifications } from "@/components/tickets/AgentNotifications";
import { SLAMonitor } from "@/components/tickets/SLAMonitor";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useAgentDashboard } from "@/hooks/useAgentDashboard";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

interface AgentStats {
  totalAssigned: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  avgResponseTime: number;
  slaCompliance: number;
}

export const AgentDashboard = () => {
  const navigate = useNavigate();
  // selectedTicket state removed - using navigation to UnifiedTicketDetail instead
  const [filteredTickets, setFilteredTickets] = useState<TicketWithDetails[]>([]);
  const [activeTab, setActiveTab] = useState("assigned");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Use React Query hook for data management
  const { 
    tickets, 
    stats, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    handleStuckLoading,
    isRefetching 
  } = useAgentDashboard();

  // Setup loading timeout to handle stuck states
  useLoadingTimeout(isLoading, 20000); // 20 second timeout

  // Show error toast when React Query encounters an error
  useEffect(() => {
    if (isError && error) {
      console.error('❌ Agent dashboard error:', error);
      toast({
        title: t('common.error'),
        description: t('agentDashboard.loadError'),
        variant: "destructive",
      });
    }
  }, [isError, error, toast, t]);

  const filterTickets = useCallback(() => {
    let filtered = tickets;

    // Filtro por tab ativo - este tem prioridade sobre outros filtros de status
    if (activeTab === "assigned") {
      filtered = filtered.filter(t => t.assigned_to === userProfile?.id && t.status !== 'closed' && t.status !== 'resolved');
    } else if (activeTab === "unassigned") {
      filtered = filtered.filter(t => !t.assigned_to && t.status !== 'closed' && t.status !== 'resolved');
    } else if (activeTab === "urgent") {
      filtered = filtered.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'closed' && t.status !== 'resolved');
    } else if (activeTab === "closed") {
      filtered = filtered.filter(t => t.status === 'closed');
    } else if (activeTab === "all") {
      // In the "All" tab, show all tickets relevant to the agent
      // Include: tickets assigned to the agent + unassigned tickets (except closed by default)
      filtered = filtered.filter(t => {
        const isAssignedToAgent = t.assigned_to === userProfile?.id;
        const isUnassigned = !t.assigned_to;
        const isNotClosed = t.status !== 'closed';
        
        // For the "All" tab, show tickets assigned to the agent or unassigned
        // And apply status filter only if specifically selected in the dropdown
        if (statusFilter === "all") {
          return (isAssignedToAgent || isUnassigned) && isNotClosed && t.status !== 'resolved';
        } else {
          // If there's a specific status filter, apply it
          return (isAssignedToAgent || isUnassigned) && t.status === statusFilter;
        }
      });
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status - apenas aplicar se não estivermos na aba "all" ou "closed"
    // As abas específicas já aplicam seus próprios filtros de status
    if (statusFilter !== "all" && activeTab !== "all" && activeTab !== "closed") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Filtro por prioridade
    if (priorityFilter !== "all") {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    // Ordenar por prioridade e data
    filtered.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Debug logging removed for production

    setFilteredTickets(filtered);
  }, [tickets, activeTab, statusFilter, priorityFilter, searchTerm, userProfile?.id]);

  useEffect(() => {
    filterTickets();
  }, [tickets, activeTab, statusFilter, priorityFilter, searchTerm, filterTickets]);

  const handleTicketSelect = (ticket: TicketWithDetails) => {
    navigate(`/ticket/${ticket.id}`);
  };

  const handleTicketUpdate = () => {
    loadAgentData();
  };

  const handleSelfAssign = async (ticket: TicketWithDetails) => {
    if (!userProfile?.id) return;

    try {
      await DatabaseService.updateTicket(ticket.id, {
        assigned_to: userProfile.id,
        status: 'in_progress'
      });

      toast({
        title: t('agentDashboard.selfAssignedTitle'),
        description: t('agentDashboard.selfAssignedDesc', { ticket: ticket.ticket_number || ticket.id }),
      });

      loadAgentData();
    } catch (error) {
      // Error logging removed for production
      toast({
        title: t('common.error'),
        description: t('agentDashboard.selfAssignError'),
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "resolved": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case "closed": return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (userProfile?.role !== 'agent' && userProfile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('agentDashboard.restricted')}</p>
      </div>
    );
  }

  // selectedTicket conditional removed - now using navigation to UnifiedTicketDetail

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('agentDashboard.title')}
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            {t('agentDashboard.subtitle')}
          </p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
          <AgentNotifications onTicketSelect={handleTicketSelect} />
          <Button 
            onClick={() => {
              console.log('🔄 Refresh triggered...');
              refetch();
            }} 
            variant="outline" 
            size="sm" 
            className="flex-1 sm:flex-none"
            disabled={isLoading || isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || isRefetching) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {(isLoading || isRefetching) ? 'Loading...' : t('common.refresh')}
            </span>
            <span className="sm:hidden">
              {(isLoading || isRefetching) ? 'Loading...' : t('common.refresh')}
            </span>
          </Button>
          
          {/* Emergency Force Refresh Button - only show if loading for too long */}
          {(isLoading && !isRefetching) && (
            <Button 
              onClick={() => {
                console.log('🚨 Emergency force refresh triggered...');
                handleStuckLoading();
              }} 
              variant="destructive" 
              size="sm"
            >
              Force Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t('agentDashboard.assignedTickets')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalAssigned}
                </p>
              </div>
              <Ticket className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t('status.inProgress')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.inProgressTickets}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t('agentDashboard.resolvedToday')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.resolvedToday}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t('agentDashboard.slaCompliance')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.slaCompliance}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('agentDashboard.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('agentDashboard.statusFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentDashboard.statusAll')}</SelectItem>
                <SelectItem value="open">{t('status.open')}</SelectItem>
                <SelectItem value="in_progress">{t('status.inProgress')}</SelectItem>
                <SelectItem value="resolved">{t('status.resolved')}</SelectItem>
                <SelectItem value="closed">{t('status.closed')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('agentDashboard.priorityFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentDashboard.priorityAll')}</SelectItem>
                <SelectItem value="urgent">{t('priority.urgent')}</SelectItem>
                <SelectItem value="high">{t('priority.high')}</SelectItem>
                <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                <SelectItem value="low">{t('priority.low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('agentDashboard.myTickets')} ({tickets.filter(t => t.assigned_to === userProfile?.id && t.status !== 'closed' && t.status !== 'resolved').length})
          </TabsTrigger>
          <TabsTrigger value="unassigned" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('agentDashboard.unassigned')} ({tickets.filter(t => !t.assigned_to && t.status !== 'closed' && t.status !== 'resolved').length})
          </TabsTrigger>
          <TabsTrigger value="urgent" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('agentDashboard.urgent')} ({tickets.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'closed' && t.status !== 'resolved').length})
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('status.closed')} ({tickets.filter(t => t.status === 'closed').length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t('common.all')} ({tickets.filter(t => (t.assigned_to === userProfile?.id || !t.assigned_to) && t.status !== 'closed' && t.status !== 'resolved').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('agentDashboard.noTicketsTitle')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('agentDashboard.noTicketsDesc')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket, index) => (
                <Card 
                  key={`${ticket.id}-${index}`} 
                  className="hover:shadow-lg transition-shadow duration-150 cursor-pointer relative"
                  onClick={() => handleTicketSelect(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {ticket.ticket_number && (
                              <span className="text-sm font-mono text-blue-600 dark:text-blue-400 mr-2">
                                {ticket.ticket_number}
                              </span>
                            )}
                            {ticket.title}
                          </h3>
                          
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(ticket.status)}>
                              {ticket.status === 'open' && <AlertCircle className="h-3 w-3 mr-1" />}
                              {ticket.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                              {ticket.status === 'resolved' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {t(`status.${ticket.status === 'in_progress' ? 'inProgress' : ticket.status}`)}
                            </Badge>
                            
                            <Badge className={getPriorityColor(ticket.priority)}>
                              {t(`priority.${ticket.priority}`)}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                          {ticket.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            {t('agentDashboard.createdBy')}: {ticket.user?.name || 'Usuário Desconhecido'}
                          </span>
                          <span>•</span>
                          <span>
                            {formatDate(ticket.created_at)}
                          </span>
                          {ticket.assigned_to && (
                            <>
                              <span>•</span>
                              <span>
                                {t('agentDashboard.assignedTo')}: {ticket.assignee?.name || 'Agente'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {!ticket.assigned_to && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelfAssign(ticket);
                            }}
                          >
                            {t('agentDashboard.take')}
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTicketSelect(ticket);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          {t('agentDashboard.reply')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentDashboard;