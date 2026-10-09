import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const team = {
  id: '11111111-1111-4111-8111-111111111111', slug: 'testteam', subdomain: 'testteam', name: 'Time de Teste',
  generation_prompt: null, shirts: [{ id: 'home', name: 'Camisa principal', subtitle: 'Casa', imageUrl: '/favicon.ico', assetPath: 'https://assets.example/home.png', visible: true }],
  backgrounds: [{ id: 'stadium', name: 'Estádio', subtitle: 'Arquibancada', imageUrl: '/favicon.ico', assetPath: 'https://assets.example/stadium.png', visible: true }],
  tutorial_assets: {}, primary_color: '#1679d3', secondary_color: '#ffffff', logo_url: null, watermark_url: null,
  is_active: true, text_overrides: {}, purchase_urls: {},
};

async function mockTeam(page: Page, watermarkUrl: string | null = null) {
  const teamData = { ...team, watermark_url: watermarkUrl };
  await page.route('**/rest/v1/teams?**', async route => {
    const select = new URL(route.request().url()).searchParams.get('select');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(select === 'slug' ? { slug: team.slug } : teamData) });
  });
  await page.route('**/functions/v1/fanframe-proxy', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, balance: 1 }) }));
}

async function reachUpload(page: Page) {
  await page.goto('/testteam?test_token=fixture');
  await page.getByRole('button', { name: 'EXPERIMENTAR AGORA' }).click();
  await page.getByRole('button', { name: 'COMEÇAR AGORA' }).click();
  await page.getByRole('button', { name: /Camisa principal/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Estádio/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

test('active team and scoped test link open the try-on wizard', async ({ page }) => {
  await mockTeam(page);
  await page.goto('/testteam?test_token=fixture');
  await expect(page.getByRole('button', { name: 'EXPERIMENTAR AGORA' })).toBeVisible();
  await page.getByRole('button', { name: 'EXPERIMENTAR AGORA' }).click();
  await expect(page.getByText('Como funciona')).toBeVisible();
});

for (const [extension, mimeType] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['webp', 'image/webp'], ['heic', 'image/heic']] as const) {
  test(`${extension.toUpperCase()} photo can be selected and previewed`, async ({ page }) => {
    await mockTeam(page);
    await reachUpload(page);
    await page.locator('input[type=file]').setInputFiles({ name: `photo.${extension}`, mimeType, buffer: readFileSync(`tests/fixtures/photo.${extension}`) });
    await expect(page.locator('img[alt="Uploaded preview"]')).toBeVisible();
  });
}

for (const [withWatermark, expired] of [[false, false], [true, false], [false, true]]) test(`completed test generation can be downloaded ${withWatermark ? 'with' : 'without'} watermark${expired ? ' after its image link expires' : ''}`, async ({ page }) => {
  const watermarkUrl = withWatermark ? `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')}` : null;
  await mockTeam(page, watermarkUrl);
  const output = readFileSync('tests/fixtures/photo.png').toString('base64');
  const imageUrl = `data:image/png;base64,${output}`;
  await page.route('**/functions/v1/generate-tryon', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"queueId":"11111111-1111-4111-8111-111111111111","status":"processing"}' }));
  let statusCalls = 0;
  await page.route('**/expired-result.png', route => route.fulfill({ status: 403, body: 'Expired token' }));
  await page.route('**/functions/v1/generation-status', route => {
    statusCalls++;
    expect(route.request().postDataJSON().queue_id).toBe('11111111-1111-4111-8111-111111111111');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', status: 'completed', result_image_url: expired && statusCalls === 1 ? 'http://127.0.0.1:8080/expired-result.png' : imageUrl }) });
  });
  await reachUpload(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/photo.png') });
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'VESTIR O MANTO' }).click();
  await expect(page.getByRole('button', { name: 'Baixar Foto' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar Foto' }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toMatch(/^testteam-.*\.png$/);
  const bytes = readFileSync(await saved.path());
  expect(bytes.equals(readFileSync('tests/fixtures/photo.png'))).toBe(!withWatermark);
});

test('iPhone share flow receives the generated image', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }: { files: File[] }) => {
      sessionStorage.setItem('shared-image', files[0]?.name || '');
    } });
  });
  await mockTeam(page);
  const imageUrl = `data:image/png;base64,${readFileSync('tests/fixtures/photo.png').toString('base64')}`;
  await page.route('**/functions/v1/generate-tryon', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"queueId":"11111111-1111-4111-8111-111111111111","status":"processing"}' }));
  await page.route('**/functions/v1/generation-status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'completed', result_image_url: imageUrl }) }));
  await reachUpload(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/photo.png') });
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'VESTIR O MANTO' }).click();
  await page.getByRole('button', { name: 'Baixar Foto' }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('shared-image'))).toMatch(/^testteam-.*\.png$/);
});

