import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Ticket Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('creates a ticket with basic information', async ({ page }) => {
    await page.goto('/tickets');
    
    // Open create ticket dialog
    await page.click('button:has-text("Create Ticket")');
    
    // Fill form
    await page.fill('input[name="title"]', 'Test Hardware Issue');
    await page.fill('textarea[name="description"]', 'My computer is not turning on');
    await page.selectOption('select[name="category"]', { label: 'IT Support' });
    await page.selectOption('select[name="subcategory"]', { label: 'Hardware Issues' });
    
    // Submit form
    await page.click('button:has-text("Create")');
    
    // Verify success
    await expect(page.getByText('Ticket created successfully')).toBeVisible();
    
    // Verify ticket appears in list
    await expect(page.getByText('Test Hardware Issue')).toBeVisible();
  });

  test('validates required fields @accessibility', async ({ page }) => {
    await page.goto('/tickets');
    await injectAxe(page);
    
    // Open create ticket dialog
    await page.click('button:has-text("Create Ticket")');
    
    // Try to submit empty form
    await page.click('button:has-text("Create")');
    
    // Verify validation messages
    await expect(page.getByText('Title is required')).toBeVisible();
    await expect(page.getByText('Description is required')).toBeVisible();
    await expect(page.getByText('Category is required')).toBeVisible();
    
    // Check accessibility of validation messages
    await checkA11y(page);
  });

  test('handles file attachments', async ({ page }) => {
    await page.goto('/tickets');
    
    // Open create ticket dialog
    await page.click('button:has-text("Create Ticket")');
    
    // Fill basic info
    await page.fill('input[name="title"]', 'Test with Attachment');
    await page.fill('textarea[name="description"]', 'Issue with screenshot');
    await page.selectOption('select[name="category"]', { label: 'IT Support' });
    
    // Upload file
    await page.setInputFiles('input[type="file"]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content')
    });
    
    // Verify file upload
    await expect(page.getByText('test.txt')).toBeVisible();
    
    // Submit form
    await page.click('button:has-text("Create")');
    
    // Verify success
    await expect(page.getByText('Ticket created successfully')).toBeVisible();
  });

  test('creates ticket with priority and additional details @performance', async ({ page }) => {
    await page.goto('/tickets');
    
    const startTime = Date.now();
    
    // Open create ticket dialog
    await page.click('button:has-text("Create Ticket")');
    
    // Fill comprehensive form
    await page.fill('input[name="title"]', 'Urgent Network Issue');
    await page.fill('textarea[name="description"]', 'Network is down in the office');
    await page.selectOption('select[name="category"]', { label: 'IT Support' });
    await page.selectOption('select[name="priority"]', { label: 'High' });
    await page.fill('textarea[name="additional_details"]', 'Affecting all departments');
    
    // Submit form
    await page.click('button:has-text("Create")');
    
    // Verify success
    await expect(page.getByText('Ticket created successfully')).toBeVisible();
    
    // Performance check
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
  });

  test('supports keyboard navigation @accessibility', async ({ page }) => {
    await page.goto('/tickets');
    
    // Open dialog with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Navigate form with keyboard
    await page.keyboard.press('Tab'); // Title field
    await page.keyboard.type('Keyboard Test');
    
    await page.keyboard.press('Tab'); // Description field
    await page.keyboard.type('Testing keyboard navigation');
    
    await page.keyboard.press('Tab'); // Category dropdown
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Submit form with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Verify success
    await expect(page.getByText('Ticket created successfully')).toBeVisible();
  });

  test('preserves form data on navigation @performance', async ({ page }) => {
    await page.goto('/tickets');
    
    // Open create ticket dialog
    await page.click('button:has-text("Create Ticket")');
    
    // Fill form
    await page.fill('input[name="title"]', 'Draft Ticket');
    await page.fill('textarea[name="description"]', 'Draft description');
    
    // Navigate away
    await page.click('a:has-text("Dashboard")');
    
    // Navigate back
    await page.goto('/tickets');
    await page.click('button:has-text("Create Ticket")');
    
    // Verify form data is preserved
    await expect(page.locator('input[name="title"]')).toHaveValue('Draft Ticket');
    await expect(page.locator('textarea[name="description"]')).toHaveValue('Draft description');
  });
}); 