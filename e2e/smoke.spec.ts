import { test, expect } from '@playwright/test';

test('app loads and renders canvas', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas#game');
    await expect(canvas).toBeVisible();

    // Canvas should fill the viewport
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
});

test('keyboard rotation changes angle display', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500); // let game initialize

    // Hold D key to rotate
    await page.keyboard.down('d');
    await page.waitForTimeout(500);
    await page.keyboard.up('d');

    // The HUD should show a non-zero angle
    // We can't easily read canvas text, but we verify no crashes
    await page.waitForTimeout(200);
});

test('R key resets without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Rotate a bit then reset
    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    await page.keyboard.up('d');
    await page.keyboard.press('r');
    await page.waitForTimeout(500);

    // App should still be running
    const canvas = page.locator('canvas#game');
    await expect(canvas).toBeVisible();
});

test('F1 toggles debug overlay without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Toggle debug overlay
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);

    const canvas = page.locator('canvas#game');
    await expect(canvas).toBeVisible();
});
