import { test, expect, Page } from '@playwright/test';

// Helper function to wait for stable rendering
async function waitForStableRendering(page: Page, selector: string, timeout = 5000) {
  let previousContent = '';
  let stableCount = 0;
  const requiredStableCount = 3; // Number of consecutive stable checks
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const currentContent = await page.textContent(selector);
      
      if (currentContent === previousContent) {
        stableCount++;
        if (stableCount >= requiredStableCount) {
          return true;
        }
      } else {
        stableCount = 0;
        previousContent = currentContent || '';
      }
      
      await page.waitForTimeout(100); // Check every 100ms
    } catch (error) {
      // Element might not be ready yet
      await page.waitForTimeout(100);
    }
  }
  
  throw new Error(`Content did not stabilize within ${timeout}ms`);
}

// Helper function to detect flickering
async function detectFlickering(page: Page, selector: string, duration = 2000) {
  const changes: string[] = [];
  let previousContent = '';
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < duration) {
    try {
      const currentContent = await page.textContent(selector);
      
      if (currentContent !== previousContent && previousContent !== '') {
        changes.push(`${Date.now() - startTime}ms: "${previousContent}" -> "${currentContent}"`);
      }
      
      previousContent = currentContent || '';
      await page.waitForTimeout(50); // Check every 50ms for flickering
    } catch (error) {
      // Element might not be ready yet
      await page.waitForTimeout(50);
    }
  }
  
  return changes;
}

