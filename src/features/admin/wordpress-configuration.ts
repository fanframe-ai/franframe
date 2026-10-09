import type { TeamData } from './team-types';

export function wordpressConfiguration(form: Pick<TeamData, 'wordpress_api_base' | 'wordpress_sites' | 'purchase_urls'>) {
  const origins = new Set<string>();
  function site(base: string, purchases: Record<string, string>) {
    const url = new URL(base.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('A URL WordPress deve usar HTTPS, sem credenciais, parâmetros ou fragmentos.');
    }
    if (origins.has(url.origin)) throw new Error('Cada WordPress deve ter um domínio diferente.');
    origins.add(url.origin);
    if (url.pathname === '/') url.pathname = '/wp-json/vf-fanframe/v1';
    const purchase_urls = { ...purchases };
    for (const credits of [1, 3, 7]) {
      const key = `credits${credits}`;
      const value = purchase_urls[key]?.trim();
      if (!value) continue;
      const checkout = new URL(value);
      if (checkout.protocol !== 'https:' || checkout.username || checkout.password || checkout.origin !== url.origin) {
        throw new Error(`O checkout de ${credits} crédito(s) deve usar HTTPS e o domínio ${url.hostname}.`);
      }
      purchase_urls[key] = checkout.href;
    }
    return { api_base: url.href.replace(/\/+$/, ''), purchase_urls };
  }
  const additional = form.wordpress_sites || [];
  if (additional.length > 3) throw new Error('O limite é de três WordPress adicionais.');
  if (!form.wordpress_api_base?.trim()) {
    if (additional.length) throw new Error('Preencha o WordPress principal antes de adicionar outro.');
    return { wordpress_api_base: null, purchase_urls: form.purchase_urls, wordpress_sites: [] };
  }
  const primary = site(form.wordpress_api_base, form.purchase_urls);
  return { wordpress_api_base: primary.api_base, purchase_urls: primary.purchase_urls,
    wordpress_sites: additional.map(value => site(value.api_base, value.purchase_urls || {})) };
}
