import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCheck, 
  Loader2, 
  Users, 
  User, 
  Clock, 
  AlertCircle, 
  UserPlus, 
  Brain,
  TrendingUp,
  Activity,
  CheckCircle,
  Star,
  Zap
} from "lucide-react";
import { assignmentService, type AgentMetrics, type AssignmentResult } from "@/lib/assignmentService";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { useTranslation } from "react-i18next";
import type { TicketWithDetails } from "@/lib/database";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";

interface IntelligentAssignDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export const IntelligentAssignDialog = ({ 
  ticket, 
  open, 
  onOpenChange, 
  onAssigned 
}: IntelligentAssignDialogProps) => {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [agents, setAgents] = useState<AgentMetrics[]>([]);
  const [intelligentSuggestion, setIntelligentSuggestion] = useState<AssignmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<'intelligent' | 'manual'>('intelligent');
  
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

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'text-green-600';
      case 'busy': return 'text-yellow-600';
      case 'away': return 'text-orange-600';
      case 'offline': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAvailabilityIcon = (availability: string) => {
    switch (availability) {
      case 'available': return <CheckCircle className="h-4 w-4" />;
      case 'busy': return <Clock className="h-4 w-4" />;
      case 'away': return <AlertCircle className="h-4 w-4" />;
      case 'offline': return <User className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

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
    if (open && ticket) {
      loadAgents();
      loadIntelligentSuggestion();
      
      // Pre-select current agent if ticket is already assigned
      if (ticket?.assigned_to) {
        setSelectedAgent(ticket.assigned_to);
        setAssignmentMode('manual');
      } else {
        setSelectedAgent("");
        setAssignmentMode('intelligent');
      }
    }
  }, [open, ticket]);

  const loadAgents = async () => {
    setIsLoadingAgents(true);
    try {
      const agentMetrics = await assignmentService.getAvailableAgents();
      setAgents(agentMetrics);
    } catch (err) {
      console.error('Error loading agents:', err);
      setError('Failed to load available agents');
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
        subcategory_id: ticket.subcategory_id,
        title: ticket.title,
        description: ticket.description || '',
      });
      setIntelligentSuggestion(suggestion);
      
      if (suggestion.success && suggestion.assignedAgent) {
        setSelectedAgent(suggestion.assignedAgent.id);
      }
    } catch (err) {
      console.error('Error getting intelligent suggestion:', err);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket) return;

    setIsLoading(true);
    setError(null);

    try {
      let result: AssignmentResult;
      
      if (assignmentMode === 'intelligent' && intelligentSuggestion?.success) {
        // Use intelligent assignment
        result = await assignmentService.assignTicket(ticket.id);
      } else if (selectedAgent) {
        // Use manual assignment
        result = await assignmentService.assignTicket(ticket.id, selectedAgent);
      } else {
        throw new Error('No agent selected');
      }

      if (result.success) {
        toast({
          title: "Ticket Assigned Successfully",
          description: `Assigned to ${result.assignedAgent?.full_name}. ${result.reason}`,
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
      toast({
        title: "Assignment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAgentCard = (agent: AgentMetrics, isRecommended = false) => {
    const utilizationRate = (agent.currentWorkload / agent.maxConcurrentTickets) * 100;
    
    return (
      <Card className={`cursor-pointer transition-all ${
        selectedAgent === agent.id 
          ? 'ring-2 ring-primary border-primary' 
          : 'hover:border-primary/50'
      } ${isRecommended ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : ''}`}
      onClick={() => {
        setSelectedAgent(agent.id);
        setAssignmentMode('manual');
      }}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={agent.avatar_url || undefined} />
              <AvatarFallback>{getInitials(agent.full_name)}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{agent.full_name}</h4>
                {isRecommended && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                    <Star className="h-3 w-3 mr-1" />
                    Recommended
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize">
                  {agent.role}
                </Badge>
              </div>
              
              <div className={`flex items-center gap-1 text-sm mb-2 ${getAvailabilityColor(agent.availability)}`}>
                {getAvailabilityIcon(agent.availability)}
                <span className="capitalize">{agent.availability}</span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Workload</span>
                    <span>{agent.currentWorkload}/{agent.maxConcurrentTickets}</span>
                  </div>
                  <Progress value={utilizationRate} className="h-1" />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Avg Resolution:</span>
                    <div className="font-medium">{Math.round(agent.averageResolutionTime)}h</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Satisfaction:</span>
                    <div className="font-medium">{agent.customerSatisfactionScore.toFixed(1)}/5</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Intelligent Ticket Assignment
          </DialogTitle>
          <DialogDescription>
            Assign ticket #{ticket.ticket_number} using AI-powered agent selection or manual choice
          </DialogDescription>
        </DialogHeader>

        {/* Ticket Summary */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-medium mb-2">{ticket.title}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getPriorityColor(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Created {formatDate(ticket.created_at)}
                  </span>
                </div>
                {ticket.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ticket.description}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={assignmentMode} onValueChange={(value) => setAssignmentMode(value as 'intelligent' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="intelligent" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Intelligent Assignment
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manual Selection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intelligent" className="space-y-4">
            {isLoadingSuggestion ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Analyzing best agent match...</span>
              </div>
            ) : intelligentSuggestion?.success ? (
              <div className="space-y-4">
                <Alert>
                  <Brain className="h-4 w-4" />
                  <AlertDescription>
                    <strong>AI Recommendation:</strong> {intelligentSuggestion.reason}
                    <br />
                    <span className="text-sm text-muted-foreground">
                      Confidence: {Math.round(intelligentSuggestion.confidence)}%
                    </span>
                  </AlertDescription>
                </Alert>
                
                {intelligentSuggestion.assignedAgent && (
                  <div>
                    <h4 className="font-medium mb-2">Recommended Agent:</h4>
                    {renderAgentCard(intelligentSuggestion.assignedAgent, true)}
                  </div>
                )}
                
                {intelligentSuggestion.alternativeAgents && intelligentSuggestion.alternativeAgents.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Alternative Options:</h4>
                    <div className="grid gap-2">
                      {intelligentSuggestion.alternativeAgents.map((agent) => (
                        <div key={agent.id} className="scale-95">
                          {renderAgentCard(agent)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {intelligentSuggestion?.reason || 'Unable to find suitable agent assignment'}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div>
              <Label htmlFor="agent-select" className="text-sm font-medium mb-2 block">
                Select Agent Manually
              </Label>
              
              {isLoadingAgents ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading agents...</span>
                </div>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {agents.map((agent) => (
                    <div key={agent.id}>
                      {renderAgentCard(agent)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || (!selectedAgent && assignmentMode === 'manual')}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {assignmentMode === 'intelligent' ? 'Assign with AI' : 'Assign Selected Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};