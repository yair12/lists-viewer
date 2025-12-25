import { test, expect } from './fixtures';

test.describe('Rapid Updates', () => {
  test('should handle rapid completion toggles without version conflicts', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    // Create a list and item
    const list = await apiHelper.createList(testUser.id, { name: 'Rapid Toggle Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Toggle Me Fast',
      quantity: 1,
      quantityType: 'piece',
    });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Rapidly toggle completion 5 times
    for (let i = 0; i < 5; i++) {
      const checkbox = page.getByTestId('item-checkbox').first();
      await checkbox.click();
      await page.waitForTimeout(100); // Very fast clicks
    }

    // Wait for all syncs to complete
    await page.waitForTimeout(5000);

    // Verify no conflict dialogs appeared
    const conflictDialog = page.locator('text=Conflict Detected');
    await expect(conflictDialog).not.toBeVisible();

    // Verify final state on server (should be completed since we toggled 5 times - odd number)
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const serverItem = serverItems.find((i) => i.id === item.id);
    expect(serverItem?.completed).toBe(true);
  });

  test('should handle rapid updates to different fields without conflicts', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Rapid Edit Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Edit Me Fast',
      quantity: 1,
      quantityType: 'kg',
    });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Rapidly edit the item multiple times
    for (let i = 1; i <= 3; i++) {
      await page.getByTestId('item-menu-button').first().click();
      await page.waitForTimeout(300);
      await page.getByRole('menuitem', { name: /edit/i }).click();
      await page.getByTestId('edit-item-name-input').fill(`Update ${i}`);
      await page.getByTestId('edit-item-quantity-input').fill(`${i}`);
      await page.getByTestId('edit-item-submit').click();
      await page.waitForTimeout(500); // Fast edits
    }

    // Wait for syncs
    await page.waitForTimeout(5000);

    // No conflict dialogs
    const conflictDialog = page.locator('text=Conflict Detected');
    await expect(conflictDialog).not.toBeVisible();

    // Final state should reflect last update
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const serverItem = serverItems.find((i) => i.id === item.id);
    expect(serverItem?.name).toBe('Update 3');
    expect(serverItem?.quantity).toBe(3);
  });

  test('should deduplicate multiple updates to same item in queue', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Dedup Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Dedup Me',
      completed: false,
    });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Go offline to queue operations
    await page.context().setOffline(true);

    // Make 5 rapid toggles while offline (all get queued)
    for (let i = 0; i < 5; i++) {
      const checkbox = page.getByTestId('item-checkbox').first();
      await checkbox.click();
      await page.waitForTimeout(50);
    }

    // Go back online
    await page.context().setOffline(false);

    // Wait for queue to process
    await page.waitForTimeout(5000);

    // No conflicts should occur
    const conflictDialog = page.locator('text=Conflict Detected');
    await expect(conflictDialog).not.toBeVisible();

    // Final state should be correct (5 toggles = completed)
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    const serverItem = serverItems.find((i) => i.id === item.id);
    expect(serverItem?.completed).toBe(true);
  });

  test('should handle delete during pending updates', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Delete Test' });
    const item = await apiHelper.createItem(testUser.id, list.id, {
      name: 'Delete Me While Updating',
    });

    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Toggle completion
    const checkbox = page.getByTestId('item-checkbox').first();
    await checkbox.click();
    await page.waitForTimeout(100);

    // Then delete it
    await page.getByTestId('item-menu-button').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByTestId('confirm-dialog-confirm').click();

    // Go back online
    await page.context().setOffline(false);

    // Wait for sync
    await page.waitForTimeout(5000);

    // No conflicts
    const conflictDialog = page.locator('text=Conflict Detected');
    await expect(conflictDialog).not.toBeVisible();

    // Item should be deleted from server
    const serverItems = await apiHelper.getItems(testUser.id, list.id);
    expect(serverItems.find((i) => i.id === item.id)).toBeUndefined();
  });
});
