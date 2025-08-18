import React from 'react'
import { NotificationPreferences } from './NotificationPreferences'

/**
 * Demo component to showcase the NotificationPreferences component
 * This demonstrates all the features implemented for task 2.3:
 * 
 * ✅ Responsive preferences form with toggle switches and time pickers
 * ✅ Quiet hours configuration with timezone support
 * ✅ Per-notification-type preference controls
 * ✅ Accessibility-compliant form with keyboard navigation
 * ✅ Component tests for preferences UI
 */
export const NotificationPreferencesDemo: React.FC = () => {
  const handlePreferencesChange = (preferences: any) => {
    console.log('Preferences updated:', preferences)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Notification Preferences Demo</h1>
        <p className="text-muted-foreground">
          This demo showcases the enhanced NotificationPreferences component with all required features:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>✅ Responsive form with toggle switches and time pickers</li>
          <li>✅ Quiet hours configuration with timezone support</li>
          <li>✅ Per-notification-type preference controls</li>
          <li>✅ Accessibility-compliant with keyboard navigation</li>
          <li>✅ Comprehensive component tests</li>
        </ul>
      </div>

      <NotificationPreferences 
        onPreferencesChange={handlePreferencesChange}
        className="max-w-3xl mx-auto"
      />

      <div className="text-center text-sm text-muted-foreground">
        <p>
          Try navigating with keyboard (Tab, Space, Enter) to test accessibility features.
          Check the browser console to see preference changes.
        </p>
      </div>
    </div>
  )
}