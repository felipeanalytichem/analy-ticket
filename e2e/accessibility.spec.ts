import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
  });

  test('login page meets WCAG 2.1 standards @accessibility', async ({ page }) => {
    await page.goto('/login');
    const violations = await getViolations(page);
    
    expect(violations.length).toBe(0);
  });

  test('dashboard is keyboard navigable @accessibility', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).not.toBe('BODY');
  });

  test('ticket list has proper ARIA labels @accessibility', async ({ page }) => {
    await page.goto('/tickets');
    await checkA11y(page, {
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
        }
      }
    });
  });

  test('color contrast meets WCAG standards @accessibility', async ({ page }) => {
    await page.goto('/dashboard');
    const violations = await getViolations(page, {
      runOnly: {
        type: 'tag',
        values: ['color-contrast']
      }
    });
    
    expect(violations.length).toBe(0);
  });
}); 