test.describe('UserManagement Visual Regression Tests', () => {
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

    await page.goto('/admin/users');
  });

  test('should not flicker during initial page load', async ({ page }) => {
    // Wait for the page to start loading
    await page.waitForSelector('[data-testid="user-management-container"]', { timeout: 10000 });
    
    // Detect any flickering in the main container
    const flickerChanges = await detectFlickering(
      page, 
      '[data-testid="user-management-container"]',
      3000
    );
    
    // Should have minimal content changes (only loading -> loaded transition)
    expect(flickerChanges.length).toBeLessThanOrEqual(2);
    
    // Verify final stable state
    await waitForStableRendering(page, '[data-testid="user-management-container"]');
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('user-management-loaded.png');
  });

  test('should maintain stable loading indicator without rapid state changes', async ({ page }) => {
    // Slow down network to observe loading state
    await page.route('**/rest/v1/users*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/admin/users');
    
    // Monitor loading indicator for stability
    const loadingSelector = '[data-testid="loading-indicator"]';
    await page.waitForSelector(loadingSelector);
    
    // Check that loading indicator doesn't flicker
    const loadingFlicker = await detectFlickering(page, loadingSelector, 1500);
    
    // Loading indicator should be stable (no rapid changes)
    expect(loadingFlicker.length).toBeLessThanOrEqual(1);
    
    // Take screenshot of loading state
    await expect(page).toHaveScreenshot('user-management-loading.png');
  });

  test('should transition smoothly from loading to loaded state', async ({ page }) => {
    // Monitor the transition
    const containerSelector = '[data-testid="user-management-container"]';
    
    // Wait for loading state
    await page.waitForSelector('[data-testid="loading-indicator"]');
    
    // Take screenshot of loading state
    await expect(page).toHaveScreenshot('transition-loading.png');
    
    // Wait for loaded state
    await page.waitForSelector('[data-testid="user-list"]', { timeout: 10000 });
    
    // Ensure content is stable
    await waitForStableRendering(page, containerSelector);
    
    // Take screenshot of loaded state
    await expect(page).toHaveScreenshot('transition-loaded.png');
    
    // Verify no loading indicator remains
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
  });

  test('should handle error states without flickering', async ({ page }) => {
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
    await page.waitForSelector('[data-testid="error-state"]', { timeout: 10000 });
    
    // Monitor error state for stability
    const errorFlicker = await detectFlickering(
      page, 
      '[data-testid="error-state"]',
      2000
    );
    
    // Error state should be stable
    expect(errorFlicker.length).toBe(0);
    
    // Take screenshot of error state
    await expect(page).toHaveScreenshot('user-management-error.png');
  });

  test('should handle retry operations without visual conflicts', async ({ page }) => {
    let requestCount = 0;
    
    // Mock first request to fail, second to succeed
    await page.route('**/rest/v1/users*', async route => {
      requestCount++;
      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Network timeout' })
        });
      } else {
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
            }
          ])
        });
      }
    });

    await page.goto('/admin/users');
    
    // Wait for error state
    await page.waitForSelector('[data-testid="error-state"]');
    
    // Click retry button
    await page.click('[data-testid="retry-button"]');
    
    // Monitor retry transition
    const retryFlicker = await detectFlickering(
      page,
      '[data-testid="user-management-container"]',
      3000
    );
    
    // Should have smooth transition (error -> loading -> loaded)
    expect(retryFlicker.length).toBeLessThanOrEqual(3);
    
    // Wait for successful load
    await page.waitForSelector('[data-testid="user-list"]');
    
    // Take screenshot of successful retry
    await expect(page).toHaveScreenshot('user-management-retry-success.png');
  });

  test('should maintain stable UI during form operations', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="user-list"]');
    
    // Take screenshot of initial state
    await expect(page).toHaveScreenshot('before-form-open.png');
    
    // Open create user form
    await page.click('[data-testid="create-user-button"]');
    
    // Wait for form to open
    await page.waitForSelector('[data-testid="user-form"]');
    
    // Monitor main content for stability during form operations
    const mainContentFlicker = await detectFlickering(
      page,
      '[data-testid="user-list"]',
      1000
    );
    
    // Main content should remain stable when form opens
    expect(mainContentFlicker.length).toBe(0);
    
    // Take screenshot with form open
    await expect(page).toHaveScreenshot('form-open.png');
    
    // Close form
    await page.click('[data-testid="form-cancel-button"]');
    
    // Wait for form to close
    await page.waitForSelector('[data-testid="user-form"]', { state: 'hidden' });
    
    // Take screenshot after form close
    await expect(page).toHaveScreenshot('after-form-close.png');
  });

  test('should handle search operations without flickering', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="user-list"]');
    
    // Get initial user count
    const initialCount = await page.textContent('[data-testid="user-count"]');
    
    // Perform search
    await page.fill('[data-testid="search-input"]', 'John');
    
    // Monitor search results for stability
    const searchFlicker = await detectFlickering(
      page,
      '[data-testid="user-list"]',
      1500
    );
    
    // Search should have minimal flickering (only filter transition)
    expect(searchFlicker.length).toBeLessThanOrEqual(2);
    
    // Wait for search results to stabilize
    await waitForStableRendering(page, '[data-testid="user-list"]');
    
    // Take screenshot of search results
    await expect(page).toHaveScreenshot('search-results.png');
    
    // Clear search
    await page.fill('[data-testid="search-input"]', '');
    
    // Wait for results to return to original state
    await waitForStableRendering(page, '[data-testid="user-list"]');
    
    // Take screenshot after search clear
    await expect(page).toHaveScreenshot('search-cleared.png');
  });

  test('should handle role filter changes smoothly', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="user-list"]');
    
    // Open role filter dropdown
    await page.click('[data-testid="role-filter"]');
    
    // Select agent role
    await page.click('[data-testid="role-filter-agent"]');
    
    // Monitor filter transition
    const filterFlicker = await detectFlickering(
      page,
      '[data-testid="user-list"]',
      1000
    );
    
    // Filter should transition smoothly
    expect(filterFlicker.length).toBeLessThanOrEqual(1);
    
    // Wait for filtered results
    await waitForStableRendering(page, '[data-testid="user-list"]');
    
    // Take screenshot of filtered results
    await expect(page).toHaveScreenshot('role-filtered.png');
  });

  test('should maintain consistent layout during responsive changes', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForSelector('[data-testid="user-list"]');
    await expect(page).toHaveScreenshot('desktop-layout.png');
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500); // Allow layout to settle
    await expect(page).toHaveScreenshot('tablet-layout.png');
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Allow layout to settle
    await expect(page).toHaveScreenshot('mobile-layout.png');
    
    // Verify no layout flickering during transitions
    const layoutFlicker = await detectFlickering(
      page,
      '[data-testid="user-management-container"]',
      1000
    );
    
    // Layout should be stable after viewport changes
    expect(layoutFlicker.length).toBeLessThanOrEqual(1);
  });
});