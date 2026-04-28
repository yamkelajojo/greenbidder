const { test, expect } = require('@playwright/test');

test.describe('GreenBidder Onboarding E2E Tests', () => {
  test('@smoke Login screen displays correctly', async ({ page }) => {
    await page.goto('http://localhost:8081'); // Expo web default port
    
    // Check that login screen is visible
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Log In')).toBeVisible();
    await expect(page.locator('text=Sign up')).toBeVisible();
    await expect(page.locator('text=Or continue with')).toBeVisible();
    await expect(page.locator('text=Google')).toBeVisible();
    await expect(page.locator('text=Apple')).toBeVisible();
  });

  test('@smoke No redbox errors on startup', async ({ page }) => {
    await page.goto('http://localhost:8081');
    
    // Check for any console errors containing "must be rendered within a <Text>"
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('must be rendered within a <Text>')) {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for potential errors
    await page.waitForTimeout(2000);
    
    expect(errors).toEqual([]);
  });
});
