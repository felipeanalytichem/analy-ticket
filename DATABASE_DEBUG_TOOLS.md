# 🛠️ Database Connection Debug Tools

## 🔧 **Available Tools for Debugging Database Issues**

### **1. Browser Console Commands**

Open your browser's developer console and use these commands:

#### **Full Database Test:**
```javascript
await testDatabaseConnection()
```
**Returns detailed diagnostics:**
- Session status
- Database accessibility  
- Real-time connection status
- Specific error messages

#### **Quick Health Check:**
```javascript
await quickHealthCheck()
```
**Returns:** `true` if database is accessible, `false` otherwise

#### **Session Management:**
```javascript
// Check session status
getSessionStatus()

// Force session refresh
await refreshSession()
```

#### **Emergency Reset:**
```javascript
// Clear problematic tokens (last resort)
clearSupabaseState()
```

### **2. Visual Connection Monitor**

The Connection Monitor widget shows:
- **Internet Status**: Connected/Offline
- **Database Status**: Connected/Disconnected
- **Reconnect Button**: Test connection manually
- **Refresh Page Button**: Full page reload

### **3. Console Logging**

Watch the browser console for:
- `✅ Database connection check successful`
- `⚠️ Database connection check failed`
- `✅ Session and database both working properly`
- `⚠️ Session refreshed but database connection failed`

## 🔍 **Troubleshooting Steps**

### **If Database Shows "Disconnected":**

1. **Run Full Diagnostic:**
   ```javascript
   await testDatabaseConnection()
   ```
   Check the response for specific error details.

2. **Check Auth Status:**
   ```javascript
   getSessionStatus()
   ```
   Ensure `isActive: true` and recent `lastRefresh`.

3. **Manual Session Refresh:**
   ```javascript
   await refreshSession()
   ```
   Should return `true` if successful.

4. **Quick Health Check:**
   ```javascript
   await quickHealthCheck()
   ```
   Simple boolean test of database access.

### **Common Issues & Solutions:**

#### **Authentication Problems:**
- **Symptom**: No active session
- **Solution**: User needs to login again
- **Command**: Check login status in app

#### **RLS Policy Issues:**
- **Symptom**: Database queries fail with permission errors
- **Solution**: Check Supabase dashboard RLS policies
- **Command**: `await testDatabaseConnection()` for details

#### **Network Connectivity:**
- **Symptom**: All queries fail
- **Solution**: Check internet connection
- **Command**: Test other websites

#### **Supabase Service Issues:**
- **Symptom**: Auth works but database fails
- **Solution**: Check Supabase status page
- **Command**: `await testDatabaseConnection()` for service status

## 📊 **Understanding Test Results**

### **Successful Connection:**
```javascript
{
  success: true,
  message: "Database connection fully operational",
  details: {
    session: "user@example.com",
    timestamp: "2024-01-15T10:30:00.000Z"
  }
}
```

### **Auth Issue:**
```javascript
{
  success: false,
  message: "No active session - user needs to login",
  details: "Authentication required"
}
```

### **Database Issue:**
```javascript
{
  success: false,
  message: "Database connection failed - both tickets and users tables inaccessible",
  details: {
    ticketsError: { message: "...", code: "..." },
    usersError: { message: "...", code: "..." }
  }
}
```

### **Partial Success:**
```javascript
{
  success: true,
  message: "Database partially accessible - users table works, tickets table has issues",
  details: {
    ticketsError: { message: "...", code: "..." }
  }
}
```

## 🎯 **Quick Resolution Guide**

| Problem | Command | Expected Result |
|---------|---------|----------------|
| Database shows disconnected | `await testDatabaseConnection()` | Detailed error analysis |
| Session expired | `await refreshSession()` | `true` = fixed |
| Auth issues | Check login in app | User should login |
| Persistent issues | `clearSupabaseState()` | Reset tokens |
| Connection lost | Use "Reconnect" button | Visual status update |

## 🚨 **Emergency Procedures**

### **If Nothing Works:**
1. `clearSupabaseState()` - Clear all tokens
2. Refresh the page completely
3. Login again
4. `await testDatabaseConnection()` - Verify fix

### **If Database Is Truly Down:**
1. Check Supabase status: https://status.supabase.com/
2. Verify your Supabase project is active
3. Contact Supabase support if needed

These tools provide comprehensive debugging capabilities to diagnose and resolve any database connectivity issues!
