import { test, expect } from '@playwright/test';

for (const validSession of [true, false]) test(`reopened one-time handoff ${validSession ? 'retains validated session' : 'rejects expired session'}`, async ({ page }) => {
  await page.route('**/rest/v1/teams?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', slug: 'testteam', name: 'Time de Teste', is_active: true, shirts: [], backgrounds: [], tutorial_assets: {}, text_overrides: {}, purchase_urls: {} }) }));
  let exchanges = 0;
  let validations = 0;
  await page.route('**/functions/v1/fanframe-proxy', route => {
    const body = route.request().postDataJSON();
    expect(body.team_slug).toBe('testteam');
    if (body.action === 'exchange') {
      exchanges++;
      return route.fulfill(exchanges === 1
        ? { status: 200, contentType: 'application/json', body: '{"ok":true,"app_token":"fixture-session","user_id":42,"balance":3}' }
        : { status: 401, contentType: 'application/json', body: '{"error":"invalid_code"}' });
    }
    expect(body.action).toBe('balance');
    expect(body.token ?? body.app_token).toBe('fixture-session');
    validations++;
    return route.fulfill(validSession
      ? { status: 200, contentType: 'application/json', body: '{"ok":true,"balance":3}' }
      : { status: 401, contentType: 'application/json', body: '{"error":"session_expired"}' });
  });
  await page.goto('/testteam?code=one-time-code');
  await expect(page.getByRole('button', { name: 'EXPERIMENTAR AGORA' })).toBeVisible();
  await page.goto('/testteam?code=one-time-code');
  if (validSession) {
    await expect(page.getByRole('button', { name: 'EXPERIMENTAR AGORA' })).toBeVisible();
    await expect(page).not.toHaveURL(/code=/);
    expect(validations).toBeGreaterThan(0);
  } else {
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'EXPERIMENTAR AGORA' })).not.toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('vf_app_token:testteam'))).toBeNull();
  }
  expect(exchanges).toBe(2);
});