test('failed generation can be retried without losing the wizard', async ({ page }) => {
  await mockTeam(page);
  let attempts = 0;
  const output = readFileSync('tests/fixtures/photo.png').toString('base64');
  await page.route('**/functions/v1/generate-tryon', route => {
    attempts++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ queueId: `attempt-${attempts}`, status: 'processing' }) });
  });
  await page.route('**/functions/v1/generation-status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(attempts === 1
    ? { status: 'failed', error_message: 'Falha temporária' }
    : { status: 'completed', result_image_url: `data:image/png;base64,${output}` }) }));
  await reachUpload(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/photo.png') });
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'VESTIR O MANTO' }).click();
  await expect(page.getByText('Falha temporária')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar Novamente' }).click();
  await expect(page.getByRole('button', { name: 'Baixar Foto' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('unknown team and invalid test link do not grant wizard access', async ({ page }) => {
  await page.route('**/rest/v1/teams?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/functions/v1/fanframe-proxy', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"invalid_test_link"}' }));
  await page.goto('/unknown?test_token=invalid');
  await expect(page.getByRole('button', { name: 'EXPERIMENTAR AGORA' })).not.toBeVisible();
});

test('consent failure keeps generation disabled', async ({ page }) => {
  await mockTeam(page);
  await page.route('**/functions/v1/fanframe-proxy', route => route.fulfill(route.request().postDataJSON().action === 'consent'
    ? { status: 503, contentType: 'application/json', body: '{"error":"consent_unavailable"}' }
    : { status: 200, contentType: 'application/json', body: '{"ok":true,"balance":1}' }));
  await reachUpload(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/photo.png') });
  const generate = page.getByRole('button', { name: 'VESTIR O MANTO' });
  await expect(generate).toBeDisabled();
  await page.getByRole('checkbox').click();
  await expect(page.getByText('Erro ao registrar consentimento')).toBeVisible();
  await expect(generate).toBeDisabled();
});

test('WordPress handoff stays scoped to the team and an expired session signs out', async ({ page }) => {
  await mockTeam(page);
  await page.route('**/functions/v1/fanframe-proxy', async route => {
    const action = route.request().postDataJSON().action;
    if (action === 'exchange') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"app_token":"wp-fixture","user_id":42,"balance":1}' });
    } else {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"session_expired"}' });
    }
  });
  await page.goto('/testteam?code=one-time-code');
  await expect(page.getByRole('button', { name: 'EXPERIMENTAR AGORA' })).toBeVisible();
  await expect(page).not.toHaveURL(/code=/);
  expect(await page.evaluate(() => localStorage.getItem('vf_app_token:testteam'))).toBe('wp-fixture');
  await page.getByRole('button', { name: 'EXPERIMENTAR AGORA' }).click();
  await expect(page.getByRole('heading', { name: 'Acesso Restrito' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vf_app_token:testteam'))).toBeNull();
});

test('admin upload route requires authentication', async ({ page }) => {
  await page.goto('/admin/upload-assets');
  await expect(page).toHaveURL(/\/admin\/login/);
});
