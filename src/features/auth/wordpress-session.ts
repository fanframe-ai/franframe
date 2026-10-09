import type { BalanceResponse } from '@/config/fanframe';
import { reportError } from '@/lib/diagnostics';

export function wordpressOriginHint() {
  const explicit = new URLSearchParams(window.location.search).get('wordpress_origin');
  try {
    const url = new URL(explicit || document.referrer);
    if (explicit) return url.protocol === 'https:' && !url.username && !url.password ? url.origin : explicit;
    return url.protocol === 'https:' && url.origin !== window.location.origin ? url.origin : undefined;
  } catch { return explicit || undefined; }
}

export function rememberWordpressSource(slug: string, response: BalanceResponse) {
  if (!response.wordpress_origin) return;
  const oldOrigin = localStorage.getItem(`vf_wp_origin:${slug}`);
  if (oldOrigin && oldOrigin !== response.wordpress_origin) localStorage.removeItem(`vf_generation:${slug}`);
  localStorage.setItem(`vf_wp_origin:${slug}`, response.wordpress_origin);
  localStorage.setItem(`vf_purchase_urls:${slug}`, JSON.stringify(response.purchase_urls || {}));
}

export function sessionPurchaseUrls(slug: string, fallback: Record<string, string>) {
  if (!localStorage.getItem(`vf_wp_origin:${slug}`)) return fallback;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`vf_purchase_urls:${slug}`) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([,entry]) => typeof entry === 'string')) as Record<string, string>;
  } catch (error) { reportError('wordpress_checkout_cache_invalid', error, {}, true); return {}; }
}
