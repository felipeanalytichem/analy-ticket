import { test, expect } from '@playwright/test';

test.describe('UserManagement Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-id',
          email: 'admin@test.com',
          user_metadata: { role: 'admin' }
        })
      });
    });

    // Mock user data
    await page.route('**/rest/v1/users*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'user1',
            full_name: 'John Doe',
            email: 'john@example.com',
            role: 'user',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          },
          {
            id: 'user2',
            full_name: 'Jane Smith',
            email: 'jane@example.com',
            role: 'agent',
            created_at: '2023-01-02T00:00:00Z',
            updated_at: '2023-01-02T00:00:00Z'
          }
        ])
      });
    });
  });

  test('should load user management page without visual issues', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Wait for the page to load
    await page.waitForSelector('text=User Management', { timeout: 10000 });
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('user-management-loaded.png');
  });

  test('should handle search functionality visually', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Wait for the page to load
    await page.waitForSelector('text=User Management');
    
    // Perform search
    await page.fill('input[placeholder*="Search users"]', 'John');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Take screenshot of search results
    await expect(page).toHaveScreenshot('user-management-search.png');
  });

  test('should handle responsive layout', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/admin/users');
    await page.waitForSelector('text=User Management');
    await expect(page).toHaveScreenshot('user-management-desktop.png');
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Allow layout to settle
    await expect(page).toHaveScreenshot('user-management-mobile.png');
  });

  test('should handle error states visually', async ({ page }) => {
    // Mock network error
    await page.route('**/rest/v1/users*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' })
      });
    });

    await page.goto('/admin/users');
    
    // Wait for error state
    await page.waitForSelector('text=Failed to load', { timeout: 10000 });
    
    // Take screenshot of error state
    await expect(page).toHaveScreenshot('user-management-error.png');
  });

  test('should handle form interactions visually', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Wait for the page to load
    await page.waitForSelector('text=User Management');
    
    // Open create user form
    await page.click('button:has-text("New User")');
    
    // Wait for form to open
    await page.waitForSelector('text=Create New User');
    
    // Take screenshot with form open
    await expect(page).toHaveScreenshot('user-management-form-open.png');
    
    // Fill form
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    
    // Take screenshot with form filled
    await expect(page).toHaveScreenshot('user-management-form-filled.png');
  });
});