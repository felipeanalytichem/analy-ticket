import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDialog } from "./dialogs/TicketDialog";
import { TicketResolutionDialog } from "./dialogs/TicketResolutionDialog";
import { TicketClosureDialog } from "./dialogs/TicketClosureDialog";
import { TicketReopenDialog } from "./dialogs/TicketReopenDialog";
import { TicketDetailsDialog } from "./dialogs/TicketDetailsDialog";
import { QuickAssignDialog } from "./dialogs/QuickAssignDialog";
import { FeedbackViewDialog } from "./FeedbackViewDialog";
import { Search, Filter, Calendar, User, AlertCircle, Clock, CheckCircle, XCircle, Edit, Eye, MoreHorizontal, RotateCcw, UserCheck, Star, ChevronDown, Plus, RefreshCw, AlertTriangle, MessageSquare, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface TicketListProps {
  limit?: number;
  showAll?: boolean;
  assignedOnly?: boolean;
  unassignedOnly?: boolean;
  statusFilter?: string;
}

export const TicketList = ({ limit, showAll = true, assignedOnly = false, unassignedOnly = false, statusFilter }: TicketListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [localStatusFilter, setLocalStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketWithDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false);
  const [isClosureDialogOpen, setIsClosureDialogOpen] = useState(false);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isQuickAssignDialogOpen, setIsQuickAssignDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Load tickets from database
  useEffect(() => {
    const loadTickets = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!userProfile) {
          setError("User profile not loaded");
          setLoading(false);
          return;
        }
        
        const options = {
          userId: userProfile.id,
          showAll: showAll || userProfile.role === 'admin' || userProfile.role === 'agent',
          assignedOnly,
          unassignedOnly,
          statusFilter,
          userRole: userProfile.role,
          searchTerm: searchTerm.trim() || undefined,
          limit
        };
        
        const ticketData = await DatabaseService.getTickets(options);
        
        if (!Array.isArray(ticketData)) {
          throw new Error("Invalid ticket data received");
        }
        
        setTickets(ticketData);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load tickets";
        setError(errorMessage);
        toast({
          title: "Error loading tickets",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [
    userProfile?.id,
    userProfile?.role,
    userProfile?.email,
    userProfile,
    assignedOnly,
    unassignedOnly,
    statusFilter,
    showAll,
    searchTerm,
    limit,
    toast
  ]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle className="h-4 w-4" />;

      case "in_progress": return <Clock className="h-4 w-4" />;
      case "resolved": return <CheckCircle className="h-4 w-4" />;
      case "closed": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      open: t('status.open'),
      in_progress: t('status.inProgress'),
      resolved: t('status.resolved'),
      closed: t('status.closed'),
    };
    return map[status] || status;
  };

  const formatStatus = getStatusLabel;

  const formatPriority = (priority: string) => {
    const map: Record<string, string> = {
      urgent: `🔴 ${t('priority.urgent')}`,
      high: `🟠 ${t('priority.high')}`,
      medium: `🟡 ${t('priority.medium')}`,
      low: `🟢 ${t('priority.low')}`,
    };
    return map[priority] || priority;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleEditTicket = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsEditDialogOpen(true);
  };

  const handleResolveTicket = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsResolutionDialogOpen(true);
  };

  const handleCloseTicket = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsClosureDialogOpen(true);
  };

  const handleReopenTicket = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsReopenDialogOpen(true);
  };

  const handleViewTicketDetails = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsDetailsDialogOpen(true);
  };

  const handleQuickAssign = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsQuickAssignDialogOpen(true);
  };

  const handleViewFeedback = (ticket: TicketWithDetails) => {
    setSelectedTicket(ticket);
    setIsFeedbackDialogOpen(true);
  };

  const reloadTickets = async () => {
    if (!userProfile) {
      toast({
        title: "Error",
        description: "Please log in to view tickets",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRefreshing(true);
      setError(null);
      
      const options = {
        userId: userProfile.id,
        showAll: showAll || userProfile.role === 'admin' || userProfile.role === 'agent',
        assignedOnly,
        unassignedOnly,
        statusFilter,
        userRole: userProfile.role,
        searchTerm: searchTerm.trim() || undefined,
        limit
      };
      
      const ticketData = await DatabaseService.getTickets(options);
      
      if (!Array.isArray(ticketData)) {
        throw new Error("Invalid ticket data received");
      }
      
      setTickets(ticketData);
      toast({
        title: "Success",
        description: "Tickets refreshed successfully",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh tickets";
      setError(errorMessage);
      toast({
        title: "Error refreshing tickets",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const canResolveTicket = (ticket: TicketWithDetails) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    if (userProfile.role === 'agent' && ticket.assigned_to === userProfile.id) return true;
    return false;
  };

  const canReopenTicket = (ticket: TicketWithDetails) => {
    if (!userProfile) return false;
    
    // Only allow reopening resolved or closed tickets
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') return false;
    
    // Permission check
    if (userProfile.role === 'admin') return true;
    if (ticket.user_id === userProfile.id) return true;
    return false;
  };

  const canCloseTicket = (ticket: TicketWithDetails) => {
    if (!userProfile) return false;
    
    // Ticket must be resolved first
    if (ticket.status !== 'resolved') return false;
    
    // Must have resolution notes
    if (!ticket.resolution || ticket.resolution.trim() === '') return false;
    
    // Must have resolved_at timestamp
    if (!ticket.resolved_at) return false;
    
    // Permission check
    if (userProfile.role === 'admin') return true;
    if (userProfile.role === 'agent' && ticket.assigned_to === userProfile.id) return true;
    
    return false;
  };

  const filteredTickets = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    
    return tickets.filter(ticket => {
      if (!ticket) return false;

      // Enhanced search including assignee name and creator email
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
                          (ticket.title && ticket.title.toLowerCase().includes(searchLower)) ||
                          (ticket.description && ticket.description.toLowerCase().includes(searchLower)) ||
                          ticket.id.toString().includes(searchLower) ||
                          (ticket.assignee?.name && ticket.assignee.name.toLowerCase().includes(searchLower)) ||
                          (ticket.assignee?.email && ticket.assignee.email.toLowerCase().includes(searchLower)) ||
                          (ticket.creator?.name && ticket.creator.name.toLowerCase().includes(searchLower)) ||
                          (ticket.creator?.email && ticket.creator.email.toLowerCase().includes(searchLower));

      // Use statusFilter prop if provided, otherwise use local filter
      const effectiveStatusFilter = statusFilter || localStatusFilter;
      
      let matchesStatus;
      if (effectiveStatusFilter === "my_tickets") {
        matchesStatus = ticket.status === "open" || ticket.status === "in_progress";
      } else if (effectiveStatusFilter === "all") {
        matchesStatus = true;
      } else {
        matchesStatus = ticket.status === effectiveStatusFilter;
      }

      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, searchTerm, statusFilter, localStatusFilter, priorityFilter]);

  const TicketCard = ({ ticket }: { ticket: TicketWithDetails }) => {
    const { t } = useTranslation();
    const isAdmin = userProfile?.role?.includes('admin');
    const isAgent = userProfile?.role?.includes('agent');
    const canAssign = isAdmin || isAgent;
    const isAssignedToMe = ticket.assigned_to === userProfile?.id;
    const isUnassigned = !ticket.assigned_to;

    return (
      <Card className="group relative hover:shadow-lg transition-shadow duration-200 dark:hover:shadow-lg dark:hover:shadow-purple-900/20">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            {/* Header with ticket number and badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  #{ticket.ticket_number}
                </Badge>
                <Badge className={cn(getPriorityColor(ticket.priority))}>
                  {formatPriority(ticket.priority)}
                </Badge>
                <Badge className={cn(getStatusColor(ticket.status))}>
                  {getStatusIcon(ticket.status)}
                  <span className="ml-1">{formatStatus(ticket.status)}</span>
                </Badge>
              </div>
            </div>

            {/* Title and Description */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {ticket.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {ticket.description}
              </p>
            </div>

            {/* Footer with metadata and actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{ticket.user?.name || t('common.unknownUser')}</span>
                <span className="text-muted-foreground/60">•</span>
                <Calendar className="h-4 w-4" />
                <span>{formatDate(ticket.created_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                {canAssign && (ticket.status === 'open' || ticket.status === 'in_progress') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickAssign(ticket);
                    }}
                  >
                    <UserCheck className="h-4 w-4" />
                    {isAdmin ? (
                      <span className="hidden sm:inline">{t('tickets.actions.assign')}</span>
                    ) : isAssignedToMe ? (
                      <span className="hidden sm:inline">{t('tickets.actions.reassign')}</span>
                    ) : (
                      <span className="hidden sm:inline">{t('tickets.actions.assignToMe')}</span>
                    )}
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewTicketDetails(ticket)}>
                      <Eye className="h-4 w-4 mr-2" />
                      {t('tickets.actions.viewDetails')}
                    </DropdownMenuItem>
                    {canResolveTicket(ticket) && (
                      <DropdownMenuItem onClick={() => handleResolveTicket(ticket)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('tickets.actions.resolve')}
                      </DropdownMenuItem>
                    )}
                    {canCloseTicket(ticket) && (
                      <DropdownMenuItem onClick={() => handleCloseTicket(ticket)}>
                        <XCircle className="h-4 w-4 mr-2" />
                        {t('tickets.actions.close')}
                      </DropdownMenuItem>
                    )}
                    {canReopenTicket(ticket) && (
                      <DropdownMenuItem onClick={() => handleReopenTicket(ticket)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t('tickets.actions.reopen')}
                      </DropdownMenuItem>
                    )}
                    {ticket.feedback && (
                      <DropdownMenuItem onClick={() => handleViewFeedback(ticket)}>
                        <Star className="h-4 w-4 mr-2" />
                        {t('tickets.actions.viewFeedback')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={reloadTickets}
          className="mt-2"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </>
          )}
        </Button>
      </Alert>
    );
  }

  if (!Array.isArray(tickets) || tickets.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-medium">No tickets found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm
              ? "Try adjusting your search or filters"
              : "No tickets are available at the moment"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={reloadTickets}
            className="mt-4"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select
            value={localStatusFilter}
            onValueChange={setLocalStatusFilter}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.allStatuses')}</SelectItem>
              <SelectItem value="open">{t('status.open')}</SelectItem>
              <SelectItem value="in_progress">{t('status.inProgress')}</SelectItem>
              <SelectItem value="resolved">{t('status.resolved')}</SelectItem>
              <SelectItem value="closed">{t('status.closed')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={setPriorityFilter}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('filter.priority')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.allPriorities')}</SelectItem>
              <SelectItem value="urgent">{t('priority.urgent')}</SelectItem>
              <SelectItem value="high">{t('priority.high')}</SelectItem>
              <SelectItem value="medium">{t('priority.medium')}</SelectItem>
              <SelectItem value="low">{t('priority.low')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={reloadTickets}
            disabled={isRefreshing}
            className="shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {selectedTicket && (
        <>
          <TicketDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            ticket={selectedTicket}
            onTicketCreated={reloadTickets}
          />
          <TicketResolutionDialog
            open={isResolutionDialogOpen}
            onOpenChange={setIsResolutionDialogOpen}
            ticket={selectedTicket}
            onSuccess={reloadTickets}
          />
          <TicketClosureDialog
            open={isClosureDialogOpen}
            onOpenChange={setIsClosureDialogOpen}
            ticket={selectedTicket}
            onClosed={reloadTickets}
          />
          <TicketReopenDialog
            open={isReopenDialogOpen}
            onOpenChange={setIsReopenDialogOpen}
            ticket={selectedTicket}
            onSuccess={reloadTickets}
          />
          <TicketDetailsDialog
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            ticket={selectedTicket}
          />
          <QuickAssignDialog
            open={isQuickAssignDialogOpen}
            onOpenChange={setIsQuickAssignDialogOpen}
            ticket={selectedTicket}
            onAssigned={reloadTickets}
          />
          <FeedbackViewDialog
            open={isFeedbackDialogOpen}
            onOpenChange={setIsFeedbackDialogOpen}
            ticket={selectedTicket}
          />
        </>
      )}
    </div>
  );
};
