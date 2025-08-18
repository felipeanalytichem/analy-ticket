/**
 * Feature Flag Manager Component
 * Admin interface for managing feature flags and A/B tests
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  BarChart3, 
  Flag, 
  TestTube,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { featureFlagService, type FeatureFlag, type ABTestConfig } from '@/services/FeatureFlagService';

interface FeatureFlagManagerProps {
  className?: string;
}

export function FeatureFlagManager({ className }: FeatureFlagManagerProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [abTests, setABTests] = useState<ABTestConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [metrics, setMetrics] = useState<any[]>([]);
  const { toast } = useToast();

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [flagsData, metricsData] = await Promise.all([
        featureFlagService.getAllFlags(),
        loadMetrics()
      ]);
      
      setFlags(flagsData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading feature flag data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load feature flag data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetrics = async () => {
    // This would typically load from the feature_flag_metrics table
    // For now, return mock data
    return [
      { flag_name: 'notifications_enhanced_realtime', total_evaluations: 1250, enabled_evaluations: 125, unique_users: 89 },
      { flag_name: 'notifications_intelligent_grouping', total_evaluations: 2100, enabled_evaluations: 525, unique_users: 234 },
      { flag_name: 'notifications_advanced_caching', total_evaluations: 3400, enabled_evaluations: 1700, unique_users: 456 }
    ];
  };

  const handleSaveFlag = async (flagData: Partial<FeatureFlag>) => {
    try {
      const savedFlag = await featureFlagService.upsertFlag(flagData);
      if (savedFlag) {
        await loadData();
        setIsEditDialogOpen(false);
        setSelectedFlag(null);
        toast({
          title: 'Success',
          description: `Feature flag ${flagData.name} saved successfully`
        });
      }
    } catch (error) {
      console.error('Error saving feature flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to save feature flag',
        variant: 'destructive'
      });
    }
  };

  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      await handleSaveFlag({
        ...flag,
        enabled: !flag.enabled
      });
    } catch (error) {
      console.error('Error toggling feature flag:', error);
    }
  };

  const getStatusBadge = (flag: FeatureFlag) => {
    if (!flag.enabled) {
      return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Disabled</Badge>;
    }
    
    if (flag.rollout_percentage === 100) {
      return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Full Rollout</Badge>;
    }
    
    if (flag.rollout_percentage > 0) {
      return <Badge variant="outline"><TrendingUp className="w-3 h-3 mr-1" />{flag.rollout_percentage}% Rollout</Badge>;
    }
    
    return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />No Rollout</Badge>;
  };

  const getRolloutColor = (percentage: number) => {
    if (percentage === 0) return 'bg-red-500';
    if (percentage < 25) return 'bg-orange-500';
    if (percentage < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading feature flags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Feature Flag Manager</h2>
          <p className="text-muted-foreground">Manage feature flags and A/B tests for gradual rollouts</p>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedFlag(null)}>
              <Plus className="w-4 h-4 mr-2" />
              New Flag
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedFlag ? 'Edit Feature Flag' : 'Create Feature Flag'}
              </DialogTitle>
              <DialogDescription>
                Configure feature flag settings for gradual rollout
              </DialogDescription>
            </DialogHeader>
            <FeatureFlagForm
              flag={selectedFlag}
              onSave={handleSaveFlag}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedFlag(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="flags" className="space-y-6">
        <TabsList>
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="tests" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            A/B Tests
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <div className="grid gap-4">
            {flags.map((flag) => (
              <Card key={flag.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{flag.name}</CardTitle>
                      {getStatusBadge(flag)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={() => handleToggleFlag(flag)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFlag(flag);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{flag.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rollout Percentage</span>
                      <span className="font-medium">{flag.rollout_percentage}%</span>
                    </div>
                    <Progress 
                      value={flag.rollout_percentage} 
                      className="h-2"
                    />
                    
                    {flag.user_groups.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Target Groups:</span>
                        <div className="flex gap-1">
                          {flag.user_groups.map((group) => (
                            <Badge key={group} variant="outline" className="text-xs">
                              {group}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Created: {new Date(flag.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(flag.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <Alert>
            <TestTube className="h-4 w-4" />
            <AlertDescription>
              A/B testing functionality is coming soon. This will allow you to test different variants of features with controlled user groups.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4">
            {metrics.map((metric) => (
              <Card key={metric.flag_name}>
                <CardHeader>
                  <CardTitle className="text-lg">{metric.flag_name}</CardTitle>
                  <CardDescription>Usage metrics and performance data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {metric.total_evaluations.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Evaluations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {metric.enabled_evaluations.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Enabled</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {metric.unique_users.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Unique Users</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Enablement Rate</span>
                      <span>{((metric.enabled_evaluations / metric.total_evaluations) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={(metric.enabled_evaluations / metric.total_evaluations) * 100}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface FeatureFlagFormProps {
  flag: FeatureFlag | null;
  onSave: (flag: Partial<FeatureFlag>) => void;
  onCancel: () => void;
}

function FeatureFlagForm({ flag, onSave, onCancel }: FeatureFlagFormProps) {
  const [formData, setFormData] = useState({
    name: flag?.name || '',
    description: flag?.description || '',
    enabled: flag?.enabled || false,
    rollout_percentage: flag?.rollout_percentage || 0,
    user_groups: flag?.user_groups?.join(', ') || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const flagData: Partial<FeatureFlag> = {
      ...flag,
      name: formData.name,
      description: formData.description,
      enabled: formData.enabled,
      rollout_percentage: formData.rollout_percentage,
      user_groups: formData.user_groups
        .split(',')
        .map(g => g.trim())
        .filter(g => g.length > 0)
    };

    onSave(flagData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Flag Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., notifications_enhanced_realtime"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this feature flag controls"
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
        />
        <Label htmlFor="enabled">Enabled</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rollout">Rollout Percentage: {formData.rollout_percentage}%</Label>
        <Slider
          id="rollout"
          min={0}
          max={100}
          step={5}
          value={[formData.rollout_percentage]}
          onValueChange={([value]) => setFormData({ ...formData, rollout_percentage: value })}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="groups">Target User Groups (comma-separated)</Label>
        <Input
          id="groups"
          value={formData.user_groups}
          onChange={(e) => setFormData({ ...formData, user_groups: e.target.value })}
          placeholder="e.g., admin, agent, beta_users"
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to target all users. Common groups: admin, agent, user
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {flag ? 'Update Flag' : 'Create Flag'}
        </Button>
      </div>
    </form>
  );
}

export default FeatureFlagManager;