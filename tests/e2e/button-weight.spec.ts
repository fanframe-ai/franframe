import { test, expect } from '@playwright/test';

test('welcome and tutorial action buttons have bold labels', async ({ page }) => {
  await page.route('**/rest/v1/teams?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', slug: 'testteam', name: 'Time de Teste', is_active: true, shirts: [], backgrounds: [], tutorial_assets: {}, text_overrides: {}, purchase_urls: {} }) }));
  await page.route('**/functions/v1/fanframe-proxy', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"balance":1}' }));
  await page.goto('/testteam?test_token=fixture');
  const start = page.getByRole('button', { name: 'EXPERIMENTAR AGORA' });
  await expect(start).toHaveCSS('font-weight', '700');
  await start.click();
  await expect(page.getByRole('button', { name: 'COMEÇAR AGORA' })).toHaveCSS('font-weight', '700');
  await expect(page.getByRole('button', { name: 'VOLTAR', exact: true })).toHaveCSS('font-weight', '700');
});
