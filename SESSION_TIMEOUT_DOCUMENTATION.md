# 🔒 Session Timeout Force - Security Feature

## Overview

The session timeout feature automatically logs out users after a configurable period of inactivity, enhancing application security by preventing unauthorized access to abandoned sessions.

## ✅ Features Implemented

### 🚀 Core Functionality
- **Automatic Logout**: Users are automatically signed out after 1 hour of inactivity (configurable)
- **Activity Tracking**: Monitors mouse movement, clicks, keyboard input, scrolling, and touch events
- **Warning System**: Shows a warning dialog 5 minutes before timeout (configurable)
- **Session Extension**: Users can extend their session when warned
- **Real-time Monitoring**: Checks session status every second for live updates

### 🔧 Components Created

#### 1. `useSessionTimeout` Hook (`src/hooks/useSessionTimeout.ts`)
- Main hook that manages session timeout logic
- Tracks user activity and manages timers
- Integrates with AuthContext for logout functionality
- Configurable timeout and warning periods

#### 2. `SessionTimeoutWarning` Component (`src/components/auth/SessionTimeoutWarning.tsx`)
- Warning dialog that appears before timeout
- Live countdown timer with progress bar
- Options to extend session or logout immediately
- Responsive design for mobile and desktop

#### 3. `SessionTimeoutManager` Component (`src/components/auth/SessionTimeoutManager.tsx`)
- Wrapper component that manages the entire timeout system
- Integrates warning dialog with session timeout logic
- Debug panel for development environment
- Only activates for authenticated users

#### 4. `SessionTimeoutConfig` Component (`src/components/auth/SessionTimeoutConfig.tsx`)
- Configuration interface for testing and admin settings
- Real-time session status monitoring
- Activity reset and session extension controls
- Testing instructions and tips

#### 5. `SessionTimeoutAdminDebug` (`src/components/auth/SessionTimeoutAdminDebug.tsx`)
- Admin testing component with configurable timeout settings
- Real-time countdown, force timeout/warning buttons, current settings display
- Embedded in `/admin/session-timeout`
- Admin users only

## 🎯 Default Configuration

| Setting | Default Value | Description |
|---------|---------------|-------------|
| Session Timeout | 60 minutes | Time of inactivity before automatic logout |
| Warning Time | 5 minutes | Warning shown before timeout |
| Check Interval | 1 second | How often to check session status (real-time) |

## 📱 Monitored Activities

The system tracks the following user activities to reset the inactivity timer:

- **Mouse Events**: Movement, clicks, mouse down
- **Keyboard Events**: Key presses and input
- **Scroll Events**: Page scrolling
- **Touch Events**: Touch interactions (mobile devices)

## 🔍 Testing the Feature

### Admin Configuration Testing
1. Log in as admin user
2. Navigate to `Administration → Session Timeout` in sidebar
3. Configure desired timeout settings (e.g., 30 minutes timeout, 5 minutes warning)
4. Click "Save Settings"
5. Use the built-in debug panel to test:
   - Click "Start" to begin monitoring
   - Use "Force Warning" to test warning dialog
   - Use "Force Timeout" to test automatic logout
   - Verify logout works completely (stay logged out after refresh)

### Production Testing
1. Set realistic timeouts through admin panel (60 minutes recommended)
2. Test in normal usage scenarios
3. Verify warning appears at correct time
4. Test session extension functionality

## 🛠️ Integration

The session timeout system is integrated at the application level:

```typescript
// In App.tsx
<AuthProvider>
  <SessionTimeoutManager timeoutMinutes={60} warningMinutes={5}>
    {/* All app content */}
  </SessionTimeoutManager>
</AuthProvider>
```

## 🔧 Debug Mode

In development mode, a debug panel appears in the bottom-right corner showing real-time updates:
- Session active status
- Time remaining until timeout (updates every second)
- Warning status
- Last activity timestamp

## 🚨 Security Benefits

- **Prevents Unauthorized Access**: Automatically secures abandoned sessions
- **Compliance**: Meets security policy requirements for automatic logout
- **Data Protection**: Reduces risk of data exposure
- **Session Hijacking Prevention**: Limits exposure time for compromised sessions

## 🎨 User Experience

- **Non-Intrusive**: Only shows warnings when necessary
- **User-Friendly**: Clear countdown and easy session extension
- **Responsive**: Works on mobile and desktop devices
- **Accessible**: Proper ARIA labels and keyboard navigation

## 📊 Activity Detection Logic

```typescript
// Meaningful events that reset the timer
const meaningfulEvents = [
  'mousedown', 
  'mousemove', 
  'keydown', 
  'scroll', 
  'touchstart'
];
```

## 🔄 Session Extension

Users can extend their session through:
1. **Warning Dialog**: "Stay Logged In" button
2. **Manual Extension**: Session extension button in test interface
3. **Automatic**: Any detected activity resets the timer

## 📚 Usage Example

```typescript
// Basic usage in a component
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

function MyComponent() {
  const sessionTimeout = useSessionTimeout({
    timeoutMinutes: 30,
    warningMinutes: 5
  });

  return (
    <div>
      Time remaining: {sessionTimeout.timeRemaining}ms
      Session active: {sessionTimeout.isActive}
    </div>
  );
}
```

## 🔗 Routes

- **Main App**: Session timeout active on all authenticated routes
- **Admin Configuration**: `/admin/session-timeout` - Admin-only configuration and testing
- **Configuration**: Accessible through admin panel in sidebar navigation

## ✅ Implementation Status

- [x] Session timeout hook
- [x] Activity tracking
- [x] Warning dialog
- [x] Session manager
- [x] App integration
- [x] Admin configuration page
- [x] Dynamic settings loading
- [x] Debug mode
- [x] Admin-only testing interface
- [x] Documentation

## 🔧 Future Enhancements

- [ ] Admin configuration panel
- [ ] Different timeout settings by user role
- [ ] Activity logging and analytics
- [ ] Multiple session management
- [ ] Custom warning messages
- [ ] Email notifications for forced logouts

## 🚀 Production Deployment

For production deployment:
1. Adjust default timeout values in `SessionTimeoutManager`
2. Remove or restrict access to test page
3. Configure appropriate warning times
4. Test thoroughly with actual user workflows
5. Monitor for user feedback and adjust as needed

The session timeout feature is now fully implemented and ready for use! 