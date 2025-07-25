import { supabase } from '@/lib/supabase';
import type { Database } from '@/integrations/supabase/types';
import { assignmentService, type AgentMetrics, type AssignmentResult } from './assignmentService';

type TicketPriority = Database['public']['Enums']['ticket_priority'];
type UserRole = Database['public']['Enums']['user_role'];

export interface AssignmentRule {
  id: string;
  name: string;
  description: string;
  priority: number; // Higher number = higher priority
  enabled: boolean;
  conditions: {
    categories?: string[];
    priorities?: TicketPriority[];
    customerTiers?: string[];
    timeOfDay?: {
      start: string; // HH:MM format
      end: string;   // HH:MM format
    };
    keywords?: string[];
    urgencyLevel?: number;
    customerLanguage?: string[];
    geographicRegion?: string[];
  };
  actions: {
    assignToSpecificAgent?: string;
    assignToTeam?: string;
    requireSkills?: string[];
    requireCertifications?: string[];
    maxResponseTime?: number; // in minutes
    escalateAfter?: number; // in minutes
    notifyManager?: boolean;
    priorityBoost?: number; // 0-1 multiplier
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CustomerProfile {
  id: string;
  user_id: string;
  tier: 'basic' | 'premium' | 'enterprise' | 'vip';
  language_preference: string;
  timezone: string;
  geographic_region?: string;
  preferred_agent_id?: string;
  communication_style?: 'formal' | 'casual' | 'technical';
  previous_interactions: {
    agent_id: string;
    satisfaction_score: number;
    interaction_date: string;
    resolution_time: number;
  }[];
  escalation_history: {
    ticket_id: string;
    escalated_at: string;
    reason: string;
  }[];
  satisfaction_trend: number; // -1 to 1, trending satisfaction
  total_tickets: number;
  avg_resolution_time: number;
  created_at: string;
  updated_at: string;
}

class AssignmentRulesEngine {
  /**
   * Get all active assignment rules ordered by priority
   */
  async getActiveRules(): Promise<AssignmentRule[]> {
    try {
      // For now, return default rules since we don't have a rules table yet
      // In a real implementation, this would query a database table
      return this.getDefaultRules();
    } catch (error) {
      console.error('Error getting assignment rules:', error);
      return this.getDefaultRules();
    }
  }

  /**
   * Get default assignment rules
   */
  private getDefaultRules(): AssignmentRule[] {
    return [
      {
        id: 'urgent-priority-rule',
        name: 'Urgent Priority Assignment',
        description: 'Assign urgent tickets to most experienced agents',
        priority: 100,
        enabled: true,
        conditions: {
          priorities: ['urgent'],
        },
        actions: {
          requireSkills: ['urgent-handling'],
          maxResponseTime: 15, // 15 minutes
          notifyManager: true,
          priorityBoost: 0.3,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
      },
      {
        id: 'vip-customer-rule',
        name: 'VIP Customer Priority',
        description: 'Route VIP customers to senior agents',
        priority: 90,
        enabled: true,
        conditions: {
          customerTiers: ['vip', 'enterprise'],
        },
        actions: {
          requireSkills: ['vip-handling'],
          maxResponseTime: 30,
          priorityBoost: 0.2,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
      },
      {
        id: 'technical-category-rule',
        name: 'Technical Issues Routing',
        description: 'Route technical issues to technical specialists',
        priority: 70,
        enabled: true,
        conditions: {
          keywords: ['server', 'database', 'api', 'integration', 'bug', 'error'],
        },
        actions: {
          requireSkills: ['technical-support'],
          requireCertifications: ['technical-cert'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
      },
      {
        id: 'business-hours-rule',
        name: 'Business Hours Assignment',
        description: 'Prefer available agents during business hours',
        priority: 50,
        enabled: true,
        conditions: {
          timeOfDay: {
            start: '09:00',
            end: '17:00',
          },
        },
        actions: {
          priorityBoost: 0.1,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
      },
    ];
  }

  /**
   * Get customer profile with history and preferences
   */
  async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
    try {
      // Get customer's ticket history
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets_new')
        .select(`
          id,
          assigned_to,
          resolved_at,
          created_at,
          priority,
          status,
          users!tickets_new_assigned_to_fkey(full_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      if (!tickets || tickets.length === 0) {
        return null;
      }

      // Calculate customer metrics
      const resolvedTickets = tickets.filter(t => t.status === 'resolved' && t.resolved_at);
      const totalResolutionTime = resolvedTickets.reduce((total, ticket) => {
        const created = new Date(ticket.created_at);
        const resolved = new Date(ticket.resolved_at!);
        return total + (resolved.getTime() - created.getTime());
      }, 0);

      const avgResolutionTime = resolvedTickets.length > 0 
        ? totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      // Build interaction history
      const previousInteractions = tickets
        .filter(t => t.assigned_to)
        .map(ticket => ({
          agent_id: ticket.assigned_to!,
          satisfaction_score: 4.0, // Placeholder - would come from feedback
          interaction_date: ticket.created_at,
          resolution_time: ticket.resolved_at 
            ? (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
            : 0,
        }));

      // Determine customer tier based on ticket volume and history
      let tier: CustomerProfile['tier'] = 'basic';
      if (tickets.length > 50) tier = 'enterprise';
      else if (tickets.length > 20) tier = 'premium';
      else if (tickets.length > 10) tier = 'premium';

      // Find preferred agent (most frequently assigned)
      const agentCounts = tickets.reduce((acc, ticket) => {
        if (ticket.assigned_to) {
          acc[ticket.assigned_to] = (acc[ticket.assigned_to] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const preferredAgentId = Object.entries(agentCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0];

      return {
        id: `profile-${userId}`,
        user_id: userId,
        tier,
        language_preference: 'en', // Default, could be expanded
        timezone: 'UTC', // Default, could be expanded
        preferred_agent_id: preferredAgentId,
        communication_style: 'formal', // Default
        previous_interactions: previousInteractions,
        escalation_history: [], // Would be populated from escalation data
        satisfaction_trend: 0, // Would be calculated from feedback trends
        total_tickets: tickets.length,
        avg_resolution_time: avgResolutionTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting customer profile:', error);
      return null;
    }
  }

  /**
   * Apply assignment rules to find the best agent
   */
  async applyRules(ticketData: {
    priority: TicketPriority;
    category_id?: string;
    title: string;
    description: string;
    user_id: string;
  }): Promise<AssignmentResult> {
    try {
      const rules = await this.getActiveRules();
      const customerProfile = await this.getCustomerProfile(ticketData.user_id);
      const availableAgents = await assignmentService.getAvailableAgents();

      if (availableAgents.length === 0) {
        return {
          success: false,
          reason: 'No available agents found',
          confidence: 0,
        };
      }

      // Apply rules to filter and score agents
      let applicableRules: AssignmentRule[] = [];
      let ruleReasons: string[] = [];

      for (const rule of rules) {
        if (this.doesRuleApply(rule, ticketData, customerProfile)) {
          applicableRules.push(rule);
          ruleReasons.push(rule.name);
        }
      }

      // Filter agents based on rule requirements
      let eligibleAgents = availableAgents.filter(agent => 
        agent.currentWorkload < agent.maxConcurrentTickets
      );

      // Apply rule-based filtering
      for (const rule of applicableRules) {
        if (rule.actions.assignToSpecificAgent) {
          const specificAgent = eligibleAgents.find(a => a.id === rule.actions.assignToSpecificAgent);
          if (specificAgent) {
            return {
              success: true,
              assignedAgent: specificAgent,
              reason: `Assigned by rule: ${rule.name}`,
              confidence: 95,
            };
          }
        }

        if (rule.actions.requireSkills && rule.actions.requireSkills.length > 0) {
          eligibleAgents = eligibleAgents.filter(agent => 
            rule.actions.requireSkills!.some(skill => 
              agent.skillTags.includes(skill) || agent.specializations.includes(skill)
            )
          );
        }

        if (rule.actions.requireCertifications && rule.actions.requireCertifications.length > 0) {
          eligibleAgents = eligibleAgents.filter(agent => 
            rule.actions.requireCertifications!.some(cert => 
              agent.certifications.includes(cert)
            )
          );
        }
      }

      if (eligibleAgents.length === 0) {
        return {
          success: false,
          reason: 'No agents meet the rule requirements',
          confidence: 0,
          alternativeAgents: availableAgents.slice(0, 3),
        };
      }

      // Score agents with rule-based bonuses
      const scoredAgents = eligibleAgents.map(agent => {
        let baseScore = this.calculateBaseScore(agent);
        let ruleBonus = 0;

        // Apply rule bonuses
        for (const rule of applicableRules) {
          if (rule.actions.priorityBoost) {
            ruleBonus += rule.actions.priorityBoost;
          }
        }

        // Customer history bonus
        if (customerProfile?.preferred_agent_id === agent.id) {
          ruleBonus += 0.25; // 25% bonus for preferred agent
        }

        // Language preference bonus
        if (customerProfile?.language_preference && 
            agent.languages.includes(customerProfile.language_preference)) {
          ruleBonus += 0.1;
        }

        const totalScore = Math.min(baseScore + ruleBonus, 1);

        return {
          agent,
          score: totalScore,
          ruleBonus,
        };
      });

      // Sort by score
      scoredAgents.sort((a, b) => b.score - a.score);

      const bestAgent = scoredAgents[0];
      const reasonParts = [];

      if (ruleReasons.length > 0) {
        reasonParts.push(`Applied rules: ${ruleReasons.join(', ')}`);
      }

      if (customerProfile?.preferred_agent_id === bestAgent.agent.id) {
        reasonParts.push('preferred agent match');
      }

      if (bestAgent.ruleBonus > 0) {
        reasonParts.push(`rule bonus: +${Math.round(bestAgent.ruleBonus * 100)}%`);
      }

      const reason = reasonParts.length > 0 
        ? reasonParts.join('; ')
        : `Selected based on optimal scoring (${bestAgent.agent.currentWorkload} active tickets)`;

      return {
        success: true,
        assignedAgent: bestAgent.agent,
        reason,
        confidence: Math.min(bestAgent.score * 100, 95),
        alternativeAgents: scoredAgents.slice(1, 4).map(s => s.agent),
      };
    } catch (error) {
      console.error('Error applying assignment rules:', error);
      return {
        success: false,
        reason: 'Error occurred during rule-based assignment',
        confidence: 0,
      };
    }
  }

  /**
   * Check if a rule applies to the given ticket and customer
   */
  private doesRuleApply(
    rule: AssignmentRule, 
    ticketData: { priority: TicketPriority; category_id?: string; title: string; description: string },
    customerProfile: CustomerProfile | null
  ): boolean {
    if (!rule.enabled) return false;

    // Check priority conditions
    if (rule.conditions.priorities && 
        !rule.conditions.priorities.includes(ticketData.priority)) {
      return false;
    }

    // Check category conditions
    if (rule.conditions.categories && ticketData.category_id &&
        !rule.conditions.categories.includes(ticketData.category_id)) {
      return false;
    }

    // Check customer tier conditions
    if (rule.conditions.customerTiers && customerProfile &&
        !rule.conditions.customerTiers.includes(customerProfile.tier)) {
      return false;
    }

    // Check keyword conditions
    if (rule.conditions.keywords) {
      const content = `${ticketData.title} ${ticketData.description}`.toLowerCase();
      const hasKeyword = rule.conditions.keywords.some(keyword => 
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check time of day conditions
    if (rule.conditions.timeOfDay) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime < rule.conditions.timeOfDay.start || 
          currentTime > rule.conditions.timeOfDay.end) {
        return false;
      }
    }

    // Check language conditions
    if (rule.conditions.customerLanguage && customerProfile &&
        !rule.conditions.customerLanguage.includes(customerProfile.language_preference)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate base score for an agent
   */
  private calculateBaseScore(agent: AgentMetrics): number {
    const workloadScore = Math.max(0, 1 - (agent.currentWorkload / agent.maxConcurrentTickets));
    const performanceScore = (agent.resolutionRate + (agent.customerSatisfactionScore / 5)) / 2;
    const availabilityScore = agent.availability === 'available' ? 1 : 0.5;

    return (workloadScore * 0.4) + (performanceScore * 0.4) + (availabilityScore * 0.2);
  }

  /**
   * Create or update an assignment rule
   */
  async saveRule(rule: Omit<AssignmentRule, 'id' | 'created_at' | 'updated_at'>): Promise<AssignmentRule> {
    // In a real implementation, this would save to a database
    const newRule: AssignmentRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('Rule saved (mock):', newRule);
    return newRule;
  }

  /**
   * Delete an assignment rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    // In a real implementation, this would delete from database
    console.log('Rule deleted (mock):', ruleId);
    return true;
  }
}

export const assignmentRulesEngine = new AssignmentRulesEngine();