import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const image=`data:image/png;base64,${readFileSync('tests/fixtures/photo.png').toString('base64')}`;
const team={id:'11111111-1111-4111-8111-111111111111',slug:'testteam',name:'Time de Teste',is_active:true,
  shirts:[{id:'home',name:'Camisa principal',imageUrl:image,assetPath:'https://assets.example/home.png',visible:true}],
  backgrounds:[{id:'stadium',name:'Estádio',imageUrl:image,assetPath:'https://assets.example/stadium.png',visible:true}],
  primary_color:'#1679d3',secondary_color:'#ffffff',tutorial_assets:{},text_overrides:{},purchase_urls:{}};
async function upload(page:Page) {
  await page.route('**/rest/v1/teams?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(team)}));
  await page.route('**/functions/v1/fanframe-proxy',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"balance":1}'}));
  await page.goto('/testteam?test_token=fixture');
  await page.getByRole('button',{name:'EXPERIMENTAR AGORA'}).click();await page.getByRole('button',{name:'COMEÇAR AGORA'}).click();
  await page.getByRole('button',{name:/Camisa principal/}).click();await page.getByRole('button',{name:'Continuar'}).click();
  await page.getByRole('button',{name:/Estádio/}).click();await page.getByRole('button',{name:'Continuar'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:readFileSync('tests/fixtures/photo.png')});
  await page.getByRole('checkbox').click();
}
for (const width of [390,1440]) test(`peak preparation is immediate, honest and bounded at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.clock.install();
  let probes=0;let posts=0;let accepted=false;let phase='preparing';let unavailable=false;
  await page.route('**/functions/v1/generate-tryon',route=>{posts++;accepted=true;return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({queueId:route.request().postDataJSON().request_id})});});
  await page.route('**/functions/v1/generation-status',route=>{
    const request=route.request().postDataJSON();
    if(request.action==='admission') {probes++;expect(request.userImageBase64).toBeUndefined();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:probes>1,reason:'queue_full',next_poll_after:30})});}
    if (unavailable) return route.fulfill({status:503,contentType:'application/json',body:'{"error":"temporary"}'});
    expect(accepted).toBe(true);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:request.queue_id,status:phase==='preparing'?'pending':'processing',phase,next_poll_after:15})});
  });
  await upload(page);await page.getByRole('button',{name:'VESTIR O MANTO'}).click();
  await expect(page.getByRole('heading',{name:'Preparando sua foto...'})).toBeVisible();
  await expect(page.getByTestId('generation-spinner')).toBeVisible();
  await expect(page.getByText('Vestindo o manto do Time de Teste', {exact:true})).toBeVisible();
  await expect(page.getByAltText('Sua foto original')).toHaveCount(0);expect(posts).toBe(0);
  const bar = page.getByRole('progressbar', { name: 'Preparação da foto' });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '5');
  await expect(bar).toHaveAttribute('aria-valuetext', '5% estimado · Preparando');
  await expect(bar.locator('[data-state]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('img', { name: 'Camisa principal', exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Estádio', exact: true })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Etapas da foto' })).toHaveCount(0);
  await expect(page.getByText(/fila|posição/i)).toHaveCount(0);
  await expect(page.getByText('5%', { exact: true })).toBeVisible();
  await expect(page.getByText('estimado', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`preparation-${width}.png`),animations:'disabled'});
  await page.clock.runFor(35000);await expect.poll(()=>posts).toBe(1);
  await expect(page.getByText('Sua foto estará disponível quando ficar pronta.')).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '25');
  phase='generating';await page.clock.runFor(20000);await expect(page.getByRole('heading',{name:'Preparando sua foto...'})).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuetext', /estimado · Criando/);
  unavailable=true;await page.clock.runFor(20000);
  await expect(page.getByRole('heading',{name:'Reconectando...'})).toBeVisible();
  const paused = await bar.getAttribute('aria-valuenow');
  await page.clock.runFor(60000);
  await expect(bar).toHaveAttribute('aria-valuenow', paused!);
  unavailable=false;await page.clock.runFor(40000);
  await expect(page.getByRole('heading',{name:'Preparando sua foto...'})).toBeVisible();
  await page.clock.runFor(180000);
  await expect(bar).toHaveAttribute('aria-valuenow', '85');
  phase='preparing';await page.clock.runFor(20000);
  await expect(page.getByRole('heading',{name:'Preparando sua foto...'})).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '85');
  phase='finishing';await page.clock.runFor(20000);await expect(page.getByRole('heading',{name:'Finalizando...'})).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuetext', /estimado · Finalizando/);
  await page.clock.runFor(30000);
  await expect(bar).toHaveAttribute('aria-valuenow', '99');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('generation-spinner').locator('.animate-spin')).toHaveCSS('animation-duration', '1e-05s');
  await page.screenshot({path:info.outputPath(`loading-bar-${width}.png`)});
  await page.reload();await expect(page.getByRole('heading',{name:'Finalizando...'})).toBeVisible();expect(posts).toBe(1);
});
for(const alreadyAccepted of [false,true]) test(`lost submission response ${alreadyAccepted?'recovers acceptance':'repeats only the same UUID'} without losing the photo`,async({page})=>{
  await page.clock.install();const ids:string[]=[];let lookupMisses=0;
  await page.route('**/functions/v1/generate-tryon',route=>{
    const body=route.request().postDataJSON();ids.push(body.request_id);expect(body.userImageBase64).toBe(image);
    return route.fulfill(ids.length===1 ? {status:503,contentType:'application/json',body:'{"error":"queue_unavailable"}'} : {status:202,contentType:'application/json',body:JSON.stringify({queueId:body.request_id})});
  });
  await page.route('**/functions/v1/generation-status',route=>{
    const body=route.request().postDataJSON();
    if(body.action==='admission')return route.fulfill({status:200,contentType:'application/json',body:'{"available":true}'});
    expect(body.queue_id).toBe(ids[0]);lookupMisses++;
    return route.fulfill(ids.length===1 && !alreadyAccepted ? {status:404,contentType:'application/json',body:'{"error":"generation_not_found"}'} : {status:200,contentType:'application/json',body:JSON.stringify({status:'completed',result_image_url:image})});
  });
  await upload(page);await page.getByRole('button',{name:'VESTIR O MANTO'}).click();await expect(page.getByRole('heading',{name:'Reconectando...'})).toBeVisible();
  await page.clock.runFor(15000);await expect.poll(()=>lookupMisses).toBeGreaterThan(0);await page.clock.runFor(10000);
  await expect(page.getByRole('button',{name:'Baixar Foto'})).toBeVisible();expect(ids.length).toBe(alreadyAccepted?1:2);expect(new Set(ids).size).toBe(1);
});
test('capacity race retries the same request while an exhausted budget stops retries',async({page})=>{
  await page.clock.install();const ids:string[]=[];
  await page.route('**/functions/v1/generation-status',route=>route.fulfill({status:200,contentType:'application/json',body:'{"available":true}'}));
  await page.route('**/functions/v1/generate-tryon',route=>{
    ids.push(route.request().postDataJSON().request_id);
    return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:ids.length===1?'queue_full':'budget_exhausted'})});
  });
  await upload(page);await page.getByRole('button',{name:'VESTIR O MANTO'}).click();
  await expect.poll(()=>ids.length).toBe(1);await expect(page.getByRole('heading',{name:'Preparando sua foto...'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Tentar Novamente'})).toHaveCount(0);
  await page.clock.runFor(35000);await expect(page.getByText('Novas fotos estão temporariamente indisponíveis. Seu crédito foi preservado.')).toBeVisible();
  await page.clock.runFor(120000);expect(ids.length).toBe(2);expect(new Set(ids).size).toBe(1);
});
test('paused admissions and expired authorization never automatically submit a photo',async({page})=>{
  let posts=0;
  await page.route('**/functions/v1/generate-tryon',route=>{posts++;return route.fulfill({status:500});});
  await page.route('**/functions/v1/generation-status',route=>route.fulfill({status:200,contentType:'application/json',body:'{"available":false,"reason":"admissions_paused"}'}));
  await upload(page);await page.getByRole('button',{name:'VESTIR O MANTO'}).click();
  await expect(page.getByText('Novas fotos estão temporariamente indisponíveis. Seu crédito foi preservado.')).toBeVisible();expect(posts).toBe(0);
  await expect(page.getByRole('progressbar', { name: 'Preparação da foto' })).toHaveCount(0);
  await page.route('**/functions/v1/generation-status',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"session_expired"}'}));
  await page.getByRole('button',{name:'Tentar Novamente'}).click();
  await expect(page.getByText('Acesse novamente pelo tour para recuperar sua foto.')).toBeVisible();expect(posts).toBe(0);
});
