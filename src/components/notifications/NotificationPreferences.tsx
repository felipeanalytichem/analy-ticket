import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Save, RotateCcw, Bell, Mail, Volume2, Moon, Clock, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

import { preferencesManager } from '@/lib/notifications/PreferencesManager'
import { useAuth } from '@/contexts/AuthContext'
import {
  NotificationPreferences as NotificationPreferencesType,
  NotificationType,
  NotificationTypePreference,
  createDefaultNotificationPreferences
} from '@/types/notifications'

interface NotificationPreferencesProps {
  className?: string
  onPreferencesChange?: (preferences: NotificationPreferencesType) => void
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  className,
  onPreferencesChange
}) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferencesType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load user preferences on mount
  useEffect(() => {
    if (user?.id) {
      loadPreferences()
    }
  }, [user?.id])

  const loadPreferences = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const userPreferences = await preferencesManager.getUserPreferences(user.id)
      setPreferences(userPreferences)
      setHasChanges(false)
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast.error(t('notifications.preferences.errors.loading'))
      // Set defaults on error
      setPreferences(createDefaultNotificationPreferences(user.id))
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    if (!user?.id || !preferences) return

    try {
      setSaving(true)
      const updatedPreferences = await preferencesManager.updateUserPreferences(user.id, preferences)
      setPreferences(updatedPreferences)
      setHasChanges(false)
      toast.success(t('notifications.preferences.saved'))
      onPreferencesChange?.(updatedPreferences)
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error(t('notifications.preferences.errors.saving'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (!user?.id) return

    try {
      setSaving(true)
      const defaultPreferences = await preferencesManager.resetToDefaults(user.id)
      setPreferences(defaultPreferences)
      setHasChanges(false)
      toast.success(t('notifications.preferences.resetToDefaults'))
      onPreferencesChange?.(defaultPreferences)
    } catch (error) {
      console.error('Error resetting preferences:', error)
      toast.error(t('notifications.preferences.errors.resetting'))
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = <K extends keyof NotificationPreferencesType>(
    key: K,
    value: NotificationPreferencesType[K]
  ) => {
    if (!preferences) return

    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    setHasChanges(true)
  }

  const updateQuietHours = (field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    if (!preferences) return

    const updated = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    }
    setPreferences(updated)
    setHasChanges(true)
  }

  const updateTypePreference = (
    type: NotificationType,
    field: keyof NotificationTypePreference,
    value: boolean | string
  ) => {
    if (!preferences) return

    const updated = {
      ...preferences,
      typePreferences: {
        ...preferences.typePreferences,
        [type]: {
          ...preferences.typePreferences[type],
          [field]: value
        }
      }
    }
    setPreferences(updated)
    setHasChanges(true)
  }

  // Notification type display names
  const getNotificationTypeLabel = (type: NotificationType): string => {
    const labels: Record<NotificationType, string> = {
      ticket_created: t('notifications.types.ticket_created.label', 'Ticket Created'),
      ticket_updated: t('notifications.types.ticket_updated.label', 'Ticket Updated'),
      ticket_assigned: t('notifications.types.ticket_assigned.label', 'Ticket Assigned'),
      comment_added: t('notifications.types.comment_added.label', 'Comment Added'),
      status_changed: t('notifications.types.status_changed.label', 'Status Changed'),
      priority_changed: t('notifications.types.priority_changed.label', 'Priority Changed'),
      assignment_changed: t('notifications.types.assignment_changed.label', 'Assignment Changed'),
      sla_warning: t('notifications.types.sla_warning.label', 'SLA Warning'),
      sla_breach: t('notifications.types.sla_breach.label', 'SLA Breach')
    }
    return labels[type] || type
  }

  const getNotificationTypeDescription = (type: NotificationType): string => {
    const descriptions: Record<NotificationType, string> = {
      ticket_created: t('notifications.types.ticket_created.description', 'When a new ticket is created'),
      ticket_updated: t('notifications.types.ticket_updated.description', 'When a ticket is updated'),
      ticket_assigned: t('notifications.types.ticket_assigned.description', 'When a ticket is assigned to you'),
      comment_added: t('notifications.types.comment_added.description', 'When a comment is added to your tickets'),
      status_changed: t('notifications.types.status_changed.description', 'When ticket status changes'),
      priority_changed: t('notifications.types.priority_changed.description', 'When ticket priority changes'),
      assignment_changed: t('notifications.types.assignment_changed.description', 'When ticket assignment changes'),
      sla_warning: t('notifications.types.sla_warning.description', 'When SLA deadline is approaching'),
      sla_breach: t('notifications.types.sla_breach.description', 'When SLA deadline is breached')
    }
    return descriptions[type] || ''
  }

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('notifications.preferences.title', 'Notification Preferences')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">
              {t('notifications.preferences.loading', 'Loading preferences...')}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!preferences) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('notifications.preferences.title', 'Notification Preferences')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {t('notifications.preferences.errors.loadingFailed', 'Failed to load preferences')}
            </p>
            <Button onClick={loadPreferences} variant="outline">
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t('notifications.preferences.title', 'Notification Preferences')}
        </CardTitle>
        <CardDescription>
          {t('notifications.preferences.description', 'Customize how and when you receive notifications')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* General Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('notifications.preferences.general.title', 'General Settings')}
          </h3>

          <div className="grid gap-4">
            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('notifications.preferences.general.email', 'Email Notifications')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.preferences.general.emailDescription', 'Receive notifications via email')}
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
                aria-label={t('notifications.preferences.general.email', 'Email Notifications')}
              />
            </div>

            {/* Toast Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="toast-notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {t('notifications.preferences.general.toast', 'Browser Notifications')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.preferences.general.toastDescription', 'Show notifications in browser')}
                </p>
              </div>
              <Switch
                id="toast-notifications"
                checked={preferences.toastNotifications}
                onCheckedChange={(checked) => updatePreference('toastNotifications', checked)}
                aria-label={t('notifications.preferences.general.toast', 'Browser Notifications')}
              />
            </div>

            {/* Sound Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sound-notifications" className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  {t('notifications.preferences.general.sound', 'Sound Notifications')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.preferences.general.soundDescription', 'Play sound for notifications')}
                </p>
              </div>
              <Switch
                id="sound-notifications"
                checked={preferences.soundNotifications}
                onCheckedChange={(checked) => updatePreference('soundNotifications', checked)}
                aria-label={t('notifications.preferences.general.sound', 'Sound Notifications')}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Moon className="h-4 w-4" />
            {t('notifications.preferences.quietHours.title', 'Quiet Hours')}
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="quiet-hours-enabled">
                  {t('notifications.preferences.quietHours.enabled', 'Enable Quiet Hours')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.preferences.quietHours.description', 'Suppress non-urgent notifications during specified hours')}
                </p>
              </div>
              <Switch
                id="quiet-hours-enabled"
                checked={preferences.quietHours.enabled}
                onCheckedChange={(checked) => updateQuietHours('enabled', checked)}
                aria-label={t('notifications.preferences.quietHours.enabled', 'Enable Quiet Hours')}
              />
            </div>

            {preferences.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start" className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {t('notifications.preferences.quietHours.start', 'Start Time')}
                  </Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => updateQuietHours('start', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-end" className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {t('notifications.preferences.quietHours.end', 'End Time')}
                  </Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => updateQuietHours('end', e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Language and Timezone */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {t('notifications.preferences.localization.title', 'Language & Timezone')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">
                {t('notifications.preferences.localization.language', 'Language')}
              </Label>
              <Select
                value={preferences.language}
                onValueChange={(value) => updatePreference('language', value)}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">
                {t('notifications.preferences.localization.timezone', 'Timezone')}
              </Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreference('timezone', value)}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="America/Sao_Paulo">São Paulo</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Notification Type Preferences */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {t('notifications.preferences.types.title', 'Notification Types')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('notifications.preferences.types.description', 'Configure preferences for each type of notification')}
          </p>

          <ScrollArea className="h-96 w-full rounded-md border p-4">
            <div className="space-y-4">
              {Object.entries(preferences.typePreferences).map(([type, typePreference]) => (
                <div key={type} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`notification-type-${type}`} className="font-medium">
                          {getNotificationTypeLabel(type as NotificationType)}
                        </Label>
                        <Badge variant={getPriorityBadgeVariant(typePreference.priority)}>
                          {typePreference.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getNotificationTypeDescription(type as NotificationType)}
                      </p>
                    </div>
                    <Switch
                      id={`notification-type-${type}`}
                      checked={typePreference.enabled}
                      onCheckedChange={(checked) => 
                        updateTypePreference(type as NotificationType, 'enabled', checked)
                      }
                      aria-label={getNotificationTypeLabel(type as NotificationType)}
                    />
                  </div>

                  {typePreference.enabled && (
                    <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-muted">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t('notifications.preferences.types.priority', 'Priority')}
                        </Label>
                        <Select
                          value={typePreference.priority}
                          onValueChange={(value) => 
                            updateTypePreference(type as NotificationType, 'priority', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">
                              {t('notifications.preferences.types.priorityLow', 'Low')}
                            </SelectItem>
                            <SelectItem value="medium">
                              {t('notifications.preferences.types.priorityMedium', 'Medium')}
                            </SelectItem>
                            <SelectItem value="high">
                              {t('notifications.preferences.types.priorityHigh', 'High')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t('notifications.preferences.types.delivery', 'Delivery')}
                        </Label>
                        <Select
                          value={typePreference.delivery}
                          onValueChange={(value) => 
                            updateTypePreference(type as NotificationType, 'delivery', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instant">
                              {t('notifications.preferences.types.deliveryInstant', 'Instant')}
                            </SelectItem>
                            <SelectItem value="batched">
                              {t('notifications.preferences.types.deliveryBatched', 'Batched')}
                            </SelectItem>
                            <SelectItem value="digest">
                              {t('notifications.preferences.types.deliveryDigest', 'Daily Digest')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t('notifications.preferences.resetToDefaults', 'Reset to Defaults')}
          </Button>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary">
                {t('notifications.preferences.unsavedChanges', 'Unsaved changes')}
              </Badge>
            )}
            <Button
              onClick={savePreferences}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving 
                ? t('notifications.preferences.saving', 'Saving...') 
                : t('notifications.preferences.save', 'Save Preferences')
              }
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}