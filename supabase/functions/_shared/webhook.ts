// Replicate signs id.timestamp.rawBody with HMAC-SHA256 (standard webhooks).
export async function verifyWebhook(raw: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const content = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for (const signature of (headers.get('webhook-signature') || '').split(' ')) {
      const [version, encoded] = signature.split(',');
      if (version === 'v1' && encoded && await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(encoded), c => c.charCodeAt(0)), content)) return true;
    }
  } catch { return false; }
  return false;
}
