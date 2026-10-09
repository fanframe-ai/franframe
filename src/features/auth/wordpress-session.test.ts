import { afterEach, expect, it, vi } from 'vitest';
import { wordpressOriginHint, rememberWordpressSource, sessionPurchaseUrls } from './wordpress-session';

afterEach(()=>vi.unstubAllGlobals());
it('explicit origins are retained for server validation and referrers do not trust the app itself',()=>{
  vi.stubGlobal('window',{location:{search:'?wordpress_origin=http%3A%2F%2Fproduction.example',origin:'https://app.example'}});
  vi.stubGlobal('document',{referrer:'https://homolog.example/tour/'});
  expect(wordpressOriginHint()).toBe('http://production.example');
  window.location.search='';expect(wordpressOriginHint()).toBe('https://homolog.example');
  vi.stubGlobal('document',{referrer:'https://app.example/'});expect(wordpressOriginHint()).toBeUndefined();
});
it('source-specific checkouts cannot silently fall back to a different site or crash on invalid local state',()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
  const primary={credits1:'https://homolog.example/checkout/'};
  expect(sessionPurchaseUrls('team',primary)).toEqual(primary);
  rememberWordpressSource('team',{ok:true,wordpress_origin:'https://production.example',purchase_urls:{credits1:'https://production.example/checkout/'}});
  expect(sessionPurchaseUrls('team',primary).credits1).toBe('https://production.example/checkout/');
  for(const value of ['null','[]','{"credits1":null,"price1":123}']){
    storage.set('vf_purchase_urls:team',value);expect(sessionPurchaseUrls('team',primary)).toEqual({});
  }
  storage.set('vf_generation:team','old-job');
  rememberWordpressSource('team',{ok:true,wordpress_origin:'https://homolog.example'});
  expect(storage.has('vf_generation:team')).toBe(false);
});
