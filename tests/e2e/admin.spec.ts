import { test, expect } from '@playwright/test';

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
