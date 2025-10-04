import { test, expect, _electron as electron } from '@playwright/test';

test('launches BuildRunner dashboard', async () => {
  const electronApp = await electron.launch({ args: ['.'], env: { ELECTRON_DISABLE_SECURITY_WARNINGS: '1' } });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('.ant-layout');
  const title = await window.title();
  expect(title).toContain('BuildRunner');
  await electronApp.close();
});
