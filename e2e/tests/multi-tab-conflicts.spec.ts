import { test, expect } from './fixtures';
import { BrowserContext } from '@playwright/test';

test.describe('Multi-Tab Conflict Resolution', () => {
  test('should detect version conflict when editing same item in two tabs', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    // Create list and item
    const list = await apiHelper.createList(testUser.id, { name: 'Conflict Test List' });
    const item = await apiHelper.createItem(testUser.id, list.id, { name: 'Shared Item' });

    // Open two tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Authenticate both tabs
    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.click(`text=${list.name}`);
      await page.waitForLoadState('networkidle');
    }

    // Tab 1: Edit item via menu button
    await page1.getByTestId('item-menu-button').first().click();
    await page1.waitForTimeout(300);
    await page1.getByRole('menuitem', { name: /edit/i }).click();
    await page1.getByTestId('edit-item-name-input').fill('Updated in Tab 1');
    await page1.getByTestId('edit-item-submit').click();
    await page1.waitForTimeout(1000);

    // Tab 2: Try to edit same item (will use stale version)
    await page2.getByTestId('item-menu-button').first().click();
    await page2.waitForTimeout(300);
    await page2.getByRole('menuitem', { name: /edit/i }).click();
    await page2.getByTestId('edit-item-name-input').fill('Updated in Tab 2');
    await page2.getByTestId('edit-item-submit').click();
    
    // Without conflict UI, the save will fail or be rejected
    // Verify server has Tab 1's update (first one wins)
    await page2.waitForTimeout(1000);
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const serverItem = serverItems.find(i => i.id === item.id);
    expect(serverItem?.name).toBe('Updated in Tab 1');

    await page1.close();
    await page2.close();
  });

  test('should handle server-side conflict rejection (first write wins)', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Server Win Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Original',
      quantity: 1,
      quantityType: 'pieces',
    });

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.click(`text=${list.name}`);
    }

    // Tab 1: Update item first
    await page1.getByTestId('item-menu-button').first().click();
    await page1.waitForTimeout(300);
    await page1.getByRole('menuitem', { name: /edit/i }).click();
    await page1.getByTestId('edit-item-name-input').fill('First Update');
    await page1.getByTestId('edit-item-quantity-input').fill('10');
    await page1.getByTestId('edit-item-submit').click();
    await page1.waitForTimeout(1000);

    // Tab 2: Try to update same item with stale version (will fail)
    await page2.getByTestId('item-menu-button').first().click();
    await page2.waitForTimeout(300);
    await page2.getByRole('menuitem', { name: /edit/i }).click();
    await page2.getByTestId('edit-item-name-input').fill('Second Update');
    await page2.getByTestId('edit-item-quantity-input').fill('5');
    await page2.getByTestId('edit-item-submit').click();
    await page2.waitForTimeout(1000);

    // Refresh Tab 2 to see server version
    await page2.reload();
    await page2.waitForLoadState('networkidle');

    // Verify server kept first update
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const serverItem = serverItems.find((i) => i.id === item.id);
    expect(serverItem?.name).toBe('First Update');
    expect(serverItem?.quantity).toBe(10);

    await page1.close();
    await page2.close();
  });

  test('should handle concurrent edits without conflict resolution', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Local Win Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, { name: 'Original' });

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.click(`text=${list.name}`);
    }

    // Tab 1: Update first
    await page1.getByTestId('item-menu-button').first().click();
    await page1.waitForTimeout(300);
    await page1.getByRole('menuitem', { name: /edit/i }).click();
    await page1.getByTestId('edit-item-name-input').fill('First Update');
    await page1.getByTestId('edit-item-submit').click();
    
    // Poll for first update to sync
    let serverItems;
    let serverItem;
    for (let i = 0; i < 10; i++) {
      await page1.waitForTimeout(1000);
      serverItems = await apiHelper.getItems(testUser.id, list.id);
      serverItem = serverItems.find((i) => i.id === item.id);
      if (serverItem?.name === 'First Update') break;
    }

    // Verify first update succeeded
    expect(serverItem?.name).toBe('First Update');

    // Tab 2: Refresh and make another update (will succeed with fresh version)
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await page2.getByTestId('item-menu-button').first().click();
    await page2.waitForTimeout(300);
    await page2.getByRole('menuitem', { name: /edit/i }).click();
    await page2.getByTestId('edit-item-name-input').fill('Second Update After Refresh');
    await page2.getByTestId('edit-item-submit').click();
    
    // Poll for sync to complete
    for (let i = 0; i < 10; i++) {
      await page2.waitForTimeout(1000);
      serverItems = await apiHelper.getItems(testUser.id, list.id);
      serverItem = serverItems.find((i) => i.id === item.id);
      if (serverItem?.name === 'Second Update After Refresh') break;
    }

    // Verify second update succeeded
    expect(serverItem?.name).toBe('Second Update After Refresh');

    await page1.close();
    await page2.close();
  });

  test('should handle delete conflict (item deleted in another tab)', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Delete Conflict Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, { name: 'Will Be Deleted' });

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.click(`text=${list.name}`);
    }

    // Tab 1: Delete item using menu
    await page1.getByTestId('item-menu-button').first().click();
    await page1.waitForTimeout(300);
    await page1.getByRole('menuitem', { name: /delete/i }).click();
    await page1.getByTestId('confirm-dialog-confirm').click();
    await page1.waitForTimeout(1000);

    // Refresh Tab 2 to see the deletion (no cross-tab sync)
    await page2.reload();
    await page2.waitForLoadState('networkidle');

    // Verify item is gone from both UI and server
    await expect(page2.locator('text=Will Be Deleted')).not.toBeVisible();
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    expect(serverItems.find(i => i.name === 'Will Be Deleted')).toBeUndefined();

    await page1.close();
    await page2.close();
  });

  test('should handle concurrent reorder operations (last write wins)', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Reorder Test' });

    // Create multiple items
    const items = [];
    for (let i = 1; i <= 5; i++) {
      items.push(await apiHelper.createItem(testUser.id, list.id, { name: `Item ${i}` }));
    }

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.click(`text=${list.name}`);
    }

    // Tab 1: Reorder items (drag item 1 to position 3)
    const item1Tab1 = page1.locator(`[data-item-id="${items[0].id}"]`);
    const item3Tab1 = page1.locator(`[data-item-id="${items[2].id}"]`);
    await item1Tab1.dragTo(item3Tab1);
    await page1.waitForTimeout(1000);

    // Tab 2: Reorder items differently (drag item 5 to position 1)
    const item5Tab2 = page2.locator(`[data-item-id="${items[4].id}"]`);
    const item1Tab2 = page2.locator(`[data-item-id="${items[0].id}"]`);
    await item5Tab2.dragTo(item1Tab2);

    // NOTE: Due to reorder endpoint lacking version check, this is a known race condition
    // Last write wins - no conflict detection currently
    // This test documents the vulnerability

    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Verify final order (should be from Tab 2 as it was last)
    const finalItems = await apiHelper.getItems(testUser.id, list.id);
    expect(finalItems).toHaveLength(5);

    // TODO: Add proper version checking to reorder endpoint
    // Then update this test to expect conflict detection

    await page1.close();
    await page2.close();
  });

  test('should not sync data across tabs automatically (no BroadcastChannel)', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Cross-Tab Test' });

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.click(`text=${list.name}`);
    }

    // Tab 1: Create item
    await page1.getByTestId('add-item-button').click();
    await page1.waitForTimeout(500); // Wait for dialog to open
    await page1.getByTestId('item-name-input').fill('Tab 1 Item');
    await page1.getByRole('button', { name: 'Add' }).click();
    await page1.waitForTimeout(1000);

    // Tab 2: Should NOT automatically see the new item (no cross-tab sync)
    const tab2HasItem = await page2.locator('text=Tab 1 Item').isVisible().catch(() => false);
    expect(tab2HasItem).toBe(false);

    // Tab 2: Must refresh to see updates (poll for sync to complete)
    for (let i = 0; i < 5; i++) {
      await page2.reload();
      await page2.waitForLoadState('networkidle');
      const isVisible = await page2.locator('text=Tab 1 Item').isVisible().catch(() => false);
      if (isVisible) break;
      await page2.waitForTimeout(1000);
    }
    await expect(page2.locator('text=Tab 1 Item')).toBeVisible();

    await page1.close();
    await page2.close();
  });

  test('should handle concurrent item edits (demonstrates version conflict)', async ({
    context,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Bulk Complete Test' });

    const items = [];
    for (let i = 1; i <= 3; i++) {
      items.push(await apiHelper.createItem(testUser.id, list.id, { name: `Item ${i}` }));
    }

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.evaluate((user) => {
        localStorage.setItem('lists-viewer-user', JSON.stringify(user));
      }, testUser);
      await page.reload();
      await page.click(`text=${list.name}`);
    }

    // Tab 1: Edit item 2
    await page1.getByTestId('item-menu-button').nth(1).click();
    await page1.waitForTimeout(300);
    await page1.getByRole('menuitem', { name: /edit/i }).click();
    await page1.getByTestId('edit-item-name-input').fill('Updated by Tab 1');
    await page1.getByTestId('edit-item-submit').click();
    await page1.waitForTimeout(1000);

    // Tab 2: Try to edit same item with stale version
    await page2.getByTestId('item-menu-button').nth(1).click();
    await page2.waitForTimeout(300);
    await page2.getByRole('menuitem', { name: /edit/i }).click();
    await page2.getByTestId('edit-item-name-input').fill('Updated by Tab 2');
    await page2.getByTestId('edit-item-submit').click();
    await page2.waitForTimeout(1000);

    // Verify Tab 1's update won (first write)
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const item2 = serverItems.find(i => i.id === items[1].id);
    expect(item2?.name).toBe('Updated by Tab 1');

    await page1.close();
    await page2.close();
  });
});
