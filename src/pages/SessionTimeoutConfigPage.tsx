import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Clock, Shield, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { SessionTimeoutAdminDebug } from '@/components/auth/SessionTimeoutAdminDebug';

interface SessionTimeoutSettings {
  timeoutMinutes: number;
  warningMinutes: number;
  checkIntervalSeconds: number;
}

const DEFAULT_SETTINGS: SessionTimeoutSettings = {
  timeoutMinutes: 60,
  warningMinutes: 5,
  checkIntervalSeconds: 1,
};

export default function SessionTimeoutConfigPage() {
  const { user, userProfile } = useAuth();
  const [settings, setSettings] = useState<SessionTimeoutSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SessionTimeoutSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sessionTimeoutSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        setOriginalSettings(parsed);
      } catch (error) {
        console.error('Error loading session timeout settings:', error);
      }
    }
  }, []);

  // Check for changes
  useEffect(() => {
    const changed = 
      settings.timeoutMinutes !== originalSettings.timeoutMinutes ||
      settings.warningMinutes !== originalSettings.warningMinutes ||
      settings.checkIntervalSeconds !== originalSettings.checkIntervalSeconds;
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const handleSave = () => {
    // Validation
    if (settings.timeoutMinutes < 1 || settings.timeoutMinutes > 480) {
      toast.error('Timeout must be between 1 and 480 minutes (8 hours)');
      return;
    }
    
    if (settings.warningMinutes < 1 || settings.warningMinutes >= settings.timeoutMinutes) {
      toast.error('Warning time must be between 1 minute and less than timeout duration');
      return;
    }
    
    if (settings.checkIntervalSeconds < 1 || settings.checkIntervalSeconds > 60) {
      toast.error('Check interval must be between 1 and 60 seconds');
      return;
    }

    try {
      localStorage.setItem('sessionTimeoutSettings', JSON.stringify(settings));
      setOriginalSettings(settings);
      
      toast.success('Session Timeout Settings Saved', {
        description: 'Settings will apply to new user sessions. Current sessions may need to be restarted.',
      });
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('sessionTimeoutSettingsChanged', { 
        detail: settings 
      }));
      
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    toast.info('Changes reverted');
  };

  const handleResetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.info('Reset to default values');
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  // Check if user is admin (after all hooks)
  if (!user || !userProfile || userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Session Timeout Configuration
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-2">
              Configure automatic logout settings for user sessions
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <Shield className="h-4 w-4" />
            Admin Only
          </Badge>
        </div>

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            These settings control how long users can remain inactive before being automatically logged out.
            Changes apply to new sessions and may require users to log in again to take effect.
          </AlertDescription>
        </Alert>

        {/* Main Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeout Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timeout Duration */}
            <div className="space-y-2">
              <Label htmlFor="timeout">Session Timeout (minutes)</Label>
              <Input
                id="timeout"
                type="number"
                min="1"
                max="480"
                value={settings.timeoutMinutes}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  timeoutMinutes: parseInt(e.target.value) || 1
                }))}
                className="w-full"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                How long users can be inactive before automatic logout. 
                Current: <strong>{formatDuration(settings.timeoutMinutes)}</strong>
              </p>
            </div>

            {/* Warning Duration */}
            <div className="space-y-2">
              <Label htmlFor="warning">Warning Time (minutes before timeout)</Label>
              <Input
                id="warning"
                type="number"
                min="1"
                max={Math.max(1, settings.timeoutMinutes - 1)}
                value={settings.warningMinutes}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  warningMinutes: parseInt(e.target.value) || 1
                }))}
                className="w-full"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                When to show warning before logout. 
                Warning will appear <strong>{formatDuration(settings.warningMinutes)}</strong> before timeout.
              </p>
            </div>

            {/* Check Interval */}
            <div className="space-y-2">
              <Label htmlFor="interval">Check Interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="60"
                value={settings.checkIntervalSeconds}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  checkIntervalSeconds: parseInt(e.target.value) || 1
                }))}
                className="w-full"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                How often to check for timeout (affects real-time countdown accuracy). 
                Current: Every <strong>{settings.checkIntervalSeconds} second{settings.checkIntervalSeconds > 1 ? 's' : ''}</strong>
              </p>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Summary</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Users will be logged out after <strong>{formatDuration(settings.timeoutMinutes)}</strong> of inactivity</li>
                <li>• Warning will appear <strong>{formatDuration(settings.warningMinutes)}</strong> before logout</li>
                <li>• Countdown will update every <strong>{settings.checkIntervalSeconds} second{settings.checkIntervalSeconds > 1 ? 's' : ''}</strong></li>
                <li>• Activity includes mouse movement, clicks, keyboard input, and scrolling</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Settings
              </Button>
              
              <Button 
                onClick={handleReset}
                disabled={!hasChanges}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Revert Changes
              </Button>
              
              <Button 
                onClick={handleResetToDefaults}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Presets Card */}
        <Card>
          <CardHeader>
            <CardTitle>Common Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Conservative */}
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium">Conservative (30 min)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">High security, frequent checks</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSettings({
                    timeoutMinutes: 30,
                    warningMinutes: 5,
                    checkIntervalSeconds: 1
                  })}
                >
                  Apply
                </Button>
              </div>

              {/* Standard */}
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium">Standard (60 min)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Balanced security and usability</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSettings({
                    timeoutMinutes: 60,
                    warningMinutes: 5,
                    checkIntervalSeconds: 1
                  })}
                >
                  Apply
                </Button>
              </div>

              {/* Relaxed */}
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium">Relaxed (120 min)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Lower security, better UX</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSettings({
                    timeoutMinutes: 120,
                    warningMinutes: 10,
                    checkIntervalSeconds: 5
                  })}
                >
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testing Section */}
        <SessionTimeoutAdminDebug />
      </div>
    </div>
  );
} 