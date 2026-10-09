import { test, expect, type Page } from '@playwright/test';
import { emptyTeam } from '../../src/features/admin/team-types';

const checkout = (origin: string) => ({ credits1: `${origin}/checkout/?add-to-cart=4516`,
  credits3: `${origin}/checkout/?add-to-cart=4517`, credits7: `${origin}/checkout/?add-to-cart=4518`,
  price1: 'R$ 5,90', price3: 'R$ 14,90', price7: 'R$ 29,90' });

async function editor(page: Page, isNew = false) {
  let saved = { ...emptyTeam, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', slug: 'saopaulo-fixture', name: 'São Paulo',
    wordpress_api_base: 'https://homolog.example/wp-json/vf-fanframe/v1', purchase_urls: checkout('https://homolog.example'),
    wordpress_sites: [{ api_base: 'https://tricolorvirtualexperience.net/wp-json/vf-fanframe/v1',
      purchase_urls: checkout('https://tricolorvirtualexperience.net') }] };
  let writes = 0;
  await page.addInitScript(() => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'admin-fixture', refresh_token: 'refresh-fixture',
      token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
      user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated', role: 'authenticated',
        email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } }));
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/user_roles?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"role":"admin"}' }));
  await page.route('**/rest/v1/teams?**', async route => {
    if (['PATCH', 'POST'].includes(route.request().method())) {
      writes++;
      saved = { ...saved, ...route.request().postDataJSON() };
    }
    const result = route.request().method() !== 'GET' || new URL(route.request().url()).searchParams.has('slug') ? saved : [saved];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(`/admin/teams/${isNew ? 'novo' : 'saopaulo-fixture'}`);
  await page.getByRole('tab', { name: 'Integração', exact: true }).click();
  return { read: () => saved, writes: () => writes };
}

test('entering a WordPress reveals checkout fields and creates both site configurations', async ({ page }) => {
  const fixture = await editor(page, true);
  const primary = page.getByRole('group', { name: 'WordPress principal', exact: true });
  await expect(primary.getByLabel('Checkout 1 crédito', { exact: true })).toHaveCount(0);
  await primary.getByLabel('URL WordPress', { exact: true }).fill('https://principal.example');
  await primary.getByLabel('Checkout 1 crédito', { exact: true }).fill('https://principal.example/checkout/?add-to-cart=1');
  await page.getByRole('button', { name: 'Adicionar WordPress' }).click();
  const added = page.getByRole('group', { name: 'WordPress adicional 1', exact: true });
  await added.getByLabel('URL WordPress', { exact: true }).fill('https://segundo.example');
  await added.getByLabel('Checkout 7 créditos', { exact: true }).fill('https://segundo.example/checkout/?add-to-cart=7');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/teams$/);
  expect(fixture.writes()).toBe(1);
  expect(fixture.read().purchase_urls.credits1).toBe('https://principal.example/checkout/?add-to-cart=1');
  expect(fixture.read().wordpress_sites[0].purchase_urls.credits7).toBe('https://segundo.example/checkout/?add-to-cart=7');
});

test('per-WordPress checkouts save and reload without mixing sites', async ({ page }) => {
  const fixture = await editor(page);
  const primary = page.getByRole('group', { name: 'WordPress principal', exact: true });
  const tricolor = page.getByRole('group', { name: 'WordPress adicional 1', exact: true });
  await expect(tricolor.getByLabel('Checkout 3 créditos', { exact: true })).toHaveValue(checkout('https://tricolorvirtualexperience.net').credits3);
  await tricolor.getByLabel('Checkout 3 créditos', { exact: true }).fill('https://tricolorvirtualexperience.net/checkout/?add-to-cart=9999');
  await tricolor.getByLabel('Preço de 3 créditos', { exact: true }).fill('R$ 15,90');
  await expect(primary.getByLabel('Checkout 3 créditos', { exact: true })).toHaveValue(checkout('https://homolog.example').credits3);
  await page.getByRole('button', { name: 'Adicionar WordPress' }).click();
  const added = page.getByRole('group', { name: 'WordPress adicional 2', exact: true });
  await added.getByLabel('URL WordPress', { exact: true }).fill('https://novo.example');
  await expect(added.getByLabel('Checkout 1 crédito', { exact: true })).toHaveValue('');
  await added.getByLabel('Checkout 1 crédito', { exact: true }).fill('https://novo.example/checkout/?add-to-cart=10');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Time atualizado!', { exact: true })).toBeVisible();
  expect(fixture.read().wordpress_sites).toHaveLength(2);
  expect(fixture.read().wordpress_api_base).toBe('https://homolog.example/wp-json/vf-fanframe/v1');
  await page.reload();
  await page.getByRole('tab', { name: 'Integração', exact: true }).click();
  await expect(tricolor.getByLabel('Checkout 3 créditos', { exact: true })).toHaveValue('https://tricolorvirtualexperience.net/checkout/?add-to-cart=9999');
  await expect(tricolor.getByLabel('Preço de 3 créditos', { exact: true })).toHaveValue('R$ 15,90');
  await expect(added.getByLabel('URL WordPress', { exact: true })).toHaveValue('https://novo.example/wp-json/vf-fanframe/v1');
  await expect(added.getByLabel('Checkout 1 crédito', { exact: true })).toHaveValue('https://novo.example/checkout/?add-to-cart=10');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Adicionar WordPress' }).click();
  await expect(page.getByRole('button', { name: 'Adicionar WordPress' })).toBeDisabled();
  await page.getByRole('button', { name: 'Remover WordPress adicional 3' }).click();
  await expect(page.getByRole('button', { name: 'Adicionar WordPress' })).toBeEnabled();
});

for (const [field, value] of [
  ['URL WordPress', 'http://inseguro.example'],
  ['URL WordPress', 'https://homolog.example/wp-json/vf-fanframe/v1'],
  ['URL WordPress', 'https://user:password@novo.example'],
  ['URL WordPress', 'https://novo.example/?secret=invalid'],
  ['URL WordPress', ''],
  ['Checkout 1 crédito', 'https://homolog.example/checkout/?add-to-cart=4516'],
  ['Checkout 1 crédito', 'javascript:alert(1)'],
] as const) {
  test(`invalid ${field} ${value} prevents saving`, async ({ page }) => {
    const fixture = await editor(page);
    await page.getByRole('group', { name: 'WordPress adicional 1', exact: true }).getByLabel(field, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Revise os links WordPress', { exact: true })).toBeVisible();
    expect(fixture.writes()).toBe(0);
  });
}
