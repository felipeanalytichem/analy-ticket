import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('page load performance metrics @performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    const metrics = await page.evaluate(() => ({
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
      firstInputDelay: performance.getEntriesByName('first-input-delay')[0]?.duration,
      timeToInteractive: performance.now()
    }));

    expect(metrics.firstContentfulPaint).toBeLessThan(1000);
    expect(metrics.largestContentfulPaint).toBeLessThan(2500);
    expect(metrics.timeToInteractive).toBeLessThan(3500);
  });

  test('ticket list rendering performance @performance', async ({ page }) => {
    await page.goto('/tickets');
    
    const renderTime = await page.evaluate(async () => {
      performance.mark('start-render');
      
      // Wait for ticket list to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      performance.mark('end-render');
      const measure = performance.measure('render-time', 'start-render', 'end-render');
      return measure.duration;
    });

    expect(renderTime).toBeLessThan(1000);
  });

  test('dashboard charts performance @performance', async ({ page }) => {
    await page.goto('/dashboard');
    
    const chartRenderTime = await page.evaluate(async () => {
      performance.mark('start-charts');
      
      // Wait for charts to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      performance.mark('end-charts');
      const measure = performance.measure('chart-render-time', 'start-charts', 'end-charts');
      return measure.duration;
    });

    expect(chartRenderTime).toBeLessThan(1500);
  });

  test('memory usage stays within limits @performance', async ({ page }) => {
    await page.goto('/dashboard');
    
    const memoryUsage = await page.evaluate(() => {
      // @ts-ignore
      const memory = performance.memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize
      };
    });

    expect(memoryUsage.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
}); 