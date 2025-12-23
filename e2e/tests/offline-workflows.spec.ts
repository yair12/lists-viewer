import { test, expect } from './fixtures';

test.describe('Offline/Online Workflows', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Ensure we're online and ready
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('should create items offline and sync when back online', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    // Create a list online
    const list = await apiHelper.createList(testUser.id, { name: 'Offline Test List' });

    // Navigate to list
    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Create items while offline - should work instantly with queue
    await page.click('button:has-text("Add Item")');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    await page.getByLabel('Item Name').fill('Offline Item 1');
    await page.keyboard.press('Enter');
    // Wait a bit for mutation to process
    await page.waitForTimeout(1000);
    
    // Check if dialog closed or manually close it
    const dialogStillOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (dialogStillOpen) {
      console.log('Dialog still open after 1s, checking for errors...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Verify item appears in UI (optimistic update)
    await expect(page.locator('text=Offline Item 1')).toBeVisible({ timeout: 2000 });

    // Create second item
    await page.click('button:has-text("Add Item")');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    await page.getByLabel('Item Name').fill('Offline Item 2');
    await page.getByLabel('Quantity (optional)').fill('2');
    // Click the autocomplete and select 'kg'
    await page.getByLabel('Unit').click();
    await page.getByRole('option', { name: 'kg' }).click();
    await page.waitForTimeout(300);
    
    // Click the Add button in the dialog (more specific selector)
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(1000);
    
    // Verify second item appears
    await expect(page.locator('text=Offline Item 2')).toBeVisible({ timeout: 2000 });

    // Verify both items appear in UI (optimistic update)
    await expect(page.locator('text=Offline Item 1')).toBeVisible();
    await expect(page.locator('text=Offline Item 2')).toBeVisible();
    await expect(page.locator('text=2 kg')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);

    // Wait for sync to complete (queue processor runs every 5 seconds)
    await page.waitForTimeout(7000);

    // Verify items synced to server
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    expect(serverItems).toHaveLength(2);
    expect(serverItems.find((item) => item.name === 'Offline Item 1')).toBeTruthy();
    expect(serverItems.find((item) => item.name === 'Offline Item 2')).toBeTruthy();

    const item2 = serverItems.find((item) => item.name === 'Offline Item 2');
    expect(item2?.quantity).toBe(2);
    expect(item2?.quantityType).toBe('kg');
  });

  test('should update item offline and sync on reconnect', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    // Create list and item online
    const list = await apiHelper.createList(testUser.id, { name: 'Update Test List' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Original Name',
      quantity: 1,
      quantityType: 'pieces',
    });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Edit item - click the row to open edit dialog
    await page.locator('text=Original Name').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    
    // Wait for fields to be visible and interactable
    await page.getByTestId('edit-item-name-input').waitFor({ state: 'visible' });
    await page.getByTestId('edit-item-name-input').fill('Updated Name');
    
    await page.getByTestId('edit-item-quantity-input').waitFor({ state: 'visible' });
    await page.getByTestId('edit-item-quantity-input').fill('5');
    
    await page.getByTestId('edit-item-submit').click();

    // Verify update in UI
    await expect(page.locator('text=Updated Name')).toBeVisible();
    await expect(page.locator('text=5 pieces')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    // Verify server has updated data
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const updatedItem = serverItems.find((i) => i.id === item.id);
    expect(updatedItem?.name).toBe('Updated Name');
    expect(updatedItem?.quantity).toBe(5);
  });

  test('should handle interrupted sync gracefully', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Interrupt Test' });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();

    // Create multiple items offline
    await page.context().setOffline(true);

    for (let i = 1; i <= 5; i++) {
      await page.getByTestId('add-item-button').click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
      const input = page.getByTestId('item-name-input');
      await input.waitFor({ state: 'visible' });
      await input.fill(`Item ${i}`);
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Add' }).click();
      
      // Wait for the item to appear in the list
      await expect(page.locator(`text=Item ${i}`)).toBeVisible({ timeout: 3000 });
    }
    
    // Verify all 5 items are visible before starting the interruption test
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`text=Item ${i}`)).toBeVisible();
    }

    // Go online and immediately offline again (interrupt sync)
    await page.context().setOffline(false);
    await page.waitForTimeout(500); // Let some items sync
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Go online again
    await page.context().setOffline(false);
    
    // Poll for all items to sync (queue retries failed items)
    let serverItems = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(1000);
      serverItems = await apiHelper.getItems(testUser.id, list.id);
      if (serverItems.length === 5) break;
    }

    // All items should eventually sync
    expect(serverItems.length).toBe(5);

    for (let i = 1; i <= 5; i++) {
      expect(serverItems.find((item) => item.name === `Item ${i}`)).toBeTruthy();
    }
  });

  test('should toggle item completion while online', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Toggle Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Test Item',
      quantity: 2.5,
      quantityType: 'kg',
    });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Wait for item to be visible
    await expect(page.locator('text=Test Item')).toBeVisible();

    // Toggle completion while online - find checkbox by role
    const checkbox = page.getByRole('checkbox').first();
    await checkbox.waitFor({ state: 'visible' });
    await checkbox.click();

    // Verify UI shows completed (text has line-through)
    await page.waitForTimeout(1000); // Wait for mutation to complete
    await expect(page.locator('text=Test Item').first()).toHaveCSS('text-decoration', /line-through/);

    // Verify server state updated (poll for sync to complete)
    let serverItem;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const serverItems = await apiHelper.getItems(testUser.id, list.id);
      serverItem = serverItems.find((i) => i.id === item.id);
      if (serverItem?.completed === true) break;
    }
    
    expect(serverItem?.completed).toBe(true);

    // CRITICAL: Verify quantity was NOT deleted (bug test)
    expect(serverItem?.quantity).toBe(2.5);
    expect(serverItem?.quantityType).toBe('kg');
  });

  test('should delete item offline and sync', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Delete Test' });
    const item1 = await apiHelper.createItem(testUser.id, list.id, { name: 'Keep Me' });
    const item2 = await apiHelper.createItem(testUser.id, list.id, { name: 'Delete Me' });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Delete item - There are 2 items, we want to delete the second one ("Delete Me")
    // Get all item menu buttons and click the second one
    const menuButtons = page.getByTestId('item-menu-button');
    await menuButtons.nth(1).click(); // Second item (0-indexed)
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByTestId('confirm-dialog-confirm').click(); // Confirm dialog
    
    // Wait for item to be removed from UI
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('item-menu-button')).toHaveCount(1);
    await expect(page.locator('text=Keep Me')).toBeVisible();

    // Go online and sync
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    // Verify server state (poll for sync to complete)
    let serverItems;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      serverItems = await apiHelper.getItems(testUser.id, list.id);
      if (serverItems.length === 1) break;
    }
    expect(serverItems).toHaveLength(1);
    expect(serverItems![0].name).toBe('Keep Me');
  });

  test('should handle rapid offline/online toggling', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Rapid Toggle Test' });

    await page.goto('/');
    await page.click(`text=${list.name}`);

    // Rapidly toggle offline/online while creating items
    for (let i = 1; i <= 3; i++) {
      await page.context().setOffline(i % 2 === 0);
      await page.getByTestId('add-item-button').click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
      const input = page.getByTestId('item-name-input');
      await input.waitFor({ state: 'visible' });
      await input.fill(`Rapid Item ${i}`);
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Add' }).click();
      await page.waitForTimeout(200);
    }

    // Stabilize online
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // All items should sync eventually
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    expect(serverItems.length).toBeGreaterThanOrEqual(3);
  });

  test('should handle network mode changes', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/');

    // Go offline
    await page.context().setOffline(true);
    
    // Verify page is still functional (cached)
    await expect(page.locator('body')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);

    // Verify page still works
    await expect(page.locator('body')).toBeVisible();
    
    // TODO: Add offline indicator UI to show connection status
  });
});
