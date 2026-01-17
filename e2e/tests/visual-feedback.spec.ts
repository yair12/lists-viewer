import { test, expect } from './fixtures';

test.describe('Visual Feedback', () => {
  test('should show yellow background when editing an item', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    // Create a list and item
    const list = await apiHelper.createList(testUser.id, { name: 'Visual Test List' });
    const item = await apiHelper.createItem(testUser.id, list.id, { 
      name: 'Test Item',
      order: 0 
    });

    // Navigate to the list
    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Go offline to prevent sync from completing
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      });
      window.dispatchEvent(new Event('offline'));
    });
    
    // Wait a bit for offline state to be registered
    await page.waitForTimeout(500);

    // Get the item row
    const itemRow = page.locator(`[data-item-id="${item.id}"]`);
    
    // Check initial background (should be transparent)
    const initialBgColor = await itemRow.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('[TEST] Initial background:', initialBgColor);

    // Click to edit the item
    await itemRow.click();
    
    // Wait for edit dialog
    await page.waitForSelector('text=Edit Item');
    
    // Change the item name
    const nameInput = page.getByLabel('Name');
    await nameInput.clear();
    await nameInput.fill('Updated Item Name');
    
    // Save the edit
    await page.click('button:has-text("Save")');
    
    // Wait for the dialog to close
    await page.waitForSelector('text=Edit Item', { state: 'hidden' });
    
    // Wait for background to become yellow (pending sync indicator)
    await page.waitForTimeout(500);
    
    const bgColorDuringSync = await itemRow.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('[TEST] Background during sync:', bgColorDuringSync);
    
    // The background should be yellow/warning color (pending state since we're offline)
    expect(bgColorDuringSync).not.toBe(initialBgColor);
    expect(bgColorDuringSync).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
    expect(bgColorDuringSync).not.toBe('transparent');
    expect(bgColorDuringSync).toContain('178'); // Should be rgb(178, 116, 26)
  });

  test('should show yellow background when reordering items', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    // Create a list with multiple items
    const list = await apiHelper.createList(testUser.id, { name: 'Reorder Visual Test' });
    const item1 = await apiHelper.createItem(testUser.id, list.id, { 
      name: 'Item 1',
      order: 0 
    });
    const item2 = await apiHelper.createItem(testUser.id, list.id, { 
      name: 'Item 2',
      order: 1 
    });

    // Navigate to the list
    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // Perform drag operation
    const dragFrom = page.locator(`[data-item-id="${item1.id}"]`);
    const dragTo = page.locator(`[data-item-id="${item2.id}"]`);

    const fromBox = await dragFrom.boundingBox();
    const toBox = await dragTo.boundingBox();

    if (!fromBox || !toBox) {
      throw new Error('Could not get element positions');
    }

    // Perform drag
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2);
    await page.mouse.up();

    // Immediately check if items have yellow background
    await page.waitForTimeout(100);
    
    const item1BgColor = await dragFrom.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const item2BgColor = await dragTo.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    console.log('[TEST] Item 1 background after reorder:', item1BgColor);
    console.log('[TEST] Item 2 background after reorder:', item2BgColor);
    
    // At least one item should show pending sync indicator
    const hasPendingIndicator = 
      (item1BgColor !== 'rgba(0, 0, 0, 0)' && item1BgColor !== 'transparent') ||
      (item2BgColor !== 'rgba(0, 0, 0, 0)' && item2BgColor !== 'transparent');
    
    expect(hasPendingIndicator).toBe(true);
    
    // Wait for sync to complete - backgrounds should go back to normal
    await page.waitForFunction(
      (itemIds) => {
        return itemIds.every((id: string) => {
          const row = document.querySelector(`[data-item-id="${id}"]`);
          if (!row) return false;
          const bgColor = window.getComputedStyle(row).backgroundColor;
          return bgColor === 'rgba(0, 0, 0, 0)' || 
                 bgColor === 'transparent' || 
                 bgColor === 'rgba(255, 255, 255, 0.08)';
        });
      },
      [item1.id, item2.id],
      { timeout: 10000 }
    );
    
    const item1FinalBg = await dragFrom.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    console.log('[TEST] Item 1 final background:', item1FinalBg);
    
    // Should be back to transparent or hover
    const isTransparent = item1FinalBg === 'rgba(0, 0, 0, 0)' || item1FinalBg === 'transparent';
    const isHover = item1FinalBg === 'rgba(255, 255, 255, 0.08)';
    expect(isTransparent || isHover).toBe(true);
  });

  test('should show yellow background when completing an item', async ({
    authenticatedPage: page,
    testUser,
    apiHelper,
  }) => {
    // Listen to ALL console messages for debugging
    page.on('console', msg => console.log('[BROWSER]', msg.text()));
    
    // Create a list and item
    const list = await apiHelper.createList(testUser.id, { name: 'Complete Test List' });
    const item = await apiHelper.createItem(testUser.id, list.id, { 
      name: 'Test Item to Complete',
      order: 0,
      completed: false
    });

    // Navigate to the list
    await page.goto('/');
    await page.click(`text=${list.name}`);
    await page.waitForLoadState('networkidle');

    // STEP 1: Go offline
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      });
      window.dispatchEvent(new Event('offline'));
      console.log('[TEST] ⚫ Set OFFLINE mode');
    });
    await page.waitForTimeout(1000);

    // STEP 2: Complete the item while offline
    const itemRow = page.locator(`[data-item-id="${item.id}"]`);
    const checkbox = itemRow.locator('input[type="checkbox"]');
    
    console.log('[TEST] 📝 Clicking checkbox to complete item while offline');
    await checkbox.click();
    await page.waitForTimeout(1000);

    // STEP 3: Verify yellow background (pending state)
    const anyItemRow = page.locator('[data-item-id]').filter({ hasText: 'Test Item to Complete' }).first();
    const bgColorOffline = await anyItemRow.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    console.log('[TEST] 🟡 Background while offline:', bgColorOffline);
    expect(bgColorOffline).toBe('rgb(178, 116, 26)');

    // STEP 4: Verify item is in sync queue
    const queueBefore = await page.evaluate(async () => {
      const db = await (window as any).__openDB();
      return new Promise<number>((resolve) => {
        const tx = db.transaction('syncQueue', 'readonly');
        const store = tx.objectStore('syncQueue');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.length);
        request.onerror = () => resolve(0);
      });
    });
    console.log('[TEST] 📋 Items in sync queue:', queueBefore);
    expect(queueBefore).toBeGreaterThan(0);

    // STEP 5: Go back online
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true
      });
      window.dispatchEvent(new Event('online'));
      console.log('[TEST] 🟢 Set ONLINE mode');
    });
    
    // Wait for network status to update
    await page.waitForFunction(
      () => (window as any).__networkStatus?.isOnline === true,
      { timeout: 10000, polling: 500 }
    );
    console.log('[TEST] ✅ Network status confirmed online');

    // STEP 6: Trigger queue processing
    await page.evaluate(() => {
      const qp = (window as any).__queueProcessor;
      console.log('[TEST] 🔄 Triggering queue processor');
      qp?.trigger();
    });

    // STEP 7: Wait for sync to complete (background clears)
    console.log('[TEST] ⏳ Waiting for yellow background to clear...');
    await page.waitForFunction(
      (itemName) => {
        // Find the row containing the item text
        const rows = Array.from(document.querySelectorAll('[data-item-id]'));
        const row = rows.find(r => r.textContent?.includes(itemName));
        if (!row) {
          console.log('[WAIT] Item row not found');
          return false;
        }
        const bgColor = window.getComputedStyle(row as Element).backgroundColor;
        const isCleared = bgColor === 'rgba(0, 0, 0, 0)' || 
                         bgColor === 'transparent' || 
                         bgColor === 'rgba(255, 255, 255, 0.08)';
        if (!isCleared) {
          console.log('[WAIT] Background still:', bgColor);
        }
        return isCleared;
      },
      'Test Item to Complete',
      { timeout: 20000, polling: 1000 }
    );

    // STEP 8: Final verification
    const finalBgColor = await anyItemRow.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('[TEST] ✅ Final background (should be clear):', finalBgColor);

    const queueAfter = await page.evaluate(async () => {
      const db = await (window as any).__openDB();
      return new Promise<number>((resolve) => {
        const tx = db.transaction('syncQueue', 'readonly');
        const store = tx.objectStore('syncQueue');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.length);
        request.onerror = () => resolve(-1);
      });
    });
    console.log('[TEST] ✅ Final queue count:', queueAfter);
    expect(queueAfter).toBe(0);
  });
});
