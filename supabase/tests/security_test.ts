import { verifyWebhook } from '../functions/_shared/webhook.ts';
import { validateGeneration } from '../functions/_shared/generation.ts';
import type { Team } from '../functions/_shared/auth.ts';

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}
function rejects(fn: () => unknown) {
  try { fn(); } catch { return; }
  throw new Error('Expected rejection');
}

Deno.test('Replicate webhook validates signature, body and timestamp', async () => {
  const secret = 'whsec_' + btoa('local test key');
  const id = 'evt_123';
  const timestamp = '1700000000';
  const raw = '{"id":"prediction_123","status":"succeeded"}';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('local test key'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)))));
  const headers = new Headers({ 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` });
  equal(await verifyWebhook(raw, headers, secret, 1700000000000), true);
  equal(await verifyWebhook(`${raw} `, headers, secret, 1700000000000), false);
  equal(await verifyWebhook(raw, headers, secret, 1700000400000), false);
  equal(await verifyWebhook(raw, new Headers(), secret, 1700000000000), false);
});

Deno.test('generation accepts only assets selected from the authenticated team', () => {
  const team: Team = { id: 'team1', slug: 'team1', name: 'Team', wordpress_api_base: null, generation_prompt: null,
    shirts: [{ id: 'home', assetPath: 'https://assets.example/shirt.png', imageUrl: '' }],
    backgrounds: [{ id: 'stadium', assetPath: 'https://assets.example/background.png', imageUrl: '' }] };
  const request = { request_id: '11111111-1111-4111-8111-111111111111', consent: true,
    shirtId: 'home', backgroundId: 'stadium', userImageBase64: 'data:image/png;base64,iVBORw0KGgo=' };
  equal(validateGeneration(request, team).shirt.id, 'home');
  rejects(() => validateGeneration({ ...request, shirtId: 'other-team-shirt' }, team));
  rejects(() => validateGeneration({ ...request, consent: false }, team));
  rejects(() => validateGeneration({ ...request, userImageBase64: 'data:image/png;base64,YWJj' }, team));
  rejects(() => validateGeneration({ ...request, request_id: 'not-a-uuid' }, team));
});
