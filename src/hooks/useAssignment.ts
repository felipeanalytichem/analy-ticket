import { useState, useEffect } from 'react';
import { assignmentService, type AgentMetrics, type AssignmentResult } from '@/lib/assignmentService';
import { useToast } from '@/hooks/use-toast';

export const useAssignment = () => {
  const [agents, setAgents] = useState<AgentMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const agentMetrics = await assignmentService.getAvailableAgents();
      setAgents(agentMetrics);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load agents';
      setError(errorMessage);
      console.error('Error loading agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const assignTicket = async (ticketId: string, agentId?: string): Promise<AssignmentResult> => {
    try {
      const result = await assignmentService.assignTicket(ticketId, agentId);
      
      if (result.success) {
        toast({
          title: "Ticket Assigned Successfully",
          description: `Assigned to ${result.assignedAgent?.full_name}. ${result.reason}`,
        });
        // Refresh agents data after assignment
        await loadAgents();
      } else {
        toast({
          title: "Assignment Failed",
          description: result.reason,
          variant: "destructive",
        });
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign ticket';
      toast({
        title: "Assignment Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return {
        success: false,
        reason: errorMessage,
        confidence: 0,
      };
    }
  };

  const findBestAgent = async (ticketData: {
    priority: any;
    category_id?: string;
    title: string;
    description: string;
  }): Promise<AssignmentResult> => {
    try {
      return await assignmentService.findBestAgent(ticketData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to find best agent';
      console.error('Error finding best agent:', err);
      
      return {
        success: false,
        reason: errorMessage,
        confidence: 0,
      };
    }
  };

  const rebalanceWorkload = async () => {
    try {
      const result = await assignmentService.rebalanceWorkload();
      
      if (result.success) {
        toast({
          title: "Workload Rebalanced",
          description: result.message,
        });
        // Refresh agents data after rebalancing
        await loadAgents();
      } else {
        toast({
          title: "Rebalancing Failed",
          description: result.message,
          variant: "destructive",
        });
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rebalance workload';
      toast({
        title: "Rebalancing Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return {
        success: false,
        reassignments: 0,
        message: errorMessage,
      };
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  return {
    agents,
    isLoading,
    error,
    loadAgents,
    assignTicket,
    findBestAgent,
    rebalanceWorkload,
  };
};