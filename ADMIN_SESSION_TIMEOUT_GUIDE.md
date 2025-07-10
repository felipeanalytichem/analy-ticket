# Admin Session Timeout Configuration Guide

## Overview

The session timeout system now provides complete admin control over automatic logout settings. Admins can configure timeout durations, warning periods, and testing options through a dedicated admin interface.

## Accessing the Configuration

### Navigation
1. Log in as an admin user
2. Go to **Administration** → **Session Timeout** in the sidebar
3. URL: `/admin/session-timeout`

### Admin Requirements
- Only users with `admin` role can access this page
- Non-admin users are automatically redirected to dashboard

## Configuration Options

### Main Settings

#### 1. Session Timeout (minutes)
- **Range**: 1 - 480 minutes (8 hours)
- **Description**: How long users can be inactive before automatic logout
- **Default**: 60 minutes
- **Examples**: 
  - 30 minutes = High security
  - 60 minutes = Standard (recommended)
  - 120 minutes = Relaxed for long tasks

#### 2. Warning Time (minutes)
- **Range**: 1 minute to (timeout - 1) minutes
- **Description**: When to show warning dialog before logout
- **Default**: 5 minutes
- **Behavior**: Warning appears X minutes before timeout

#### 3. Check Interval (seconds)
- **Range**: 1 - 60 seconds
- **Description**: How often to check for timeout (affects countdown accuracy)
- **Default**: 1 second
- **Impact**: Lower values = smoother countdown, higher CPU usage

### Quick Presets

#### Conservative (High Security)
- **Timeout**: 30 minutes
- **Warning**: 5 minutes
- **Check**: 1 second
- **Use Case**: High-security environments, financial systems

#### Standard (Balanced)
- **Timeout**: 60 minutes
- **Warning**: 5 minutes  
- **Check**: 1 second
- **Use Case**: General business applications (recommended)

#### Relaxed (User-Friendly)
- **Timeout**: 120 minutes
- **Warning**: 10 minutes
- **Check**: 5 seconds
- **Use Case**: Long tasks, data entry work

## Settings Management

### Saving Settings
1. Modify any configuration values
2. Click **"Save Settings"** button
3. Settings are stored in browser localStorage
4. Changes apply to **new user sessions**

### Reverting Changes
- **"Revert Changes"**: Undo unsaved modifications
- **"Reset to Defaults"**: Return to system defaults (60min timeout, 5min warning)

### Settings Persistence
- Settings are saved in browser localStorage
- Persist across page refreshes and admin sessions
- Each browser/device maintains separate settings
- Settings sync immediately when changed

## Testing Your Configuration

### Built-in Testing Tools
The configuration page includes a testing panel with:

#### Controls
- **Start**: Begin monitoring with current settings
- **Stop**: Stop session monitoring
- **Reset Timer**: Reset activity to current time
- **Force Warning**: Immediately trigger warning dialog
- **Force Timeout**: Immediately trigger automatic logout  
- **Test Logout**: Test manual logout functionality

#### Real-Time Monitoring
- Live countdown display
- Current timeout settings display
- Activity tracking
- Status indicators (Active/Inactive, Normal/Warning)

### Testing Procedure
1. **Configure** your desired settings
2. **Save** the settings
3. **Start** monitoring in the test panel
4. **Use "Force Warning"** to test warning dialog immediately
5. **Use "Force Timeout"** to test automatic logout
6. **Verify** that logout works properly (stay logged out after refresh)

## How Settings Apply

### To New Sessions
- Settings apply immediately to new user logins
- Existing active sessions continue with previous settings
- Users may need to log out/in to see new timeouts

### Activity Detection
The system detects these user activities:
- Mouse movement and clicks
- Keyboard input
- Page scrolling  
- Touch events (mobile)

### Warning Behavior
- Toast notification appears at configured warning time
- Users can click "Stay Logged In" to extend session
- Countdown shows exact time remaining
- Warning persists until user action or logout

### Automatic Logout Process
- Complete session termination
- All authentication tokens cleared
- Automatic redirect to login page
- User stays logged out even after page refresh

## Troubleshooting

### Settings Not Taking Effect
1. **Check Save Status**: Ensure settings were saved successfully
2. **Refresh Sessions**: Users may need to log out and back in
3. **Browser Cache**: Clear localStorage if issues persist
4. **Check Console**: Look for errors in browser developer tools

### Testing Issues  
1. **Force Functions Not Working**: Ensure monitoring is started first
2. **Logout Not Complete**: Check console logs for errors
3. **Timer Not Updating**: Verify check interval is set to 1 second

### Common Problems
- **Settings Lost**: Check if localStorage is enabled in browser
- **Multiple Admins**: Each admin's browser stores settings separately  
- **Mobile Issues**: Ensure touch events are working for activity detection

## Best Practices

### Security Considerations
- **High-Value Systems**: Use shorter timeouts (15-30 minutes)
- **Regular Business**: Standard 60-minute timeout is appropriate
- **Data Entry**: Consider longer timeouts to prevent work loss

### User Experience
- **Balance Security vs Usability**: Too short = frustrating, too long = insecure
- **Warning Time**: Give users enough time to save work (5+ minutes)
- **Communication**: Inform users about timeout policy changes

### Performance
- **Check Interval**: 1 second for real-time, 5+ seconds for performance
- **Large Organizations**: Consider server-side session management
- **Mobile Users**: Test on mobile devices for touch activity detection

## Advanced Configuration

### Multiple Environment Setup
For different timeout settings per environment:
1. Configure settings in each environment's admin panel
2. Settings are environment-specific (stored locally)
3. Use presets for consistency across environments

### Integration with Other Systems
- Settings stored in `localStorage` as `sessionTimeoutSettings`
- Can be read by external monitoring tools
- Custom events fired when settings change (`sessionTimeoutSettingsChanged`)

### Monitoring and Analytics
- All timeout events logged to browser console
- Use browser developer tools to monitor activity
- Integration with external analytics possible via console logs

## Support

### Getting Help
1. Check browser console for detailed logs
2. Test with "Force" functions to isolate issues
3. Verify admin role permissions
4. Contact system administrator for database-level issues

### Reporting Issues
When reporting problems, include:
- Current timeout settings
- Browser and version
- Console error messages
- Steps to reproduce the issue
- User role and permissions 