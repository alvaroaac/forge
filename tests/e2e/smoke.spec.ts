import { expect, test, _electron as electron } from '@playwright/test';
import { join } from 'node:path';

test('app opens, shows top bar and panels', async () => {
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;

  try {
    app = await electron.launch({ args: [join(process.cwd(), 'out/main/index.js')] });

    const window = await app.firstWindow();

    await expect(window.locator('.brand')).toHaveText(/FORGE/);
    await expect(window.locator('.panel-left')).toBeVisible();
    await expect(window.locator('.panel-right')).toBeVisible();
  } finally {
    if (app) {
      await app.close();
    }
  }
});
