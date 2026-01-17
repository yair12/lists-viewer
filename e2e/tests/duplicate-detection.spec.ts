import { test, expect } from './fixtures';

test.describe('Duplicate Item Detection', () => {
  test('should show duplicate dialog when creating item with existing name', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    // Create a list
    const list = await apiHelper.createList(testUser.id, { name: 'Duplicate Test' });

    // Create an initial item
    await apiHelper.createItem(testUser.id, list.id, {
      name: 'Milk',
      quantity: 1,
      quantityType: 'liters',
    });

    // Navigate to the list and authenticate
    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Try to create another item with the same name
    await page.getByTestId('add-item-button').click();
    await page.getByTestId('item-name-input').fill('Milk');
    await page.getByTestId('item-name-input').press('Enter');

    // Wait for duplicate dialog to appear
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await duplicateDialog.waitFor({ state: 'visible', timeout: 3000 });

    // Verify dialog content
    await expect(duplicateDialog).toContainText('An item with the name "Milk" already exists');
    await expect(duplicateDialog).toContainText('Milk');

    // Verify buttons are present
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /override existing/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /use existing/i })).toBeVisible();
  });

  test('should override existing item when user chooses "Override Existing"', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Override Test' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'Bread', quantity: 1, quantityType: 'pieces' });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Wait for existing item to load
    await page.waitForSelector('[data-item-id]', { timeout: 5000 });
    const existingBread = page.locator('[data-item-id]').filter({ hasText: 'Bread' });
    await expect(existingBread).toBeVisible();

    // Verify initial quantity is 1
    await expect(existingBread).toContainText('1');

    // Count initial items
    const initialItems = await page.locator('[data-item-id]').count();

    // Try to create duplicate
    await page.getByTestId('add-item-button').click();
    await page.waitForTimeout(500); // Wait for dialog to fully open
    await page.getByTestId('item-name-input').fill('Bread');
    await page.getByTestId('item-quantity-input').fill('5');
    
    // Submit the form
    await page.getByTestId('item-name-input').press('Enter');

    // Wait for duplicate dialog to appear
    await page.waitForTimeout(1000);
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    
    // Verify duplicate dialog appeared
    await expect(duplicateDialog).toBeVisible({ timeout: 3000 });

    // Click "Override Existing"
    await page.getByRole('button', { name: /override existing/i }).click();

    // Wait for dialogs to close and item to be updated
    await page.waitForTimeout(3000);

    // Verify still only one "Bread" item exists
    const breadItems = page.locator('[data-item-id]').filter({ hasText: 'Bread' });
    await expect(breadItems).toHaveCount(1);

    // Verify the quantity was updated to 5
    await expect(breadItems).toContainText('5');

    // Verify total item count hasn't changed
    const finalItems = await page.locator('[data-item-id]').count();
    expect(finalItems).toBe(initialItems);
  });

  test('should not create duplicate when user chooses "Use Existing"', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Use Existing Test' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'Eggs', quantity: 12, quantityType: 'pieces' });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Count initial items
    const initialItems = await page.locator('[data-item-id]').count();

    // Try to create duplicate
    await page.getByTestId('add-item-button').click();
    await page.getByTestId('item-name-input').fill('Eggs');
    await page.getByTestId('item-name-input').press('Enter');

    // Wait for duplicate dialog
    await page.waitForTimeout(500);
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await duplicateDialog.waitFor({ state: 'visible', timeout: 3000 });

    // Click "Use Existing"
    await page.getByRole('button', { name: /use existing/i }).click();

    // Wait a moment
    await page.waitForTimeout(1000);

    // Verify only one item with "Eggs" exists
    const eggsItems = page.locator('[data-item-id]').filter({ hasText: 'Eggs' });
    await expect(eggsItems).toHaveCount(1);

    // Verify total items didn't change
    const finalItems = await page.locator('[data-item-id]').count();
    expect(finalItems).toBe(initialItems);
  });

  test('should not show duplicate dialog for case-sensitive differences', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Case Test' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'milk', quantity: 1, quantityType: 'liters' });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Try to create item with different case (should still trigger duplicate)
    await page.getByTestId('add-item-button').click();
    await page.getByTestId('item-name-input').fill('MILK');
    await page.getByTestId('item-name-input').press('Enter');

    // Duplicate dialog should appear (case-insensitive)
    await page.waitForTimeout(500);
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await expect(duplicateDialog).toBeVisible({ timeout: 3000 });
  });

  test('should not show duplicate dialog for completed items', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Completed Test' });
    
    // Create an item
    await apiHelper.createItem(testUser.id, list.id, {
      name: 'Tomatoes',
      quantity: 5,
      quantityType: 'pieces',
    });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Complete the item via checkbox
    const tomatoesItem = page.locator('[data-item-id]').filter({ hasText: 'Tomatoes' });
    await tomatoesItem.getByRole('checkbox').click();
    
    // Wait for the item to visually move to completed section (checkbox should be checked)
    await page.waitForTimeout(1000);
    
    // Verify the checkbox is checked
    const checkbox = tomatoesItem.getByRole('checkbox');
    await expect(checkbox).toBeChecked();
    
    // Wait additional time for React Query cache to fully update
    await page.waitForTimeout(5000); // Increased from 3s to 5s
    
    // Reload the page to ensure fresh cache
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to create item with same name as completed item
    await page.getByTestId('add-item-button').click();
    await page.waitForTimeout(1000); // Wait for dialog to fully render
    await page.getByTestId('item-name-input').fill('Tomatoes');
    await page.getByTestId('item-quantity-input').fill('3');
    await page.getByTestId('item-name-input').press('Enter');

    // Wait a moment for any potential dialog to appear
    await page.waitForTimeout(2000);

    // Duplicate dialog should NOT appear (completed items are excluded)
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await expect(duplicateDialog).not.toBeVisible();

    // Wait for the create dialog to close (item should be created successfully)
    const createDialog = page.getByRole('dialog').filter({ hasText: 'Add New Item' });
    await createDialog.waitFor({ state: 'hidden', timeout: 5000 });
    
    // Wait for the new item to appear
    await page.waitForTimeout(2000);
    
    // Check backend to see if item was created
    const apiItems = await apiHelper.getItems(list.id);
    console.log(`Backend has ${apiItems.length} items:`, apiItems.map((i: any) => `${i.name} (completed: ${i.completed})`));
    
    // Verify at least one new uncompleted Tomatoes item exists
    const allItems = await page.locator('[data-item-id]').all();
    console.log(`Total items in UI: ${allItems.length}`);
    
    for (const item of allItems) {
      const text = await item.textContent();
      console.log(`Item text: ${text}`);
    }
    
    // Should have created a new Tomatoes item (2 total: 1 completed + 1 new)
    const tomatoItems = page.locator('[data-item-id]').filter({ hasText: 'Tomatoes' });
    await expect(tomatoItems).toHaveCount(2);
  });

  test('should show duplicate dialog when editing item name to existing name', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Edit Duplicate Test' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'Apples', quantity: 3, quantityType: 'pieces' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'Oranges', quantity: 2, quantityType: 'pieces' });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Edit "Oranges" to "Apples"
    const orangesItem = page.locator('[data-item-id]').filter({ hasText: 'Oranges' });
    await orangesItem.getByTestId('item-menu-button').click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /edit/i }).click();

    // Change name to existing item name
    await page.getByTestId('edit-item-name-input').fill('Apples');
    await page.getByTestId('edit-item-submit').click();

    // Wait for duplicate dialog
    await page.waitForTimeout(500);
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await duplicateDialog.waitFor({ state: 'visible', timeout: 3000 });

    // Verify dialog shows existing item
    await expect(duplicateDialog).toContainText('An item with the name "Apples" already exists');
    await expect(duplicateDialog).toContainText('Apples');
  });

  test('should not show duplicate dialog when editing item without changing name', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'No Change Test' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'Bananas', quantity: 1, quantityType: 'pieces' });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Edit item but keep same name
    const bananasItem = page.locator('[data-item-id]').filter({ hasText: 'Bananas' });
    await bananasItem.getByTestId('item-menu-button').click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /edit/i }).click();

    // Change quantity but not name
    await page.getByTestId('edit-item-quantity-input').fill('5');
    await page.getByTestId('edit-item-submit').click();

    // Wait to ensure no dialog appears
    await page.waitForTimeout(1000);

    // Duplicate dialog should NOT appear
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await expect(duplicateDialog).not.toBeVisible();

    // Item should be updated successfully
    await expect(bananasItem).toBeVisible();
  });

  test('should allow canceling from duplicate dialog', async ({
    page,
    testUser,
    apiHelper,
  }) => {
    const list = await apiHelper.createList(testUser.id, { name: 'Cancel Test' });
    await apiHelper.createItem(testUser.id, list.id, { name: 'Cheese', quantity: 1, quantityType: 'pieces' });

    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click(`text=${list.name}`);
    await page.waitForTimeout(500);

    // Try to create duplicate
    await page.getByTestId('add-item-button').click();
    await page.getByTestId('item-name-input').fill('Cheese');
    await page.getByTestId('item-name-input').press('Enter');

    // Wait for duplicate dialog
    await page.waitForTimeout(500);
    const duplicateDialog = page.getByRole('dialog').filter({ hasText: 'Duplicate Item Detected' });
    await duplicateDialog.waitFor({ state: 'visible', timeout: 3000 });

    // Click Cancel
    await page.getByRole('button', { name: /^cancel$/i }).click();

    // Duplicate dialog should close
    await expect(duplicateDialog).not.toBeVisible();

    // Create dialog should still be open (user can modify and retry)
    const createDialog = page.getByRole('dialog').filter({ hasText: /add new item/i });
    await expect(createDialog).toBeVisible();
  });
});
