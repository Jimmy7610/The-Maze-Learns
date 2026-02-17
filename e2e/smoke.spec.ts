import { test, expect } from '@playwright/test';

test('scaffold loads', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas#game');
    await expect(canvas).toBeVisible();
});
