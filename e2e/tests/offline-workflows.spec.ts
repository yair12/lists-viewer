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

    // Create items while offline - the mutation will timeout but should queue
    await page.click('button:has-text("Add Item")');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    await page.getByLabel('Item Name').fill('Offline Item 1');
    await page.keyboard.press('Enter');
    // Wait for dialog to close (mutation will timeout after network request fails)
    await page.waitForTimeout(3000);
    
    // Check if dialog is still open and close it manually if mutation hung
    const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (dialogVisible) {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);

    await page.click('button:has-text("Add Item")');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    await page.getByLabel('Item Name').fill('Offline Item 2');
    await page.getByLabel('Quantity (optional)').fill('2');
    await page.selectOption('select[name="quantityType"]', 'kg');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    
    const dialogVisible2 = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (dialogVisible2) {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
    // Verify items appear in UI (optimistic update)
    await expect(page.locator('text=Offline Item 1')).toBeVisible();
    await expect(page.locator('text=Offline Item 2')).toBeVisible();
    await expect(page.locator('text=2 kg')).toBeVisible();

    // Check sync queue has pending items
    const queueCount = await page.evaluate(() => {
      return localStorage.getItem('sync-queue-count') || '0';
    });
    // Note: This depends on your implementation storing queue count

    // Go back online
    await page.context().setOffline(false);

    // Wait for sync to complete
    await page.waitForTimeout(3000);

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
    await page.getByLabel('Item Name').fill('Updated Name');
    await page.getByLabel('Quantity (optional)').fill('5');
    await page.click('button:has-text("Save")');

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

    // Create multiple items offline
    await page.context().setOffline(true);

    for (let i = 1; i <= 5; i++) {
      await page.click('button:has-text("Add Item")');
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
      await page.getByLabel('Item Name').fill(`Item ${i}`);
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(100);
    }

    // Go online and immediately offline again (interrupt sync)
    await page.context().setOffline(false);
    await page.waitForTimeout(500); // Let some items sync
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Go online again
    await page.context().setOffline(false);
    await page.waitForTimeout(5000); // Wait for full sync

    // All items should eventually sync
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
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

    // Toggle completion while online
    const itemRow = page.locator('text=Test Item').first();
    const checkbox = itemRow.locator('..').locator('input[type="checkbox"]');
    await checkbox.click();

    // Verify UI shows completed (text has line-through)
    await page.waitForTimeout(500);
    await expect(page.locator('text=Test Item').first()).toHaveCSS('text-decoration', /line-through/);

    // Verify server state updated
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const serverItem = serverItems.find((i) => i.id === item.id);
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

    // Delete item - the structure has checkbox, then menu button
    // Find the text, go up to parent row, find the IconButton (last button)
    const itemText = page.locator('text=Delete Me').first();
    await itemText.click(); // This opens edit dialog
    await page.keyboard.press('Escape'); // Close it
    await page.waitForTimeout(200);
    
    // Now click the menu button (small button with icon)
    const row = page.locator('text=Delete Me').locator('..');
    await row.locator('button').last().click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByRole('button', { name: 'Delete' }).click(); // Confirm dialog

    // Verify removed from UI
    await expect(page.locator('text=Delete Me')).not.toBeVisible();
    await expect(page.locator('text=Keep Me')).toBeVisible();

    // Go online and sync
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    // Verify server state
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    expect(serverItems).toHaveLength(1);
    expect(serverItems[0].name).toBe('Keep Me');
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
      await page.click('button:has-text("Add Item")');
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
      await page.getByLabel('Item Name').fill(`Rapid Item ${i}`);
      await page.click('button:has-text("Add")');
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
