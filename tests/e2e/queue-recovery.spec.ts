import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const id = '11111111-1111-4111-8111-111111111111';
const image = `data:image/png;base64,${readFileSync('tests/fixtures/photo.png').toString('base64')}`;
test('reload resumes the same job and transient status failure never submits another prediction', async ({ page }) => {
  let starts = 0; let polls = 0;
  await page.addInitScript(({ id }) => localStorage.setItem('vf_generation:testteam', id), { id });
  await page.route('**/rest/v1/teams?**', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ id,slug:'testteam',name:'Time de Teste',is_active:true,shirts:[],backgrounds:[],primary_color:'#1679d3',secondary_color:'#ffffff',tutorial_assets:{},text_overrides:{},purchase_urls:{} }) }));
  await page.route('**/functions/v1/fanframe-proxy', route => route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"balance":1}'}));
  await page.route('**/functions/v1/generate-tryon', route => { starts++; return route.fulfill({status:500,body:'must not submit'}); });
  await page.route('**/functions/v1/generation-status', route => {
    expect(route.request().postDataJSON().queue_id).toBe(id); polls++;
    return route.fulfill(polls===1 ? {status:503,contentType:'application/json',body:'{"error":"temporary"}'} : {status:200,contentType:'application/json',body:JSON.stringify({ id,status: polls<3 ? 'pending' : 'completed',next_poll_after:1,result_image_url:polls<3 ? null : image })});
  });
  await page.goto('/testteam?test_token=fixture');
  await expect(page.getByText('Reconectando...')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Preparação da foto' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Preparando seu manto'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Baixar Foto'})).toBeVisible();
  expect(starts).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('vf_generation:testteam'))).toBeNull();
});
test('history loads private results in pages only when requested', async ({ page }) => {
  const pages: number[] = [];
  await page.route('**/rest/v1/teams?**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id,slug:'testteam',name:'Time de Teste',is_active:true,shirts:[],backgrounds:[],primary_color:'#1679d3',secondary_color:'#ffffff',tutorial_assets:{},text_overrides:{},purchase_urls:{}})}));
  await page.route('**/functions/v1/fanframe-proxy', route => route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"balance":1}'}));
  await page.route('**/functions/v1/generation-status', route => {
    const request=route.request().postDataJSON();expect(request.action).toBe('history');pages.push(request.page);
    const entries=Array.from({length:request.page===0?10:1},(_,index)=>({id:`page-${request.page}-${index}`,status:'completed',result_image_url:image,shirt_id:'shirt',created_at:new Date().toISOString()}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({entries,has_more:request.page===0})});
  });
  await page.goto('/testteam?test_token=fixture');
  await page.getByRole('button',{name:/Meu Histórico de Fotos/}).click();
  await expect(page.getByText('10 fotos geradas')).toBeVisible();expect(pages).toEqual([0]);
  await page.getByRole('button',{name:'Ver mais fotos'}).click();
  await expect(page.getByText('11 fotos geradas')).toBeVisible();expect(pages).toEqual([0,1]);
  await expect(page.getByRole('button',{name:'Ver mais fotos'})).toHaveCount(0);
});
