import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCheck, Loader2, Users, User, Clock, AlertCircle, UserPlus, Brain, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { useTranslation } from "react-i18next";
import DatabaseService, { TicketWithDetails } from "@/lib/database";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { assignmentService, type AgentMetrics, type AssignmentResult } from "@/lib/assignmentService";

interface Agent {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role?: string;
}

interface QuickAssignDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export const QuickAssignDialog = ({ 
  ticket, 
  open, 
  onOpenChange, 
  onAssigned 
}: QuickAssignDialogProps) => {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([]);
  const [intelligentSuggestion, setIntelligentSuggestion] = useState<AssignmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntelligentMode, setShowIntelligentMode] = useState(false);
  const { triggerRefresh } = useTicketCount();
  const { t } = useTranslation();
  const { userProfile } = useAuth();

  // Helper functions for formatting
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

  const statusKeyMap: Record<string,string> = { open: "open", in_progress: "inProgress", resolved: "resolved", closed: "closed" };
  const formatStatus = (status: string) => t(`status.${statusKeyMap[status] || status}`, status);

  const formatPriority = (priority: string) => t(`priority.${priority}`, priority);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    if (open) {
      loadAgents();
      loadIntelligentSuggestion();
      // Pre-select current agent if ticket is already assigned
      if (ticket?.assigned_to) {
        setSelectedAgent(ticket.assigned_to);
      } else if (!userProfile?.role?.includes('admin')) {
        // If not admin, pre-select current user
        setSelectedAgent(userProfile?.id || "");
      } else {
        setSelectedAgent("");
      }
    }
  }, [open, ticket, userProfile]);

  const loadAgents = async () => {
    setIsLoadingAgents(true);
    try {
      // Get all users with agent or admin role
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['agent', 'admin'])
        .order('full_name');

      if (error) throw error;
      // Map the data to match our Agent interface
      const mappedAgents = (data || []).map(user => ({
        id: user.id,
        full_name: user.full_name || user.email || 'Unknown',
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role
      }));
      setAgents(mappedAgents);

      // Also load agent metrics for intelligent suggestions
      const metrics = await assignmentService.getAvailableAgents();
      setAgentMetrics(metrics);
    } catch (err) {
      console.error('Error loading agents:', err);
      setError(t('tickets.assign.loadAgentsError'));
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const loadIntelligentSuggestion = async () => {
    if (!ticket) return;
    
    setIsLoadingSuggestion(true);
    try {
      const suggestion = await assignmentService.findBestAgent({
        priority: ticket.priority,
        category_id: ticket.category_id,
        title: ticket.title,
        description: ticket.description || '',
      });
      setIntelligentSuggestion(suggestion);
    } catch (err) {
      console.error('Error getting intelligent suggestion:', err);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleIntelligentAssign = async () => {
    if (!ticket) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await assignmentService.assignTicket(ticket.id);
      
      if (result.success) {
        toast.success('Ticket Assigned Successfully', {
          description: `Assigned to ${result.assignedAgent?.full_name}. ${result.reason}`
        });
        
        triggerRefresh();
        onAssigned();
        onOpenChange(false);
      } else {
        throw new Error(result.reason);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign ticket';
      setError(errorMessage);
      toast.error('Assignment Failed', {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket || !selectedAgent) return;

    setIsLoading(true);
    setError(null);

    try {
      // Update ticket assignment
      await DatabaseService.updateTicket(ticket.id, {
        assigned_to: selectedAgent,
        updated_at: new Date().toISOString()
      });

      // Create notification for the assigned agent
      await DatabaseService.createTicketNotification(ticket.id, 'assignment_changed', selectedAgent);

      toast.success(t('tickets.assign.successTitle'), {
        description: t('tickets.assign.successDescription')
      });

      onAssigned();
      onOpenChange(false);
    } catch (err) {
      console.error('Error assigning ticket:', err);
      const errorMessage = err instanceof Error ? err.message : t('tickets.assign.errorDefault');
      setError(errorMessage);
      toast.error(t('tickets.assign.error'), {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onOpenChange(false);
  };

  if (!ticket) return null;

  const isAdmin = userProfile?.role?.includes('admin');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-700 to-indigo-700 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              {t('tickets.assign.title')}
            </span>
          </DialogTitle>
          <DialogDescription>
            Assign this ticket to an agent who will be responsible for resolving it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-lg border border-blue-300 dark:border-blue-700 shadow-sm">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {ticket.ticket_number && (
                  <span className="font-mono text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded mr-2 text-blue-800 dark:text-blue-200">
                    #{ticket.ticket_number}
                  </span>
                )}
                {ticket.title}
              </h4>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  {t('tickets.assign.currentStatus')}: {formatStatus(ticket.status)}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Intelligent Assignment Toggle */}
          {isAdmin && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Intelligent Assignment</span>
              </div>
              <Button
                type="button"
                variant={showIntelligentMode ? "default" : "outline"}
                size="sm"
                onClick={() => setShowIntelligentMode(!showIntelligentMode)}
                disabled={isLoadingSuggestion}
              >
                {isLoadingSuggestion ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Zap className="h-3 w-3 mr-1" />
                )}
                {showIntelligentMode ? 'Manual' : 'AI Mode'}
              </Button>
            </div>
          )}

          {/* Intelligent Suggestion Display */}
          {isAdmin && showIntelligentMode && intelligentSuggestion && (
            <div className="space-y-3">
              {intelligentSuggestion.success ? (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
                  <Brain className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium text-green-800 dark:text-green-200">
                        AI Recommendation: {intelligentSuggestion.assignedAgent?.full_name}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        {intelligentSuggestion.reason}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Confidence: {Math.round(intelligentSuggestion.confidence)}%
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {intelligentSuggestion.reason}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isAdmin ? (
            <div className="space-y-4">
              <Label htmlFor="agent-select">{t('tickets.assign.selectAgent')}</Label>
              <Select
                value={selectedAgent}
                onValueChange={setSelectedAgent}
                disabled={isLoadingAgents}
              >
                <SelectTrigger id="agent-select" className="w-full">
                  <SelectValue placeholder={t('tickets.assign.selectAgentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => {
                    const metrics = agentMetrics.find(m => m.id === agent.id);
                    const isRecommended = intelligentSuggestion?.assignedAgent?.id === agent.id;
                    
                    return (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2 w-full">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={agent.avatar_url || ''} />
                            <AvatarFallback>{getInitials(agent.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span>{agent.full_name}</span>
                              {isRecommended && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  AI Pick
                                </Badge>
                              )}
                              {agent.role === 'admin' && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('common.admin')}
                                </Badge>
                              )}
                            </div>
                            {metrics && (
                              <div className="text-xs text-muted-foreground">
                                {metrics.currentWorkload}/{metrics.maxConcurrentTickets} tickets • {metrics.availability}
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('tickets.assign.assignToMe')}
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium">{t('tickets.assign.aboutToAssign')}</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>{t('tickets.assign.responsibility1')}</li>
              <li>{t('tickets.assign.responsibility2')}</li>
              <li>{t('tickets.assign.responsibility3')}</li>
              <li>{t('tickets.assign.responsibility4')}</li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            
            {/* Intelligent Assignment Button */}
            {isAdmin && intelligentSuggestion?.success && (
              <Button
                type="button"
                onClick={handleIntelligentAssign}
                disabled={isLoading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Assign with AI
                  </>
                )}
              </Button>
            )}
            
            <Button
              type="submit"
              disabled={!selectedAgent || isLoading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('tickets.assign.assigning')}
                </>
              ) : isAdmin ? (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  {t('tickets.assign.assignToAgent')}
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  {t('tickets.assign.assignToMe')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 