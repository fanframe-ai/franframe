import { test, expect } from '@playwright/test';

for (const balance of [1, 0]) test(`start with ${balance ? 'known credit does not wait for WordPress' : 'zero credits waits visibly and does not enter the wizard'}`, async ({ page }) => {
  await page.route('**/rest/v1/teams?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', slug: 'testteam', name: 'Time de Teste', is_active: true, shirts: [], backgrounds: [], tutorial_assets: {}, text_overrides: {}, purchase_urls: {} }) }));
  let balanceCalls = 0;
  await page.route('**/functions/v1/fanframe-proxy', async route => {
    const input = route.request().postDataJSON();
    expect(input.team_slug).toBe('testteam');
    if (input.action === 'exchange') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, app_token: 'fixture-session', user_id: 42, balance }) });
      return;
    }
    expect(input.action).toBe('balance');
    balanceCalls++;
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, balance }) });
  });
  await page.goto('/testteam?code=fixture');
  await page.getByRole('button', { name: 'EXPERIMENTAR AGORA' }).click();
  if (balance) {
    await expect(page.getByText('Como funciona', { exact: true })).toBeVisible({ timeout: 500 });
    expect(balanceCalls).toBe(0);
  } else {
    await expect(page.getByRole('button', { name: 'Verificando saldo...' })).toBeDisabled();
    await expect(page.getByText('Como funciona', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sem créditos' })).toBeVisible();
    expect(balanceCalls).toBe(1);
  }
});
