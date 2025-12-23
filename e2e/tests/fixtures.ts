import { test as base, Page } from '@playwright/test';

export type TestUser = {
  id: string;
  name: string;
  email: string;
  iconId: string;
};

export type TestList = {
  id: string;
  name: string;
  color: string;
  iconId: string;
};

export type TestItem = {
  id: string;
  listId: string;
  name: string;
  completed: boolean;
  quantity?: number;
  quantityType?: string;
  order: number;
};

type TestFixtures = {
  authenticatedPage: Page;
  testUser: TestUser;
  apiHelper: ApiHelper;
};

class ApiHelper {
  constructor(private baseURL: string) {}

  async createUser(userData: Partial<TestUser>): Promise<TestUser> {
    const response = await fetch(`${this.baseURL}/api/v1/users/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userData.username || `test-user-${Date.now()}`,
        iconId: userData.iconId || 'avatar1',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create user: ${response.status} ${response.statusText}\n${text}`);
    }

    return await response.json();
  }

  async createList(userId: string, listData: Partial<TestList>): Promise<TestList> {
    const response = await fetch(`${this.baseURL}/api/v1/lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        name: listData.name || 'Test List',
        color: listData.color || '#FF5722',
        iconId: listData.iconId || 'avatar2',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create list: ${response.statusText}`);
    }

    return await response.json();
  }

  async createItem(
    userId: string,
    listId: string,
    itemData: Partial<TestItem>
  ): Promise<TestItem> {
    const response = await fetch(`${this.baseURL}/api/v1/lists/${listId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        name: itemData.name || 'Test Item',
        type: 'item',
        quantity: itemData.quantity,
        quantityType: itemData.quantityType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create item: ${response.statusText}`);
    }

    return await response.json();
  }

  async getItems(userId: string, listId: string): Promise<TestItem[]> {
    const response = await fetch(`${this.baseURL}/api/v1/lists/${listId}/items`, {
      headers: {
        'X-User-ID': userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get items: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async deleteList(userId: string, listId: string, version: number): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/v1/lists/${listId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({ version }),
    });

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`Failed to delete list: ${response.status} ${response.statusText}\n${text}`);
    }
  }

  async clearUserData(userId: string): Promise<void> {
    // Get all lists for user
    const listsResponse = await fetch(`${this.baseURL}/api/v1/lists`, {
      headers: { 'X-User-ID': userId },
    });

    if (listsResponse.ok) {
      const listsData = await listsResponse.json();
      const lists = listsData.data || [];

      // Delete all lists (which cascades to items)
      for (const list of lists) {
        await this.deleteList(userId, list.id || list.uuid, list.version);
      }
    }
  }
}

export const test = base.extend<TestFixtures>({
  apiHelper: async ({ baseURL }, use) => {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8080';
    const helper = new ApiHelper(serverUrl);
    await use(helper);
  },

  testUser: async ({ apiHelper }, use) => {
    const user = await apiHelper.createUser({
      username: `test-user-${Date.now()}`,
    });
    await use(user);
    // Cleanup user data after test
    await apiHelper.clearUserData(user.uuid || user.id);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Set user in localStorage to simulate authentication
    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('lists-viewer-user', JSON.stringify(user));
    }, testUser);

    // Reload to apply authentication
    await page.reload();
    await page.waitForLoadState('networkidle');

    await use(page);
  },
});

export { expect } from '@playwright/test';
