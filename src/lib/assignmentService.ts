import { supabase } from '@/lib/supabase';
import { NotificationService } from './notificationService';
import { assignmentRulesService } from './assignmentRulesService';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];
type TicketPriority = Database['public']['Enums']['ticket_priority'];
type TicketStatus = Database['public']['Enums']['ticket_status'];

export interface AgentMetrics {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string | null;
  currentWorkload: number;
  maxConcurrentTickets: number;
  averageResolutionTime: number;
  resolutionRate: number;
  customerSatisfactionScore: number;
  availability: 'available' | 'busy' | 'away' | 'offline';
  lastActivity: Date;
  specializations: string[];
  languages: string[];
  workingHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  // Phase 2 enhancements
  skillTags: string[];
  categoryExpertise: Record<string, number>; // category_id -> expertise_score (0-1)
  subcategoryExpertise?: Record<string, number>; // subcategory_id -> expertise_score (0-1)
  customerHistory: {
    totalCustomersServed: number;
    repeatCustomerRate: number;
    averageCustomerSatisfaction: number;
  };
  geographicPreference?: string[];
  certifications: string[];
}

export interface AssignmentRule {
  name: string;
  priority: number;
  enabled: boolean;
  conditions: {
    category?: string[];
    priority?: TicketPriority[];
    customerTier?: string[];
    timeOfDay?: string;
  };
  actions: {
    assignToAgent?: string;
    assignToTeam?: string;
    requireSkills?: string[];
    maxResponseTime?: number;
  };
}

export interface AssignmentResult {
  success: boolean;
  assignedAgent?: AgentMetrics;
  reason: string;
  confidence: number;
  alternativeAgents?: AgentMetrics[];
}

class AssignmentService {
  private readonly MAX_CONCURRENT_TICKETS = 10;
  // Phase 2: Enhanced scoring weights
  private readonly WORKLOAD_WEIGHT = 0.25;
  private readonly PERFORMANCE_WEIGHT = 0.25;
  private readonly AVAILABILITY_WEIGHT = 0.2;
  private readonly SKILL_MATCH_WEIGHT = 0.15;
  private readonly CUSTOMER_HISTORY_WEIGHT = 0.15;

  /**
   * Get all available agents with their current metrics
   */
  async getAvailableAgents(): Promise<AgentMetrics[]> {
    try {
      // Get all agents and admins
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['agent', 'admin']);

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        return [];
      }

      // Get current workload for each agent
      const agentMetrics = await Promise.all(
        users.map(async (user) => {
          const workload = await this.getAgentWorkload(user.id);
          const performance = await this.getAgentPerformance(user.id);
          const availability = await this.getAgentAvailability(user.id);

          const skillsAndHistory = await this.getAgentSkillsAndHistory(user.id);

          return {
            id: user.id,
            full_name: user.full_name || user.email,
            email: user.email,
            role: user.role as UserRole,
            avatar_url: user.avatar_url,
            currentWorkload: workload.activeTickets,
            maxConcurrentTickets: this.MAX_CONCURRENT_TICKETS,
            averageResolutionTime: performance.averageResolutionTime,
            resolutionRate: performance.resolutionRate,
            customerSatisfactionScore: performance.satisfactionScore,
            availability: availability.status,
            lastActivity: availability.lastActivity,
            specializations: skillsAndHistory.specializations,
            languages: skillsAndHistory.languages,
            skillTags: skillsAndHistory.skillTags,
            categoryExpertise: skillsAndHistory.categoryExpertise,
            customerHistory: skillsAndHistory.customerHistory,
            geographicPreference: skillsAndHistory.geographicPreference,
            certifications: skillsAndHistory.certifications,
          } as AgentMetrics;
        })
      );

