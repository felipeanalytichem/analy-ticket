import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  Users,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  Save,
  X,
  Brain,
  Zap,
  BarChart3,
  Filter,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { SafeTranslation } from '@/components/ui/SafeTranslation';
import { useTranslation } from 'react-i18next';

type TicketPriority = Database['public']['Enums']['ticket_priority'];
type UserRole = Database['public']['Enums']['user_role'];

export interface AssignmentRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditions: {
    categories?: string[];
    priorities?: TicketPriority[];
    customerTiers?: string[];
    timeOfDay?: {
      start: string;
      end: string;
    };
    keywords?: string[];
  };
  actions: {
    assignToAgent?: string;
    assignToTeam?: string;
    requireSkills?: string[];
    maxResponseTime?: number;
    escalateAfter?: number;
    notifyManager?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface AssignmentConfig {
  workloadWeight: number;
  performanceWeight: number;
  availabilityWeight: number;
  maxConcurrentTickets: number;
  businessHours: {
    start: string;
    end: string;
    timezone: string;
  };
  autoRebalance: boolean;
  rebalanceThreshold: number;
}

export const AssignmentRulesManager = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [config, setConfig] = useState<AssignmentConfig>({
    workloadWeight: 40,
    performanceWeight: 30,
    availabilityWeight: 30,
    maxConcurrentTickets: 10,
    businessHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC'
    },
    autoRebalance: false,
    rebalanceThreshold: 80
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<AssignmentRule | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; role: UserRole }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      loadRules();
      loadConfig();
      loadAgents();
      loadCategories();
      
      // Set up real-time subscription to rule changes
      const rulesSubscription = supabase
        .channel('assignment_rules_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'assignment_rules' }, 
          () => {
            loadRules();
          }
        )
        .subscribe();
        
      // Set up real-time subscription to config changes
      const configSubscription = supabase
        .channel('assignment_config_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'assignment_config' }, 
          () => {
            loadConfig();
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(rulesSubscription);
        supabase.removeChannel(configSubscription);
      };
    }
  }, [userProfile]);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('assignment_rules')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Transform database data to match our AssignmentRule interface
        const transformedRules: AssignmentRule[] = data.map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          priority: rule.priority,
          enabled: rule.enabled,
          conditions: rule.conditions as AssignmentRule['conditions'],
          actions: rule.actions as AssignmentRule['actions'],
          created_at: rule.created_at,
          updated_at: rule.updated_at
        }));
        
        setRules(transformedRules);
      } else {
        setRules([]);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        title: t('common.error'),
        description: t('admin.assignmentRules.errorLoadingRules', 'Failed to load assignment rules'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_config')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setConfig({
          workloadWeight: data.workload_weight,
          performanceWeight: data.performance_weight,
          availabilityWeight: data.availability_weight,
          maxConcurrentTickets: data.max_concurrent_tickets,
          businessHours: data.business_hours as AssignmentConfig['businessHours'],
          autoRebalance: data.auto_rebalance,
          rebalanceThreshold: data.rebalance_threshold
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast({
        title: t('common.error'),
        description: t('admin.assignmentRules.errorLoadingConfig', 'Failed to load configuration settings'),
        variant: "destructive",
      });
    }
  };

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('role', ['agent', 'admin'])
        .order('full_name');

      if (error) throw error;

      const mappedAgents = (data || []).map(user => ({
        id: user.id,
        name: user.full_name || user.email || 'Unknown',
        role: user.role as UserRole
      }));

      setAgents(mappedAgents);
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: t('common.error'),
        description: t('admin.assignmentRules.errorLoadingAgents', 'Failed to load available agents'),
        variant: "destructive",
      });
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: t('common.error'),
        description: t('admin.assignmentRules.errorLoadingCategories', 'Failed to load categories'),
        variant: "destructive",
      });
    }
  };

  const handleSaveRule = async (rule: Partial<AssignmentRule>) => {
    try {
      if (selectedRule) {
        // Update existing rule
        const { error } = await supabase
          .from('assignment_rules')
          .update({
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            enabled: rule.enabled,
            conditions: rule.conditions,
            actions: rule.actions,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRule.id);

        if (error) throw error;

        toast({
          title: t('admin.assignmentRules.ruleUpdated'),
          description: t('admin.assignmentRules.ruleUpdatedDesc'),
        });
      } else {
        // Create new rule
        const newRuleData = {
          name: rule.name || '',
          description: rule.description,
          priority: rule.priority || rules.length + 1,
          enabled: rule.enabled ?? true,
          conditions: rule.conditions || {},
          actions: rule.actions || {}
        };

        const { error } = await supabase
          .from('assignment_rules')
          .insert(newRuleData);

        if (error) throw error;

        toast({
          title: t('admin.assignmentRules.ruleCreated'),
          description: t('admin.assignmentRules.ruleCreatedDesc'),
        });
      }
      
      // Reload rules to get the latest data
      await loadRules();
      setIsRuleDialogOpen(false);
      setSelectedRule(null);
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: t('admin.assignmentRules.errorSavingRule'),
        description: t('admin.assignmentRules.errorSavingRuleDesc'),
        variant: "destructive",
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('assignment_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      // Update local state
      setRules(prev => prev.filter(r => r.id !== ruleId));
      
      toast({
        title: t('admin.assignmentRules.ruleDeleted'),
        description: t('admin.assignmentRules.ruleDeletedDesc'),
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: t('admin.assignmentRules.errorDeletingRule'),
        description: t('admin.assignmentRules.errorDeletingRuleDesc'),
        variant: "destructive",
      });
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('assignment_rules')
        .update({ 
          enabled, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', ruleId);

      if (error) throw error;

      // Update local state
      setRules(prev => prev.map(r => 
        r.id === ruleId 
          ? { ...r, enabled, updated_at: new Date().toISOString() }
          : r
      ));
      
      toast({
        title: enabled ? t('admin.assignmentRules.ruleEnabled') : t('admin.assignmentRules.ruleDisabled'),
        description: t('admin.assignmentRules.ruleToggleDesc', 'Assignment rule has been {{status}}', { status: enabled ? t('admin.assignmentRules.enabled') : t('admin.assignmentRules.disabled') }),
      });
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: t('admin.assignmentRules.errorUpdatingRule'),
        description: t('admin.assignmentRules.errorUpdatingRuleDesc'),
        variant: "destructive",
      });
    }
  };

  const handleSaveConfig = async (newConfig: AssignmentConfig) => {
    try {
      const { error } = await supabase
        .from('assignment_config')
        .update({
          workload_weight: newConfig.workloadWeight,
          performance_weight: newConfig.performanceWeight,
          availability_weight: newConfig.availabilityWeight,
          max_concurrent_tickets: newConfig.maxConcurrentTickets,
          business_hours: newConfig.businessHours,
          auto_rebalance: newConfig.autoRebalance,
          rebalance_threshold: newConfig.rebalanceThreshold,
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('assignment_config').select('id').single()).data?.id);

      if (error) throw error;

      // Update local state
      setConfig(newConfig);
      
      toast({
        title: t('admin.assignmentRules.configurationSaved'),
        description: t('admin.assignmentRules.configurationSavedDesc'),
      });
      setIsConfigDialogOpen(false);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: t('admin.assignmentRules.errorSavingConfiguration'),
        description: t('admin.assignmentRules.errorSavingConfigurationDesc'),
        variant: "destructive",
      });
    }
  };

  const movePriority = async (ruleId: string, direction: 'up' | 'down') => {
    const ruleIndex = rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return;

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? ruleIndex - 1 : ruleIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < newRules.length) {
      try {
        // Swap priorities
        const currentRule = newRules[ruleIndex];
        const targetRule = newRules[targetIndex];
        const tempPriority = currentRule.priority;
        
        // Update in database - first rule
        await supabase
          .from('assignment_rules')
          .update({ 
            priority: targetRule.priority,
            updated_at: new Date().toISOString() 
          })
          .eq('id', currentRule.id);
        
        // Update in database - second rule
        await supabase
          .from('assignment_rules')
          .update({ 
            priority: tempPriority,
            updated_at: new Date().toISOString() 
          })
          .eq('id', targetRule.id);
        
        // Update local state
        currentRule.priority = targetRule.priority;
        targetRule.priority = tempPriority;
        
        // Sort by priority
        newRules.sort((a, b) => a.priority - b.priority);
        setRules(newRules);
      } catch (error) {
        console.error('Error updating rule priorities:', error);
        toast({
          title: t('common.error'),
          description: t('admin.assignmentRules.errorUpdatingPriorities'),
          variant: "destructive",
        });
      }
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('admin.assignmentRules.accessDeniedFeature', 'Access denied. This feature is only available to administrators.')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            <SafeTranslation i18nKey="admin.assignmentRules.title" fallback="Assignment Rules Manager" />
          </h1>
          <p className="text-muted-foreground">
            <SafeTranslation i18nKey="admin.assignmentRules.description" fallback="Configure intelligent ticket assignment rules and system settings" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsConfigDialogOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            <SafeTranslation i18nKey="admin.assignmentRules.configuration" fallback="Configuration" />
          </Button>
          <Button
            onClick={() => {
              setSelectedRule(null);
              setIsRuleDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            <SafeTranslation i18nKey="admin.assignmentRules.addRule" fallback="Add Rule" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">
            <SafeTranslation i18nKey="admin.assignmentRules.assignmentRules" fallback="Assignment Rules" />
          </TabsTrigger>
          <TabsTrigger value="config">
            <SafeTranslation i18nKey="admin.assignmentRules.systemConfiguration" fallback="System Configuration" />
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <SafeTranslation i18nKey="admin.assignmentRules.analytics" fallback="Analytics" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {/* Rules List */}
          <div className="grid gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : rules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No assignment rules</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first assignment rule to automate ticket distribution
                  </p>
                  <Button onClick={() => setIsRuleDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              rules
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => (
                  <Card key={rule.id} className={`${!rule.enabled ? 'opacity-60' : ''}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => movePriority(rule.id, 'up')}
                              disabled={rule.priority === 1}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => movePriority(rule.id, 'down')}
                              disabled={rule.priority === rules.length}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{rule.name}</CardTitle>
                              <Badge variant="outline">Priority {rule.priority}</Badge>
                              {rule.enabled ? (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <X className="h-3 w-3 mr-1" />
                                  Disabled
                                </Badge>
                              )}
                            </div>
                            {rule.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {rule.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRule(rule);
                              setIsRuleDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Conditions</h4>
                          <div className="space-y-1 text-sm">
                            {rule.conditions.priorities && (
                              <div>Priority: {rule.conditions.priorities.join(', ')}</div>
                            )}
                            {rule.conditions.categories && (
                              <div>Categories: {rule.conditions.categories.join(', ')}</div>
                            )}
                            {rule.conditions.keywords && (
                              <div>Keywords: {rule.conditions.keywords.join(', ')}</div>
                            )}
                            {rule.conditions.timeOfDay && (
                              <div>
                                Time: {rule.conditions.timeOfDay.start} - {rule.conditions.timeOfDay.end}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Actions</h4>
                          <div className="space-y-1 text-sm">
                            {rule.actions.assignToAgent && (
                              <div>Assign to: {rule.actions.assignToAgent}</div>
                            )}
                            {rule.actions.assignToTeam && (
                              <div>Team: {rule.actions.assignToTeam}</div>
                            )}
                            {rule.actions.requireSkills && (
                              <div>Skills: {rule.actions.requireSkills.join(', ')}</div>
                            )}
                            {rule.actions.maxResponseTime && (
                              <div>Max response: {rule.actions.maxResponseTime} min</div>
                            )}
                            {rule.actions.notifyManager && (
                              <div>Notify manager: Yes</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Algorithm Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label>Workload Weight: {config.workloadWeight}%</Label>
                  <Slider
                    value={[config.workloadWeight]}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, workloadWeight: value }))}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Performance Weight: {config.performanceWeight}%</Label>
                  <Slider
                    value={[config.performanceWeight]}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, performanceWeight: value }))}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Availability Weight: {config.availabilityWeight}%</Label>
                  <Slider
                    value={[config.availabilityWeight]}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, availabilityWeight: value }))}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="maxTickets">Max Concurrent Tickets per Agent</Label>
                  <Input
                    id="maxTickets"
                    type="number"
                    value={config.maxConcurrentTickets}
                    onChange={(e) => setConfig(prev => ({ ...prev, maxConcurrentTickets: parseInt(e.target.value) }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="rebalanceThreshold">Auto-Rebalance Threshold (%)</Label>
                  <Input
                    id="rebalanceThreshold"
                    type="number"
                    value={config.rebalanceThreshold}
                    onChange={(e) => setConfig(prev => ({ ...prev, rebalanceThreshold: parseInt(e.target.value) }))}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="autoRebalance"
                  checked={config.autoRebalance}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoRebalance: checked }))}
                />
                <Label htmlFor="autoRebalance">Enable automatic workload rebalancing</Label>
              </div>

              <Button onClick={() => handleSaveConfig(config)}>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rules.filter(r => r.enabled).length}</div>
                <p className="text-xs text-muted-foreground">
                  Out of {rules.length} total rules
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auto Assignments</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">85%</div>
                <p className="text-xs text-muted-foreground">
                  Of tickets assigned automatically
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Assignment Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.3s</div>
                <p className="text-xs text-muted-foreground">
                  Average time to assign
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <RuleDialog
        open={isRuleDialogOpen}
        onOpenChange={setIsRuleDialogOpen}
        rule={selectedRule}
        onSave={handleSaveRule}
        agents={agents}
        categories={categories}
      />

      {/* Configuration Dialog */}
      <ConfigurationDialog
        open={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
        config={config}
        onSave={handleSaveConfig}
      />
    </div>
  );
};

// Rule Dialog Component
interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AssignmentRule | null;
  onSave: (rule: Partial<AssignmentRule>) => void;
  agents: Array<{ id: string; name: string; role: UserRole }>;
  categories: Array<{ id: string; name: string }>;
}

const RuleDialog = ({ open, onOpenChange, rule, onSave, agents, categories }: RuleDialogProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<AssignmentRule>>({
    name: '',
    description: '',
    enabled: true,
    conditions: {},
    actions: {}
  });

  useEffect(() => {
    if (rule) {
      setFormData(rule);
    } else {
      setFormData({
        name: '',
        description: '',
        enabled: true,
        conditions: {},
        actions: {}
      });
    }
  }, [rule, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? t('admin.assignmentRules.editAssignmentRule', 'Edit Assignment Rule') : t('admin.assignmentRules.createAssignmentRule', 'Create Assignment Rule')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('admin.assignmentRules.enterRuleName', 'Enter rule name')}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(enabled) => setFormData(prev => ({ ...prev, enabled }))}
              />
              <Label htmlFor="enabled">Enable this rule</Label>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('admin.assignmentRules.describeRule', 'Describe what this rule does')}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Conditions</h3>
            
            <div>
              <Label>Ticket Priorities</Label>
              <div className="flex gap-2 mt-2">
                {(['low', 'medium', 'high', 'urgent'] as TicketPriority[]).map((priority) => (
                  <Button
                    key={priority}
                    type="button"
                    variant={formData.conditions?.priorities?.includes(priority) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const priorities = formData.conditions?.priorities || [];
                      const newPriorities = priorities.includes(priority)
                        ? priorities.filter(p => p !== priority)
                        : [...priorities, priority];
                      setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, priorities: newPriorities }
                      }));
                    }}
                  >
                    {priority}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                value={formData.conditions?.keywords?.join(', ') || ''}
                onChange={(e) => {
                  const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                  setFormData(prev => ({
                    ...prev,
                    conditions: { ...prev.conditions, keywords }
                  }));
                }}
                placeholder="server, network, urgent"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Actions</h3>
            
            <div>
              <Label htmlFor="assignToAgent">Assign to Specific Agent</Label>
              <Select
                value={formData.actions?.assignToAgent || 'none'}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  actions: { ...prev.actions, assignToAgent: value === 'none' ? undefined : value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.assignmentRules.selectAgentOptional', 'Select agent (optional)')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maxResponseTime">Max Response Time (minutes)</Label>
              <Input
                id="maxResponseTime"
                type="number"
                value={formData.actions?.maxResponseTime || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  actions: { ...prev.actions, maxResponseTime: parseInt(e.target.value) }
                }))}
                placeholder="30"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="notifyManager"
                checked={formData.actions?.notifyManager || false}
                onCheckedChange={(notifyManager) => setFormData(prev => ({
                  ...prev,
                  actions: { ...prev.actions, notifyManager }
                }))}
              />
              <Label htmlFor="notifyManager">Notify manager when rule is triggered</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {rule ? t('admin.assignmentRules.updateRule', 'Update Rule') : t('admin.assignmentRules.createRule', 'Create Rule')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Configuration Dialog Component
interface ConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AssignmentConfig;
  onSave: (config: AssignmentConfig) => void;
}

const ConfigurationDialog = ({ open, onOpenChange, config, onSave }: ConfigurationDialogProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<AssignmentConfig>(config);

  useEffect(() => {
    setFormData(config);
  }, [config, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assignment System Configuration</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Scoring Weights</h3>
            <p className="text-sm text-muted-foreground">
              Adjust how different factors influence agent selection. Total should equal 100%.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label>Workload Weight: {formData.workloadWeight}%</Label>
                <Slider
                  value={[formData.workloadWeight]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, workloadWeight: value }))}
                  max={100}
                  step={5}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How much current workload affects assignment
                </p>
              </div>
              <div>
                <Label>Performance Weight: {formData.performanceWeight}%</Label>
                <Slider
                  value={[formData.performanceWeight]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, performanceWeight: value }))}
                  max={100}
                  step={5}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How much past performance affects assignment
                </p>
              </div>
              <div>
                <Label>Availability Weight: {formData.availabilityWeight}%</Label>
                <Slider
                  value={[formData.availabilityWeight]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, availabilityWeight: value }))}
                  max={100}
                  step={5}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How much availability status affects assignment
                </p>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Total Weight: {formData.workloadWeight + formData.performanceWeight + formData.availabilityWeight}%
                {formData.workloadWeight + formData.performanceWeight + formData.availabilityWeight !== 100 && (
                  <span className="text-orange-600 ml-2">⚠️ Should equal 100%</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Capacity Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="maxTickets">Max Concurrent Tickets per Agent</Label>
                <Input
                  id="maxTickets"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.maxConcurrentTickets}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxConcurrentTickets: parseInt(e.target.value) || 10 }))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum tickets an agent can handle simultaneously
                </p>
              </div>
              <div>
                <Label htmlFor="rebalanceThreshold">Auto-Rebalance Threshold (%)</Label>
                <Input
                  id="rebalanceThreshold"
                  type="number"
                  min="50"
                  max="100"
                  value={formData.rebalanceThreshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, rebalanceThreshold: parseInt(e.target.value) || 80 }))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Trigger rebalancing when utilization exceeds this percentage
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Business Hours</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.businessHours.start}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    businessHours: { ...prev.businessHours, start: e.target.value }
                  }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.businessHours.end}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    businessHours: { ...prev.businessHours, end: e.target.value }
                  }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.businessHours.timezone}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    businessHours: { ...prev.businessHours, timezone: value }
                  }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">{t('admin.assignmentRules.utc', 'UTC')}</SelectItem>
                    <SelectItem value="America/New_York">{t('admin.assignmentRules.easternTime', 'Eastern Time')}</SelectItem>
                    <SelectItem value="America/Chicago">{t('admin.assignmentRules.centralTime', 'Central Time')}</SelectItem>
                    <SelectItem value="America/Denver">{t('admin.assignmentRules.mountainTime', 'Mountain Time')}</SelectItem>
                    <SelectItem value="America/Los_Angeles">{t('admin.assignmentRules.pacificTime', 'Pacific Time')}</SelectItem>
                    <SelectItem value="Europe/London">{t('admin.assignmentRules.london', 'London')}</SelectItem>
                    <SelectItem value="Europe/Paris">{t('admin.assignmentRules.paris', 'Paris')}</SelectItem>
                    <SelectItem value="Asia/Tokyo">{t('admin.assignmentRules.tokyo', 'Tokyo')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Automation Settings</h3>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="autoRebalance"
                checked={formData.autoRebalance}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoRebalance: checked }))}
              />
              <Label htmlFor="autoRebalance">Enable automatic workload rebalancing</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, the system will automatically redistribute tickets when agents become overloaded
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};