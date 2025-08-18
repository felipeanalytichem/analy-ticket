# Manual Authentication and Authorization Test Cases

This document provides step-by-step manual test cases to verify the authentication and authorization flows for the User Management page.

## Prerequisites

1. Ensure the application is running (`npm run dev`)
2. Have test accounts with different roles:
   - Admin user: `admin@test.com`
   - Agent user: `agent@test.com`
   - Regular user: `user@test.com`
3. Clear browser cache and localStorage before testing

## Test Case 1: Admin User Access

### Steps:
1. Open browser and navigate to `http://localhost:8080/login`
2. Login with admin credentials
3. Navigate directly to `http://localhost:8080/admin/users`

### Expected Results:
- ✅ User should be able to access the page
- ✅ Page should load within 3 seconds
- ✅ User Management interface should be displayed
- ✅ No access denied messages should appear
- ✅ Loading states should be brief and clear

### Verification Points:
- [ ] Page loads successfully
- [ ] User Management component renders
- [ ] No error messages in console
- [ ] Loading indicator appears briefly during authentication check

## Test Case 2: Agent User Blocking

### Steps:
1. Logout if currently logged in
2. Login with agent credentials
3. Navigate directly to `http://localhost:8080/admin/users`

### Expected Results:
- ❌ User should NOT be able to access the page
- ✅ "Acesso Negado" message should be displayed
- ✅ "Você não tem permissão para acessar esta página." message should appear
- ✅ "Voltar" button should be present
- ❌ User Management interface should NOT be displayed

### Verification Points:
- [ ] Access denied page is shown
- [ ] User Management component does not render
- [ ] Back button is functional
- [ ] No console errors related to unauthorized access

## Test Case 3: Regular User Blocking

### Steps:
1. Logout if currently logged in
2. Login with regular user credentials
3. Navigate directly to `http://localhost:8080/admin/users`

### Expected Results:
- ❌ User should NOT be able to access the page
- ✅ "Acesso Negado" message should be displayed
- ✅ "Você não tem permissão para acessar esta página." message should appear
- ✅ "Voltar" button should be present
- ❌ User Management interface should NOT be displayed

### Verification Points:
- [ ] Access denied page is shown
- [ ] User Management component does not render
- [ ] Back button is functional
- [ ] No console errors related to unauthorized access

## Test Case 4: Unauthenticated User Redirection

### Steps:
1. Ensure user is logged out (clear localStorage if needed)
2. Navigate directly to `http://localhost:8080/admin/users`

### Expected Results:
- ✅ User should be redirected to login page
- ✅ URL should change to `/login`
- ✅ Login form should be displayed
- ❌ User Management interface should NOT be displayed

### Verification Points:
- [ ] Redirected to login page
- [ ] Login form is visible
- [ ] No User Management content is shown
- [ ] URL shows `/login`

## Test Case 5: Loading States During Authentication

### Steps:
1. Open browser developer tools (Network tab)
2. Throttle network to "Slow 3G" or similar
3. Login with admin credentials
4. Navigate to `http://localhost:8080/admin/users`
5. Observe loading states

### Expected Results:
- ✅ Initial loading indicator should appear
- ✅ "Loading..." text should be visible
- ✅ "Loading profile..." or "Carregando perfil..." should appear
- ✅ Loading states should not flicker or show multiple indicators
- ✅ Page should eventually load successfully

### Verification Points:
- [ ] Loading indicator appears immediately
- [ ] Loading text is clear and appropriate
- [ ] No flickering between loading states
- [ ] Smooth transition to loaded state
- [ ] No multiple loading indicators simultaneously

## Test Case 6: Session Timeout Handling

### Steps:
1. Login with admin credentials
2. Navigate to User Management page
3. Wait for session to timeout (or manually clear auth tokens in localStorage)
4. Try to interact with the page or refresh

### Expected Results:
- ✅ User should be redirected to login page when session expires
- ✅ No errors should occur during session timeout
- ✅ User should be able to login again and access the page

### Verification Points:
- [ ] Graceful handling of session timeout
- [ ] Redirect to login page
- [ ] No JavaScript errors
- [ ] Ability to re-authenticate

## Test Case 7: Network Error Handling

### Steps:
1. Open browser developer tools (Network tab)
2. Set network to "Offline"
3. Try to access `http://localhost:8080/admin/users` while logged in
4. Restore network connection

### Expected Results:
- ✅ Appropriate error handling should occur
- ✅ User should see meaningful error messages
- ✅ Page should recover when network is restored

### Verification Points:
- [ ] Error states are handled gracefully
- [ ] No application crashes
- [ ] Recovery when network is restored
- [ ] Appropriate error messages

## Test Case 8: Direct URL Access

### Steps:
1. Login with different user roles
2. Try accessing `/admin/users` directly by typing in address bar
3. Test with bookmarked URLs

### Expected Results:
- ✅ Admin users: Should access the page directly
- ❌ Non-admin users: Should see access denied
- ❌ Unauthenticated users: Should redirect to login

### Verification Points:
- [ ] Direct URL access works correctly for admins
- [ ] Direct URL access is blocked for non-admins
- [ ] Bookmarked URLs work as expected
- [ ] URL state is preserved correctly

## Test Case 9: Browser Back/Forward Navigation

### Steps:
1. Login as admin user
2. Navigate to User Management page
3. Navigate to another page
4. Use browser back button to return to User Management
5. Use forward button to navigate away and back

### Expected Results:
- ✅ Back/forward navigation should work correctly
- ✅ Authentication state should be preserved
- ✅ Page should load without re-authentication

### Verification Points:
- [ ] Back button works correctly
- [ ] Forward button works correctly
- [ ] No re-authentication required
- [ ] Page state is preserved

## Test Case 10: Multiple Tab Behavior

### Steps:
1. Login as admin in one tab
2. Open User Management page in first tab
3. Open new tab and navigate to User Management page
4. Logout in one tab
5. Check behavior in other tab

### Expected Results:
- ✅ Both tabs should show User Management for admin
- ✅ Logout in one tab should affect other tabs appropriately
- ✅ Authentication state should be synchronized

### Verification Points:
- [ ] Multiple tabs work correctly
- [ ] Authentication state is synchronized
- [ ] Logout affects all tabs
- [ ] No conflicts between tabs

## Performance Requirements

All test cases should meet these performance criteria:
- Page load time: < 3 seconds
- Authentication check: < 1 second
- Loading state transitions: < 500ms
- No memory leaks during navigation

## Reporting Issues

When reporting issues, include:
1. Test case number and description
2. Browser and version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (if any)
6. Network conditions
7. Screenshots or screen recordings

## Test Completion Checklist

- [ ] Test Case 1: Admin User Access
- [ ] Test Case 2: Agent User Blocking
- [ ] Test Case 3: Regular User Blocking
- [ ] Test Case 4: Unauthenticated User Redirection
- [ ] Test Case 5: Loading States During Authentication
- [ ] Test Case 6: Session Timeout Handling
- [ ] Test Case 7: Network Error Handling
- [ ] Test Case 8: Direct URL Access
- [ ] Test Case 9: Browser Back/Forward Navigation
- [ ] Test Case 10: Multiple Tab Behavior

## Notes

- All tests should be performed in both light and dark themes
- Test on different screen sizes (mobile, tablet, desktop)
- Verify accessibility features work correctly
- Check that all text is properly internationalized