      return agentMetrics.filter(agent => agent.availability !== 'offline');
    } catch (error) {
      console.error('Error getting available agents:', error);
      return [];
    }
  }

  /**
   * Get agent's current workload
   */
  private async getAgentWorkload(agentId: string) {
    try {
      const { data: tickets, error } = await supabase
        .from('tickets_new')
        .select('id, priority, created_at')
        .eq('assigned_to', agentId)
        .in('status', ['open', 'pending', 'in_progress']);

      if (error) throw error;

      const activeTickets = tickets?.length || 0;
      
      // Calculate weighted workload based on priority
      const weightedWorkload = tickets?.reduce((total, ticket) => {
        const priorityWeight = this.getPriorityWeight(ticket.priority);
        return total + priorityWeight;
      }, 0) || 0;

      return {
        activeTickets,
        weightedWorkload,
      };
    } catch (error) {
      console.error('Error getting agent workload:', error);
      return { activeTickets: 0, weightedWorkload: 0 };
    }
  }

  /**
   * Get agent's performance metrics
   */
  private async getAgentPerformance(agentId: string) {
    try {
      // Get resolved tickets from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: resolvedTickets, error } = await supabase
        .from('tickets_new')
        .select('created_at, resolved_at, priority')
        .eq('resolved_by', agentId)
        .eq('status', 'resolved')
        .gte('resolved_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      const totalTickets = resolvedTickets?.length || 0;
      
      if (totalTickets === 0) {
        return {
          averageResolutionTime: 24, // Default 24 hours
          resolutionRate: 0.8, // Default 80%
          satisfactionScore: 4.0, // Default 4.0/5.0
        };
      }

      // Calculate average resolution time in hours
      const totalResolutionTime = resolvedTickets?.reduce((total, ticket) => {
        const created = new Date(ticket.created_at);
        const resolved = new Date(ticket.resolved_at!);
        const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
        return total + hours;
      }, 0) || 0;

      const averageResolutionTime = totalResolutionTime / totalTickets;

      // TODO: Get actual satisfaction scores from feedback
      const satisfactionScore = 4.2; // Placeholder

      return {
        averageResolutionTime,
        resolutionRate: 0.85, // Placeholder - calculate from actual data
        satisfactionScore,
      };
    } catch (error) {
      console.error('Error getting agent performance:', error);
      return {
        averageResolutionTime: 24,
        resolutionRate: 0.8,
        satisfactionScore: 4.0,
      };
    }
  }

  /**
   * Get agent's current availability status
   */
  private async getAgentAvailability(agentId: string) {
    try {
      // Check if agent has been active recently (last 15 minutes)
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

      // TODO: Implement actual activity tracking
      // For now, assume agents are available during business hours
      const now = new Date();
      const hour = now.getHours();
      const isBusinessHours = hour >= 9 && hour <= 17;

      return {
        status: isBusinessHours ? 'available' : 'away' as const,
        lastActivity: new Date(),
      };
    } catch (error) {
      console.error('Error getting agent availability:', error);
      return {
        status: 'available' as const,
        lastActivity: new Date(),
      };
    }
  }

  /**
   * Find the best agent for a ticket using intelligent assignment
   */
  async findBestAgent(ticketData: {
    priority: TicketPriority;
    category_id?: string;
    title: string;
    description: string;
  }): Promise<AssignmentResult> {
    try {
      const availableAgents = await this.getAvailableAgents();

      if (availableAgents.length === 0) {
        return {
          success: false,
          reason: 'No available agents found',
          confidence: 0,
        };
      }

      // Filter out agents at capacity
      const availableCapacityAgents = availableAgents.filter(
        agent => agent.currentWorkload < agent.maxConcurrentTickets
      );

      if (availableCapacityAgents.length === 0) {
        return {
          success: false,
          reason: 'All agents are at capacity',
          confidence: 0,
          alternativeAgents: availableAgents.slice(0, 3),
        };
      }

      // Score each agent based on multiple factors
      const scoredAgents = availableCapacityAgents.map(agent => {
        const workloadScore = this.calculateWorkloadScore(agent);
        const performanceScore = this.calculatePerformanceScore(agent);
        const availabilityScore = this.calculateAvailabilityScore(agent);

        const totalScore = 
          (workloadScore * this.WORKLOAD_WEIGHT) +
          (performanceScore * this.PERFORMANCE_WEIGHT) +
          (availabilityScore * this.AVAILABILITY_WEIGHT);

        return {
          agent,
          score: totalScore,
          breakdown: {
            workload: workloadScore,
            performance: performanceScore,
            availability: availabilityScore,
          },
        };
      });

      // Sort by score (highest first)
      scoredAgents.sort((a, b) => b.score - a.score);

      const bestAgent = scoredAgents[0];

      return {
        success: true,
        assignedAgent: bestAgent.agent,
        reason: `Selected based on optimal workload balance (${bestAgent.agent.currentWorkload} active tickets) and performance metrics`,
        confidence: Math.min(bestAgent.score * 100, 95),
        alternativeAgents: scoredAgents.slice(1, 4).map(s => s.agent),
      };
    } catch (error) {
      console.error('Error finding best agent:', error);
      return {
        success: false,
        reason: 'Error occurred during agent selection',
        confidence: 0,
      };
    }
  }

  /**
   * Assign a ticket to an agent with intelligent selection
   */
  async assignTicket(ticketId: string, agentId?: string): Promise<AssignmentResult> {
    try {
      // Get ticket details
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets_new')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      let assignmentResult: AssignmentResult;

      // First, try rule-based assignment if no specific agent is provided
      if (!agentId) {
        try {
          const ruleResult = await assignmentRulesService.evaluateTicket({
            id: ticket.id,
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            category_id: ticket.category_id,
            user_id: ticket.user_id,
            created_at: ticket.created_at,
          });

          if (ruleResult.success && ruleResult.assignedAgent) {
            // Rule-based assignment succeeded
            const agents = await this.getAvailableAgents();
            const ruleAgent = agents.find(a => a.id === ruleResult.assignedAgent);
            
            if (ruleAgent && ruleAgent.currentWorkload < ruleAgent.maxConcurrentTickets) {
              assignmentResult = {
                success: true,
                assignedAgent: ruleAgent,
                reason: `Rule-based assignment: ${ruleResult.reason}`,
                confidence: ruleResult.confidence,
              };
            } else {
              // Rule agent not available, fall back to intelligent assignment
              assignmentResult = await this.findBestAgentEnhanced({
                priority: ticket.priority,
                category_id: ticket.category_id,
                subcategory_id: ticket.subcategory_id,
                title: ticket.title,
                description: ticket.description || '',
                user_id: ticket.user_id,
              });
            }
          } else {
            // No rules matched, use intelligent assignment
            assignmentResult = await this.findBestAgentEnhanced({
              priority: ticket.priority,
              category_id: ticket.category_id,
              subcategory_id: ticket.subcategory_id,
              title: ticket.title,
              description: ticket.description || '',
              user_id: ticket.user_id,
            });
          }
        } catch (ruleError) {
          console.warn('Rule-based assignment failed, falling back to intelligent assignment:', ruleError);
          // Fall back to intelligent assignment
          assignmentResult = await this.findBestAgentEnhanced({
            priority: ticket.priority,
            category_id: ticket.category_id,
            title: ticket.title,
            description: ticket.description || '',
            user_id: ticket.user_id,
          });
        }
      } else {
        // Manual assignment - validate agent availability
        const agents = await this.getAvailableAgents();
        const targetAgent = agents.find(a => a.id === agentId);

        if (!targetAgent) {
          return {
            success: false,
            reason: 'Selected agent is not available',
            confidence: 0,
          };
        }

        if (targetAgent.currentWorkload >= targetAgent.maxConcurrentTickets) {
          return {
            success: false,
            reason: 'Selected agent is at capacity',
            confidence: 0,
          };
        }

        assignmentResult = {
          success: true,
          assignedAgent: targetAgent,
          reason: 'Manual assignment',
          confidence: 100,
        };
      }

      if (!assignmentResult.success) {
        return assignmentResult;
      }

      // Update ticket assignment
      const { error: updateError } = await supabase
        .from('tickets_new')
        .update({
          assigned_to: assignmentResult.assignedAgent!.id,
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Create notification for assigned agent
      await NotificationService.createNotification({
        user_id: assignmentResult.assignedAgent!.id,
        type: 'ticket_assigned',
        title: 'New Ticket Assigned',
        message: `You have been assigned ticket #${ticket.ticket_number}: ${ticket.title}`,
        ticket_id: ticketId,
        priority: ticket.priority === 'urgent' ? 'high' : 'medium',
      });

      return assignmentResult;
    } catch (error) {
      console.error('Error assigning ticket:', error);
      return {
        success: false,
        reason: 'Failed to assign ticket',
        confidence: 0,
      };
    }
  }

  /**
   * Rebalance workload across agents
   */
  async rebalanceWorkload(): Promise<{
    success: boolean;
    reassignments: number;
    message: string;
  }> {
    try {
      const agents = await this.getAvailableAgents();
      
      if (agents.length < 2) {
        return {
          success: false,
          reassignments: 0,
          message: 'Need at least 2 agents for rebalancing',
        };
      }

      // Find overloaded and underloaded agents
      const averageWorkload = agents.reduce((sum, agent) => sum + agent.currentWorkload, 0) / agents.length;
      const overloadedAgents = agents.filter(agent => agent.currentWorkload > averageWorkload + 2);
      const underloadedAgents = agents.filter(agent => agent.currentWorkload < averageWorkload - 1);

      if (overloadedAgents.length === 0 || underloadedAgents.length === 0) {
        return {
          success: true,
          reassignments: 0,
          message: 'Workload is already balanced',
        };
      }

      let reassignments = 0;

      // Reassign tickets from overloaded to underloaded agents
      for (const overloadedAgent of overloadedAgents) {
        // Get their lowest priority open tickets
        const { data: tickets, error } = await supabase
          .from('tickets_new')
          .select('id, priority, created_at')
          .eq('assigned_to', overloadedAgent.id)
          .in('status', ['open', 'pending'])
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(2);

        if (error || !tickets || tickets.length === 0) continue;

        for (const ticket of tickets) {
          const targetAgent = underloadedAgents.find(agent => 
            agent.currentWorkload < agent.maxConcurrentTickets - 1
          );

          if (!targetAgent) break;

          // Reassign ticket
          const { error: updateError } = await supabase
            .from('tickets_new')
            .update({
              assigned_to: targetAgent.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);

          if (!updateError) {
            reassignments++;
            targetAgent.currentWorkload++;
            overloadedAgent.currentWorkload--;

            // Notify both agents
            await NotificationService.createNotification({
              user_id: targetAgent.id,
              type: 'assignment_changed',
              title: 'Ticket Reassigned to You',
              message: `Ticket has been reassigned to you for workload balancing`,
              ticket_id: ticket.id,
              priority: 'medium',
            });
          }
        }
      }

      return {
        success: true,
        reassignments,
        message: `Successfully rebalanced ${reassignments} tickets`,
      };
    } catch (error) {
      console.error('Error rebalancing workload:', error);
      return {
        success: false,
        reassignments: 0,
        message: 'Failed to rebalance workload',
      };
    }
  }

  /**
   * Calculate workload score (higher is better - less workload)
   */
  private calculateWorkloadScore(agent: AgentMetrics): number {
    const utilizationRate = agent.currentWorkload / agent.maxConcurrentTickets;
    return Math.max(0, 1 - utilizationRate);
  }

  /**
   * Calculate performance score (higher is better)
   */
  private calculatePerformanceScore(agent: AgentMetrics): number {
    // Normalize resolution rate (0-1) and satisfaction score (0-1 from 0-5)
    const resolutionScore = agent.resolutionRate;
    const satisfactionScore = agent.customerSatisfactionScore / 5;
    
    // Average resolution time score (inverse - faster is better)
    const timeScore = Math.max(0, 1 - (agent.averageResolutionTime / 48)); // 48 hours as baseline
    
    return (resolutionScore + satisfactionScore + timeScore) / 3;
  }

  /**
   * Calculate availability score (higher is better)
   */
  private calculateAvailabilityScore(agent: AgentMetrics): number {
    switch (agent.availability) {
      case 'available': return 1.0;
      case 'busy': return 0.7;
      case 'away': return 0.3;
      case 'offline': return 0.0;
      default: return 0.5;
    }
  }

  /**
   * Get agent's skills and customer history (Phase 2)
   */
  private async getAgentSkillsAndHistory(agentId: string) {
    try {
      // Get agent's explicit category expertise from database
      const { data: categoryExpertise, error: categoryError } = await supabase
        .from('agent_category_expertise')
        .select(`
          category_id,
          expertise_level,
          is_primary,
          categories!inner(name)
        `)
        .eq('agent_id', agentId);

      if (categoryError) throw categoryError;

      // Get agent's subcategory expertise
      const { data: subcategoryExpertise, error: subcategoryError } = await supabase
        .from('agent_subcategory_expertise')
        .select(`
          subcategory_id,
          expertise_level,
          is_primary,
          subcategories!inner(name, category_id)
        `)
        .eq('agent_id', agentId);

      if (subcategoryError) throw subcategoryError;

      // Convert expertise levels to numeric scores
      const expertiseToScore = {
        'expert': 1.0,
        'intermediate': 0.7,
        'basic': 0.4
      };

      // Build category expertise map
      const categoryExpertiseMap: Record<string, number> = {};
      categoryExpertise?.forEach(exp => {
        const baseScore = expertiseToScore[exp.expertise_level as keyof typeof expertiseToScore] || 0.4;
        const primaryBonus = exp.is_primary ? 0.2 : 0;
        categoryExpertiseMap[exp.category_id] = Math.min(baseScore + primaryBonus, 1.0);
      });

      // Build subcategory expertise map
      const subcategoryExpertiseMap: Record<string, number> = {};
      subcategoryExpertise?.forEach(exp => {
        const baseScore = expertiseToScore[exp.expertise_level as keyof typeof expertiseToScore] || 0.4;
        const primaryBonus = exp.is_primary ? 0.2 : 0;
        subcategoryExpertiseMap[exp.subcategory_id] = Math.min(baseScore + primaryBonus, 1.0);
      });

      // Fallback: Get agent's category expertise based on resolved tickets for agents without explicit expertise
      if (Object.keys(categoryExpertiseMap).length === 0) {
        const { data: categoryStats, error: statsError } = await supabase
          .from('tickets_new')
          .select('category_id, resolved_at')
          .eq('resolved_by', agentId)
          .eq('status', 'resolved')
          .not('category_id', 'is', null);

        if (!statsError && categoryStats && categoryStats.length > 0) {
          const categoryGroups = categoryStats.reduce((acc, ticket) => {
            const catId = ticket.category_id!;
            acc[catId] = (acc[catId] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const maxTickets = Math.max(...Object.values(categoryGroups));
          Object.entries(categoryGroups).forEach(([catId, count]) => {
            categoryExpertiseMap[catId] = Math.min(count / Math.max(maxTickets, 10), 1);
          });
        }
      }

      // Get customer history metrics
      const { data: customerStats, error: customerError } = await supabase
        .from('tickets_new')
        .select('user_id, resolved_at')
        .eq('resolved_by', agentId)
        .eq('status', 'resolved');

      if (customerError) throw customerError;

      const totalCustomersServed = new Set(customerStats?.map(t => t.user_id) || []).size;
      const totalTickets = customerStats?.length || 0;
      const repeatCustomerRate = totalTickets > 0 ? 
        (totalTickets - totalCustomersServed) / totalTickets : 0;

      // For now, return default/calculated values
      // In a real implementation, these would come from agent profiles or be calculated from more data
      return {
        specializations: this.getAgentSpecializations(agentId, categoryExpertiseMap),
        languages: ['en'], // Default to English, could be expanded
        skillTags: this.generateSkillTags(categoryExpertiseMap),
        categoryExpertise: categoryExpertiseMap,
        subcategoryExpertise: subcategoryExpertiseMap,
        customerHistory: {
          totalCustomersServed,
          repeatCustomerRate,
          averageCustomerSatisfaction: 4.2, // Placeholder
        },
        geographicPreference: [], // Could be expanded based on customer locations
        certifications: [], // Could be expanded with actual certification data
      };
    } catch (error) {
      console.error('Error getting agent skills and history:', error);
      return {
        specializations: [],
        languages: ['en'],
        skillTags: [],
        categoryExpertise: {},
        customerHistory: {
          totalCustomersServed: 0,
          repeatCustomerRate: 0,
          averageCustomerSatisfaction: 4.0,
        },
        geographicPreference: [],
        certifications: [],
      };
    }
  }

  /**
   * Generate agent specializations based on category expertise
   */
  private getAgentSpecializations(agentId: string, categoryExpertise: Record<string, number>): string[] {
    const specializations: string[] = [];
    
    // Add specializations based on high category expertise
    Object.entries(categoryExpertise).forEach(([categoryId, score]) => {
      if (score > 0.7) {
        // Map category IDs to specialization names
        // This would ideally come from the categories table
        specializations.push(`Category ${categoryId}`);
      }
    });

    return specializations;
  }

  /**
   * Generate skill tags based on category expertise
   */
  private generateSkillTags(categoryExpertise: Record<string, number>): string[] {
    const skillTags: string[] = [];
    
    // Generate skill tags based on category expertise
    Object.entries(categoryExpertise).forEach(([categoryId, score]) => {
      if (score > 0.5) {
        skillTags.push(`cat-${categoryId}`);
      }
    });

    return skillTags;
  }

  /**
   * Calculate skill match score for Phase 2 (enhanced assignment)
   */
  private calculateSkillMatchScore(agent: AgentMetrics, ticketData: {
    priority: TicketPriority;
    category_id?: string;
    subcategory_id?: string;
    title: string;
    description: string;
  }): number {
    let skillScore = 0.5; // Base score

    // Category expertise matching - highest priority
    if (ticketData.category_id && agent.categoryExpertise[ticketData.category_id]) {
      skillScore = Math.max(skillScore, agent.categoryExpertise[ticketData.category_id]);
    }

    // Subcategory expertise matching - even higher priority if available
    if (ticketData.subcategory_id && agent.subcategoryExpertise && agent.subcategoryExpertise[ticketData.subcategory_id]) {
      skillScore = Math.max(skillScore, agent.subcategoryExpertise[ticketData.subcategory_id]);
    }

    // Skill tag matching (could be expanded with NLP analysis of title/description)
    const titleWords = ticketData.title.toLowerCase().split(' ');
    const descriptionWords = ticketData.description.toLowerCase().split(' ');
    const ticketKeywords = [...titleWords, ...descriptionWords];

    let keywordMatches = 0;
    agent.skillTags.forEach(tag => {
      if (ticketKeywords.some(word => tag.includes(word) || word.includes(tag))) {
        keywordMatches++;
      }
    });

    if (agent.skillTags.length > 0) {
      const keywordMatchScore = keywordMatches / agent.skillTags.length;
      skillScore = Math.max(skillScore, keywordMatchScore * 0.8); // Weight keyword matching slightly lower
    }

    return Math.min(skillScore, 1);
  }

  /**
   * Calculate customer history score for Phase 2
   */
  private calculateCustomerHistoryScore(agent: AgentMetrics, customerId?: string): number {
    // Base score from overall customer satisfaction
    let historyScore = agent.customerHistory.averageCustomerSatisfaction / 5;

    // Bonus for high repeat customer rate (indicates good customer relationships)
    if (agent.customerHistory.repeatCustomerRate > 0.3) {
      historyScore += 0.2;
    }

    // Bonus for serving many customers (experience)
    if (agent.customerHistory.totalCustomersServed > 50) {
      historyScore += 0.1;
    }

    // TODO: Add bonus if agent has previously helped this specific customer
    // This would require checking ticket history for the customer

    return Math.min(historyScore, 1);
  }

  /**
   * Enhanced findBestAgent with Phase 2 features
   */
  async findBestAgentEnhanced(ticketData: {
    priority: TicketPriority;
    category_id?: string;
    subcategory_id?: string;
    title: string;
    description: string;
    user_id?: string;
    customer_tier?: string;
    language_preference?: string;
  }): Promise<AssignmentResult> {
    try {
      const availableAgents = await this.getAvailableAgents();

      if (availableAgents.length === 0) {
        return {
          success: false,
          reason: 'No available agents found',
          confidence: 0,
        };
      }

      // Filter out agents at capacity
      const availableCapacityAgents = availableAgents.filter(
        agent => agent.currentWorkload < agent.maxConcurrentTickets
      );

      if (availableCapacityAgents.length === 0) {
        return {
          success: false,
          reason: 'All agents are at capacity',
          confidence: 0,
          alternativeAgents: availableAgents.slice(0, 3),
        };
      }

      // Enhanced scoring with Phase 2 features
      const scoredAgents = availableCapacityAgents.map(agent => {
        const workloadScore = this.calculateWorkloadScore(agent);
        const performanceScore = this.calculatePerformanceScore(agent);
        const availabilityScore = this.calculateAvailabilityScore(agent);
        const skillMatchScore = this.calculateSkillMatchScore(agent, ticketData);
        const customerHistoryScore = this.calculateCustomerHistoryScore(agent, ticketData.user_id);

        // Language preference matching
        let languageBonus = 0;
        if (ticketData.language_preference && agent.languages.includes(ticketData.language_preference)) {
          languageBonus = 0.1;
        }

        const totalScore = 
          (workloadScore * this.WORKLOAD_WEIGHT) +
          (performanceScore * this.PERFORMANCE_WEIGHT) +
          (availabilityScore * this.AVAILABILITY_WEIGHT) +
          (skillMatchScore * this.SKILL_MATCH_WEIGHT) +
          (customerHistoryScore * this.CUSTOMER_HISTORY_WEIGHT) +
          languageBonus;

        return {
          agent,
          score: totalScore,
          breakdown: {
            workload: workloadScore,
            performance: performanceScore,
            availability: availabilityScore,
            skillMatch: skillMatchScore,
            customerHistory: customerHistoryScore,
            languageBonus,
          },
        };
      });

      // Sort by score (highest first)
      scoredAgents.sort((a, b) => b.score - a.score);

      const bestAgent = scoredAgents[0];
      
      // Generate detailed reasoning
      const reasons = [];
      if (bestAgent.breakdown.skillMatch > 0.7) {
        reasons.push('strong skill match');
      }
      if (bestAgent.breakdown.customerHistory > 0.8) {
        reasons.push('excellent customer history');
      }
      if (bestAgent.breakdown.workload > 0.8) {
        reasons.push('optimal workload');
      }
      if (bestAgent.breakdown.languageBonus > 0) {
        reasons.push('language preference match');
      }

      const reasonText = reasons.length > 0 
        ? `Selected based on ${reasons.join(', ')} (${bestAgent.agent.currentWorkload} active tickets)`
        : `Selected based on optimal workload balance (${bestAgent.agent.currentWorkload} active tickets) and performance metrics`;

      return {
        success: true,
        assignedAgent: bestAgent.agent,
        reason: reasonText,
        confidence: Math.min(bestAgent.score * 100, 95),
        alternativeAgents: scoredAgents.slice(1, 4).map(s => s.agent),
      };
    } catch (error) {
      console.error('Error finding best agent (enhanced):', error);
      return {
        success: false,
        reason: 'Error occurred during agent selection',
        confidence: 0,
      };
    }
  }

  /**
   * Get priority weight for workload calculation
   */
  private getPriorityWeight(priority: TicketPriority): number {
    switch (priority) {
      case 'urgent': return 3;
      case 'high': return 2;
      case 'medium': return 1.5;
      case 'low': return 1;
      default: return 1;
    }
  }
}

export const assignmentService = new AssignmentService();