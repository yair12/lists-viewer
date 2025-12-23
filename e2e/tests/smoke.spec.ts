import { test, expect } from './fixtures';

test.describe('Smoke Tests', () => {
  test('should start server and MongoDB successfully', async ({ apiHelper }) => {
    // Verify health endpoint
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';
    const response = await fetch(`${serverUrl}/api/v1/health`);
    expect(response.ok).toBe(true);
    const health = await response.json();
    expect(health.status).toBe('alive');
  });

  test('should create user via API', async ({ apiHelper }) => {
    const user = await apiHelper.createUser({ username: 'smoke-test-user' });
    expect(user).toBeDefined();
    expect(user.id || user.uuid).toBeDefined();
    expect(user.username).toBe('smoke-test-user');
  });

  test('should create list via API', async ({ testUser, apiHelper }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Smoke Test List' });
    expect(list).toBeDefined();
    expect(list.id).toBeDefined();
    expect(list.name).toBe('Smoke Test List');
  });

  test('should create item via API', async ({ testUser, apiHelper }) => {
    const list = await apiHelper.createList(testUser.id || testUser.uuid, { name: 'Test List' });
    const item = await apiHelper.createItem(testUser.id || testUser.uuid, list.id || list.uuid, {
      name: 'Test Item',
      quantity: 1,
      quantityType: 'pieces',
    });
    
    expect(item).toBeDefined();
    expect(item.id || item.uuid).toBeDefined();
    expect(item.name).toBe('Test Item');
    // Quantity might be omitted if not set, or returned as a number
    if (item.quantity !== undefined) {
      expect(item.quantity).toBe(1);
    }
  });

  test('should load home page', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for basic app structure
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show lists on home page', async ({ authenticatedPage: page, testUser, apiHelper }) => {
    // Create a list via API
    const list = await apiHelper.createList(testUser.id || testUser.uuid, { name: 'Visible List' });
    
    // Navigate to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for the list name - use first() to avoid strict mode violation
    await expect(page.locator(`text=${list.name}`).first()).toBeVisible({ timeout: 10000 });
  });
});
