import { supabase } from '@/lib/supabase';
import type { AssignmentRule } from '@/components/admin/AssignmentRulesManager';
import type { Database } from '@/integrations/supabase/types';

type TicketPriority = Database['public']['Enums']['ticket_priority'];
type TicketStatus = Database['public']['Enums']['ticket_status'];

export interface TicketData {
    id: string;
    title: string;
    description?: string;
    priority: TicketPriority;
    status: TicketStatus;
    category_id?: string;
    user_id: string;
    created_at: string;
}

export interface RuleMatchResult {
    rule: AssignmentRule;
    matches: boolean;
    matchedConditions: string[];
    confidence: number;
}

export interface RuleBasedAssignmentResult {
    success: boolean;
    appliedRule?: AssignmentRule;
    assignedAgent?: string;
    reason: string;
    confidence: number;
    matchedRules: RuleMatchResult[];
}

class AssignmentRulesService {
    private rules: AssignmentRule[] = [];
    private lastRulesUpdate: Date = new Date(0);
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Load assignment rules from storage (with caching)
     */
    async loadRules(): Promise<AssignmentRule[]> {
        const now = new Date();
        if (now.getTime() - this.lastRulesUpdate.getTime() < this.CACHE_DURATION && this.rules.length > 0) {
            return this.rules;
        }

        try {
            // In a real implementation, load from database
            // For now, return mock rules that would be stored in the database
            const mockRules: AssignmentRule[] = [
                {
                    id: '1',
                    name: 'Urgent Tickets to Senior Agents',
                    description: 'Assign urgent priority tickets to experienced agents',
                    priority: 1,
                    enabled: true,
                    conditions: {
                        priorities: ['urgent'],
                    },
                    actions: {
                        requireSkills: ['senior'],
                        maxResponseTime: 15,
                        notifyManager: true
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: '2',
                    name: 'Technical Issues to IT Team',
                    description: 'Route technical category tickets to IT specialists',
                    priority: 2,
                    enabled: true,
                    conditions: {
                        categories: ['technical', 'software'],
                        keywords: ['server', 'network', 'database', 'api', 'bug', 'error']
                    },
                    actions: {
                        assignToTeam: 'it-team',
                        requireSkills: ['technical'],
                        maxResponseTime: 30
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: '3',
                    name: 'High Priority Business Hours',
                    description: 'Assign high priority tickets during business hours to available agents',
                    priority: 3,
                    enabled: true,
                    conditions: {
                        priorities: ['high'],
                        timeOfDay: {
                            start: '09:00',
                            end: '17:00'
                        }
                    },
                    actions: {
                        maxResponseTime: 20,
                        notifyManager: false
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: '4',
                    name: 'After Hours to On-Call',
                    description: 'Assign tickets outside business hours to on-call agents',
                    priority: 4,
                    enabled: false, // Disabled by default
                    conditions: {
                        timeOfDay: {
                            start: '18:00',
                            end: '08:00'
                        }
                    },
                    actions: {
                        assignToTeam: 'on-call',
                        escalateAfter: 60,
                        notifyManager: true
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ];

            this.rules = mockRules;
            this.lastRulesUpdate = now;
            return this.rules;
        } catch (error) {
            console.error('Error loading assignment rules:', error);
            return [];
        }
    }

    /**
     * Evaluate a ticket against all assignment rules
     */
    async evaluateTicket(ticket: TicketData): Promise<RuleBasedAssignmentResult> {
        try {
            const rules = await this.loadRules();
            const enabledRules = rules.filter(rule => rule.enabled);

            if (enabledRules.length === 0) {
                return {
                    success: false,
                    reason: 'No active assignment rules configured',
                    confidence: 0,
                    matchedRules: []
                };
            }

            // Evaluate each rule against the ticket
            const ruleMatches: RuleMatchResult[] = [];

            for (const rule of enabledRules) {
                const matchResult = await this.evaluateRule(rule, ticket);
                ruleMatches.push(matchResult);
            }

            // Sort by priority and find the first matching rule
            const matchingRules = ruleMatches
                .filter(match => match.matches)
                .sort((a, b) => a.rule.priority - b.rule.priority);

            if (matchingRules.length === 0) {
                return {
                    success: false,
                    reason: 'No assignment rules matched this ticket',
                    confidence: 0,
                    matchedRules: ruleMatches
                };
            }

            const bestMatch = matchingRules[0];
            const assignmentResult = await this.applyRule(bestMatch.rule, ticket);

            return {
                success: assignmentResult.success,
                appliedRule: bestMatch.rule,
                assignedAgent: assignmentResult.assignedAgent,
                reason: assignmentResult.reason,
                confidence: bestMatch.confidence,
                matchedRules: ruleMatches
            };
        } catch (error) {
            console.error('Error evaluating ticket against rules:', error);
            return {
                success: false,
                reason: 'Error occurred during rule evaluation',
                confidence: 0,
                matchedRules: []
            };
        }
    }

    /**
     * Evaluate a single rule against a ticket
     */
    private async evaluateRule(rule: AssignmentRule, ticket: TicketData): Promise<RuleMatchResult> {
        const matchedConditions: string[] = [];
        let totalConditions = 0;
        let matchedCount = 0;

        // Check priority conditions
        if (rule.conditions.priorities && rule.conditions.priorities.length > 0) {
            totalConditions++;
            if (rule.conditions.priorities.includes(ticket.priority)) {
                matchedConditions.push(`Priority: ${ticket.priority}`);
                matchedCount++;
            }
        }

        // Check category conditions
        if (rule.conditions.categories && rule.conditions.categories.length > 0 && ticket.category_id) {
            totalConditions++;
            // In a real implementation, you'd fetch the category name from the database
            // For now, we'll assume category_id matches category names for simplicity
            if (rule.conditions.categories.some(cat => ticket.category_id?.includes(cat))) {
                matchedConditions.push(`Category: ${ticket.category_id}`);
                matchedCount++;
            }
        }

        // Check keyword conditions
        if (rule.conditions.keywords && rule.conditions.keywords.length > 0) {
            totalConditions++;
            const ticketText = `${ticket.title} ${ticket.description || ''}`.toLowerCase();
            const matchedKeywords = rule.conditions.keywords.filter(keyword =>
                ticketText.includes(keyword.toLowerCase())
            );

            if (matchedKeywords.length > 0) {
                matchedConditions.push(`Keywords: ${matchedKeywords.join(', ')}`);
                matchedCount++;
            }
        }

        // Check time of day conditions
        if (rule.conditions.timeOfDay) {
            totalConditions++;
            const now = new Date();
            const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format
            const startTime = this.parseTime(rule.conditions.timeOfDay.start);
            const endTime = this.parseTime(rule.conditions.timeOfDay.end);

            let isInTimeRange = false;
            if (startTime <= endTime) {
                // Normal time range (e.g., 09:00 - 17:00)
                isInTimeRange = currentTime >= startTime && currentTime <= endTime;
            } else {
                // Overnight time range (e.g., 18:00 - 08:00)
                isInTimeRange = currentTime >= startTime || currentTime <= endTime;
            }

            if (isInTimeRange) {
                matchedConditions.push(`Time: ${rule.conditions.timeOfDay.start} - ${rule.conditions.timeOfDay.end}`);
                matchedCount++;
            }
        }

        // If no conditions are specified, the rule matches everything
        if (totalConditions === 0) {
            totalConditions = 1;
            matchedCount = 1;
            matchedConditions.push('No conditions (matches all)');
        }

        const matches = matchedCount === totalConditions;
        const confidence = totalConditions > 0 ? (matchedCount / totalConditions) * 100 : 0;

        return {
            rule,
            matches,
            matchedConditions,
            confidence
        };
    }

    /**
     * Apply a rule's actions to assign a ticket
     */
    private async applyRule(rule: AssignmentRule, ticket: TicketData): Promise<{
        success: boolean;
        assignedAgent?: string;
        reason: string;
    }> {
        try {
            // If rule specifies a specific agent
            if (rule.actions.assignToAgent) {
                // Verify agent exists and is available
                const { data: agent, error } = await supabase
                    .from('users')
                    .select('id, full_name, role')
                    .eq('id', rule.actions.assignToAgent)
                    .in('role', ['agent', 'admin'])
                    .single();

                if (error || !agent) {
                    return {
                        success: false,
                        reason: `Specified agent not found or not available`
                    };
                }

                return {
                    success: true,
                    assignedAgent: rule.actions.assignToAgent,
                    reason: `Assigned by rule "${rule.name}" to ${agent.full_name}`
                };
            }

            // If rule specifies a team
            if (rule.actions.assignToTeam) {
                // Find agents in the specified team
                // In a real implementation, you'd have a teams table or team assignments
                const teamAgents = await this.getTeamAgents(rule.actions.assignToTeam);

                if (teamAgents.length === 0) {
                    return {
                        success: false,
                        reason: `No available agents found in team "${rule.actions.assignToTeam}"`
                    };
                }

                // Select the agent with the lowest workload in the team
                const bestAgent = await this.selectBestTeamAgent(teamAgents);

                return {
                    success: true,
                    assignedAgent: bestAgent.id,
                    reason: `Assigned by rule "${rule.name}" to team "${rule.actions.assignToTeam}" (${bestAgent.name})`
                };
            }

            // If rule requires specific skills
            if (rule.actions.requireSkills && rule.actions.requireSkills.length > 0) {
                const skilledAgents = await this.getAgentsWithSkills(rule.actions.requireSkills);

                if (skilledAgents.length === 0) {
                    return {
                        success: false,
                        reason: `No agents found with required skills: ${rule.actions.requireSkills.join(', ')}`
                    };
                }

                const bestAgent = await this.selectBestSkilledAgent(skilledAgents);

                return {
                    success: true,
                    assignedAgent: bestAgent.id,
                    reason: `Assigned by rule "${rule.name}" to agent with required skills (${bestAgent.name})`
                };
            }

            // If no specific assignment action, fall back to intelligent assignment
            return {
                success: false,
                reason: `Rule "${rule.name}" matched but no assignment action specified`
            };
        } catch (error) {
            console.error('Error applying rule:', error);
            return {
                success: false,
                reason: `Error applying rule "${rule.name}"`
            };
        }
    }

    /**
     * Get agents in a specific team
     */
    private async getTeamAgents(teamName: string): Promise<Array<{ id: string; name: string }>> {
        // Mock implementation - in reality, you'd query a teams table
        const mockTeams: Record<string, string[]> = {
            'it-team': ['agent1', 'agent2'],
            'on-call': ['agent3', 'admin1'],
            'support': ['agent1', 'agent2', 'agent3']
        };

        const agentIds = mockTeams[teamName] || [];

        if (agentIds.length === 0) {
            return [];
        }

        try {
            const { data: agents, error } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', agentIds)
                .in('role', ['agent', 'admin']);

            if (error) throw error;

            return (agents || []).map(agent => ({
                id: agent.id,
                name: agent.full_name || 'Unknown'
            }));
        } catch (error) {
            console.error('Error fetching team agents:', error);
            return [];
        }
    }

    /**
     * Get agents with specific skills
     */
    private async getAgentsWithSkills(skills: string[]): Promise<Array<{ id: string; name: string }>> {
        // Mock implementation - in reality, you'd query an agent_skills table
        const mockSkills: Record<string, string[]> = {
            'senior': ['agent1', 'admin1'],
            'technical': ['agent2', 'agent3'],
            'billing': ['agent1'],
            'support': ['agent1', 'agent2', 'agent3']
        };

        // Find agents that have all required skills
        const agentIds = skills.reduce((acc, skill) => {
            const skilledAgents = mockSkills[skill] || [];
            return acc.length === 0 ? skilledAgents : acc.filter(id => skilledAgents.includes(id));
        }, [] as string[]);

        if (agentIds.length === 0) {
            return [];
        }

        try {
            const { data: agents, error } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', agentIds)
                .in('role', ['agent', 'admin']);

            if (error) throw error;

            return (agents || []).map(agent => ({
                id: agent.id,
                name: agent.full_name || 'Unknown'
            }));
        } catch (error) {
            console.error('Error fetching skilled agents:', error);
            return [];
        }
    }

    /**
     * Select the best agent from a team based on workload
     */
    private async selectBestTeamAgent(agents: Array<{ id: string; name: string }>): Promise<{ id: string; name: string }> {
        // For now, return the first agent. In a real implementation, you'd check workload
        return agents[0];
    }

    /**
     * Select the best agent with required skills based on workload
     */
    private async selectBestSkilledAgent(agents: Array<{ id: string; name: string }>): Promise<{ id: string; name: string }> {
        // For now, return the first agent. In a real implementation, you'd check workload
        return agents[0];
    }

    /**
     * Parse time string (HH:MM) to minutes since midnight
     */
    private parseTime(timeStr: string): number {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 100 + minutes;
    }

    /**
     * Save assignment rules to storage
     */
    async saveRules(rules: AssignmentRule[]): Promise<void> {
        try {
            // In a real implementation, save to database
            this.rules = rules;
            this.lastRulesUpdate = new Date();
            console.log('Assignment rules saved:', rules.length);
        } catch (error) {
            console.error('Error saving assignment rules:', error);
            throw error;
        }
    }

    /**
     * Get rule execution statistics
     */
    async getRuleStatistics(): Promise<{
        totalRules: number;
        activeRules: number;
        rulesExecutedToday: number;
        successRate: number;
    }> {
        const rules = await this.loadRules();

        return {
            totalRules: rules.length,
            activeRules: rules.filter(r => r.enabled).length,
            rulesExecutedToday: 42, // Mock data
            successRate: 85 // Mock data
        };
    }
}

export const assignmentRulesService = new AssignmentRulesService();