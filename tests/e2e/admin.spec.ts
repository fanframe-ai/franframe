import { test, expect } from '@playwright/test';

const adminUser = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com',
  app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

for (const stage of ['session', 'role'] as const) {
  test(`admin ${stage} timeout offers recovery without granting access`, async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(({ user, expired }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'admin-fixture', refresh_token: 'refresh-fixture',
        token_type: 'bearer', expires_at: Math.floor(Date.now()/1000) + (expired ? -3600 : 3600), user }));
    }, { user: adminUser, expired: stage === 'session' });
    await page.route('**/rest/v1/user_roles?**', () => {});
    await page.route('**/auth/v1/token?grant_type=refresh_token', () => {});
    await page.goto('/admin');
    await expect(page.getByText('Verificando permissões...')).toBeVisible();
    await page.clock.runFor(16_000);
    await expect(page.getByRole('heading', { name: 'Não foi possível verificar o acesso' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
    if (stage === 'role') {
      await page.unroute('**/rest/v1/user_roles?**');
      await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/rest/v1/user_roles?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"role":"admin"}' }));
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    }
  });
}

test('authenticated non-admin cannot enter the dashboard', async ({ page }) => {
  await page.addInitScript(user => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'admin-fixture', refresh_token: 'refresh-fixture',
      token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600, user }));
  }, adminUser);
  await page.route('**/rest/v1/user_roles?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Acesso Negado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
});

test('a stale role response cannot restore access after sign-out', async ({ page }) => {
  await page.addInitScript(user => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'admin-fixture', refresh_token: 'refresh-fixture',
      token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600, user }));
  }, adminUser);
  let release: () => void = () => {};
  const pendingRole = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/rest/v1/user_roles?**', async route => {
    await pendingRole;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"role":"admin"}' });
  });
  const roleRequest = page.waitForRequest('**/rest/v1/user_roles?**');
  await page.goto('/admin');
  await roleRequest;
  await page.evaluate(() => {
    localStorage.removeItem('sb-127-auth-token');
    const channel = new BroadcastChannel('sb-127-auth-token');
    channel.postMessage({ event: 'SIGNED_OUT', session: null });
    channel.close();
  });
  await expect(page).toHaveURL(/\/admin\/login$/);
  release();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
});

test('admin login authorizes the asset upload route', async ({ page }) => {
  const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com',
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/user_roles?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"role":"admin"}' }));
  await page.route('**/auth/v1/token?grant_type=password', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    access_token: 'admin-fixture', token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-fixture', user,
  }) }));
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Senha').fill('fixture-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('link', { name: 'Alertas', exact: true })).toHaveCount(0);
  await page.goto('/admin/alerts');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.goto('/admin/upload-assets');
  await expect(page.getByRole('heading', { name: 'Upload de Assets' })).toBeVisible();
  let uploaded = false;
  await page.route('**/storage/v1/object/tryon-assets/shirts/manto-1.png', route => {
    uploaded = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"shirts/manto-1.png"}' });
  });
  await page.getByText('Manto 1').click();
  await page.getByRole('button', { name: 'Enviar 1 selecionado(s)' }).click();
  await expect(page.getByText('1 asset(s) enviado(s) com sucesso!', { exact: true })).toBeVisible();
  expect(uploaded).toBe(true);
});
