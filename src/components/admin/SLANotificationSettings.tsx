import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Bell, 
  Settings, 
  Clock, 
  AlertTriangle, 
  Users, 
  Save,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

interface SLANotificationSettings {
  id?: string;
  user_id: string;
  breach_notifications_enabled: boolean;
  warning_notifications_enabled: boolean;
  summary_frequency: 'immediate' | 'hourly' | 'daily' | 'disabled';
  notification_threshold: number; // Minimum number of breaches to trigger summary
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  priority_filter: 'all' | 'high_urgent' | 'urgent_only';
}

interface SLAStats {
  total_breaches: number;
  total_warnings: number;
  unassigned_breaches: number;
  high_priority_breaches: number;
  urgent_priority_breaches: number;
  avg_breach_duration: string;
}

export const SLANotificationSettings: React.FC = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SLANotificationSettings>({
    user_id: userProfile?.id || '',
    breach_notifications_enabled: true,
    warning_notifications_enabled: true,
    summary_frequency: 'hourly',
    notification_threshold: 3,
    priority_filter: 'all'
  });
  const [stats, setStats] = useState<SLAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userProfile?.id) {
      loadSettings();
      loadStats();
    }
  }, [userProfile?.id]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('sla_notification_settings')
        .select('*')
        .eq('user_id', userProfile?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error loading SLA notification settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading SLA notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Get current SLA breach statistics
      const { data: tickets, error } = await supabase
        .from('tickets_new')
        .select(`
          id,
          priority,
          status,
          created_at,
          assigned_to,
          sla_due_date
        `)
        .in('status', ['open', 'in_progress']);

      if (error) throw error;

      // Calculate stats (simplified version - in production you'd want this server-side)
      const now = new Date();
      let totalBreaches = 0;
      let unassignedBreaches = 0;
      let highPriorityBreaches = 0;
      let urgentPriorityBreaches = 0;

      tickets?.forEach(ticket => {
        if (ticket.sla_due_date && new Date(ticket.sla_due_date) < now) {
          totalBreaches++;
          if (!ticket.assigned_to) unassignedBreaches++;
          if (ticket.priority === 'high') highPriorityBreaches++;
          if (ticket.priority === 'urgent') urgentPriorityBreaches++;
        }
      });

      setStats({
        total_breaches: totalBreaches,
        total_warnings: 0, // Would need more complex calculation
        unassigned_breaches: unassignedBreaches,
        high_priority_breaches: highPriorityBreaches,
        urgent_priority_breaches: urgentPriorityBreaches,
        avg_breach_duration: '2.5 hours' // Placeholder
      });
    } catch (error) {
      console.error('Error loading SLA stats:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sla_notification_settings')
        .upsert(settings, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: 'Settings Saved',
        description: 'Your SLA notification preferences have been updated.',
      });
    } catch (error) {
      console.error('Error saving SLA notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
            <p className="text-gray-600">Only administrators can configure SLA notification settings.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current SLA Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Current SLA Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.total_breaches}</div>
                <div className="text-sm text-gray-600">Active Breaches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.unassigned_breaches}</div>
                <div className="text-sm text-gray-600">Unassigned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.urgent_priority_breaches}</div>
                <div className="text-sm text-gray-600">Urgent Priority</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            SLA Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Notification Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="breach-notifications">SLA Breach Notifications</Label>
                <p className="text-sm text-gray-600">
                  Receive notifications when tickets exceed SLA deadlines
                </p>
              </div>
              <Switch
                id="breach-notifications"
                checked={settings.breach_notifications_enabled}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, breach_notifications_enabled: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="warning-notifications">SLA Warning Notifications</Label>
                <p className="text-sm text-gray-600">
                  Receive notifications when tickets approach SLA deadlines
                </p>
              </div>
              <Switch
                id="warning-notifications"
                checked={settings.warning_notifications_enabled}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, warning_notifications_enabled: checked }))
                }
              />
            </div>
          </div>

          {/* Summary Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Summary Frequency</Label>
              <Select
                value={settings.summary_frequency}
                onValueChange={(value: any) =>
                  setSettings(prev => ({ ...prev, summary_frequency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate (Individual notifications)</SelectItem>
                  <SelectItem value="hourly">Hourly Summary</SelectItem>
                  <SelectItem value="daily">Daily Summary</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                How often to receive SLA breach summaries instead of individual notifications
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notification Threshold</Label>
              <Select
                value={settings.notification_threshold.toString()}
                onValueChange={(value) =>
                  setSettings(prev => ({ ...prev, notification_threshold: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 breach</SelectItem>
                  <SelectItem value="3">3 breaches</SelectItem>
                  <SelectItem value="5">5 breaches</SelectItem>
                  <SelectItem value="10">10 breaches</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                Minimum number of breaches to trigger a summary notification
              </p>
            </div>

            <div className="space-y-2">
              <Label>Priority Filter</Label>
              <Select
                value={settings.priority_filter}
                onValueChange={(value: any) =>
                  setSettings(prev => ({ ...prev, priority_filter: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high_urgent">High & Urgent Only</SelectItem>
                  <SelectItem value="urgent_only">Urgent Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                Which ticket priorities to include in notifications
              </p>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-4">
            <Label>Quiet Hours (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quiet-start" className="text-sm">Start Time</Label>
                <input
                  id="quiet-start"
                  type="time"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  value={settings.quiet_hours_start || ''}
                  onChange={(e) =>
                    setSettings(prev => ({ ...prev, quiet_hours_start: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="quiet-end" className="text-sm">End Time</Label>
                <input
                  id="quiet-end"
                  type="time"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  value={settings.quiet_hours_end || ''}
                  onChange={(e) =>
                    setSettings(prev => ({ ...prev, quiet_hours_end: e.target.value }))
                  }
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              No notifications will be sent during these hours (except for urgent breaches)
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <p>SLA checks run every 2 hours to identify breaches and warnings</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <p>Duplicate notifications are prevented - you won't get spammed for the same breach</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <p>Agents get immediate notifications, admins get summaries to reduce noise</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <p>Summary notifications group multiple breaches into a single, actionable message</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};